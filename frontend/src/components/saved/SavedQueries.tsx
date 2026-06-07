import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useEditor } from "../../store/editor";

interface SavedQuery {
  id: number;
  name: string;
  sql: string;
  connection_id: string | null;
  created_at: number;
  updated_at: number;
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function SavedQueries() {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const { addTab, updateTab } = useEditor();

  const load = (q = search) =>
    axios.get("/api/saved", { params: q ? { search: q } : {} })
      .then((r) => setQueries(r.data));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = () => load(search);
    window.addEventListener("saved:refresh", handler);
    return () => window.removeEventListener("saved:refresh", handler);
  }, [search]);

  const handleSearch = (v: string) => {
    setSearch(v);
    load(v);
  };

  const openInEditor = (q: SavedQuery) => {
    const { tabs, activeTabId } = useEditor.getState();
    const active = tabs.find((t) => t.id === activeTabId);
    if (active && !active.sql.trim()) {
      // Reuse empty active tab
      updateTab(activeTabId, {
        sql: q.sql,
        title: q.name,
        ...(q.connection_id ? { connectionId: q.connection_id } : {}),
      });
    } else {
      addTab();
      const newState = useEditor.getState();
      updateTab(newState.activeTabId, {
        sql: q.sql,
        title: q.name,
        ...(q.connection_id ? { connectionId: q.connection_id } : {}),
      });
    }
  };

  const startRename = (q: SavedQuery) => {
    setRenamingId(q.id);
    setRenameText(q.name);
    setTimeout(() => renameRef.current?.select(), 0);
  };

  const commitRename = async (id: number) => {
    if (renameText.trim()) {
      await axios.put(`/api/saved/${id}`, { name: renameText.trim() });
      load();
    }
    setRenamingId(null);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`/api/saved/${id}`);
    setQueries((prev) => prev.filter((q) => q.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #1e293b" }}>
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search…"
          style={searchStyle}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {queries.length === 0 && (
          <div style={{ padding: 16, color: "#475569", fontSize: 12 }}>
            {search ? "No matches." : "No saved queries yet. Use the Save button in the editor."}
          </div>
        )}
        {queries.map((q) => (
          <div key={q.id} style={{ borderBottom: "1px solid #1a2535" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", cursor: "pointer" }}
              onDoubleClick={() => openInEditor(q)}
            >
              <span
                style={{ color: "#64748b", fontSize: 10, userSelect: "none", marginRight: 2 }}
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                title="Toggle SQL preview"
              >
                {expandedId === q.id ? "▾" : "▸"}
              </span>

              {renamingId === q.id ? (
                <input
                  ref={renameRef}
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => commitRename(q.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(q.id);
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flex: 1, background: "#0d1520", border: "1px solid #2563eb", color: "#e2e8f0", borderRadius: 3, padding: "1px 4px", fontSize: 12, outline: "none" }}
                />
              ) : (
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span
                    style={{ color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title="Double-click to open, click pencil to rename"
                  >
                    {q.name}
                  </span>
                  <span style={{ color: "#334155", fontSize: 10, fontFamily: "monospace" }}>
                    {fmtDate(q.created_at)}
                  </span>
                </span>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); startRename(q); }}
                style={iconBtn}
                title="Rename"
              >✎</button>
              <button
                onClick={(e) => { e.stopPropagation(); openInEditor(q); }}
                style={iconBtn}
                title="Open in editor"
              >↗</button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                style={{ ...iconBtn, color: "#ef4444" }}
                title="Delete"
              >×</button>
            </div>

            {expandedId === q.id && (
              <pre style={{
                margin: 0,
                padding: "4px 28px 8px",
                fontSize: 11,
                color: "#64748b",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                background: "#090f1a",
                borderTop: "1px solid #1a2535",
              }}>
                {q.sql.length > 400 ? q.sql.slice(0, 400) + "…" : q.sql}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const searchStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d1520",
  border: "1px solid #2d3f55",
  color: "#cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  boxSizing: "border-box",
  outline: "none",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#475569",
  cursor: "pointer",
  fontSize: 13,
  padding: "0 3px",
  lineHeight: 1,
  flexShrink: 0,
};
