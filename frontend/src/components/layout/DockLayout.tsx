import DockLayout, { LayoutData } from "rc-dock";
import "rc-dock/dist/rc-dock-dark.css";
import { useState, useRef } from "react";
import { useEditor } from "../../store/editor";
import QueryEditor from "../editor/QueryEditor";
import ResultsGrid from "../results/ResultsGrid";
import ExportDialog from "../results/ExportDialog";
import DbExplorer from "../explorer/DbExplorer";
import QueryHistory from "../history/QueryHistory";
import DbStats from "../status/DbStats";
import ConnectionManager from "../connections/ConnectionManager";
import { insertIntoEditor } from "../../lib/editorRegistry";

function ResultsPanel({ tabId }: { tabId: string }) {
  const [showExport, setShowExport] = useState(false);
  const tab = useEditor((s) => s.tabs.find((t) => t.id === tabId));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "3px 8px", borderBottom: "1px solid #1e293b", background: "#0f172a", display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => setShowExport(true)}
          disabled={!tab?.rows.length}
          style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", borderRadius: 4, padding: "1px 8px", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}
        >
          Export…
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResultsGrid tabId={tabId} />
      </div>
      {showExport && <ExportDialog tabId={tabId} onClose={() => setShowExport(false)} />}
    </div>
  );
}

function EditorTabs() {
  const { tabs, activeTabId, addTab, closeTab, setActive, updateTab } = useEditor();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      updateTab(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #334155", alignItems: "center", overflow: "hidden" }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{ padding: "4px 10px", cursor: "pointer", fontSize: 12, borderRight: "1px solid #334155", display: "flex", alignItems: "center", gap: 6, background: t.id === activeTabId ? "#0f172a" : "transparent", color: t.id === activeTabId ? "#e2e8f0" : "#64748b", whiteSpace: "nowrap" }}
          >
            {editingId === t.id ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 90, background: "#0d1520", border: "1px solid #2563eb", color: "#e2e8f0", borderRadius: 3, padding: "1px 4px", fontSize: 12, outline: "none" }}
              />
            ) : (
              <span onDoubleClick={(e) => { e.stopPropagation(); startRename(t.id, t.title); }}>
                {t.title}
              </span>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
              style={{ color: "#475569", fontSize: 14, lineHeight: 1 }}
            >
              ×
            </span>
          </div>
        ))}
        <button onClick={addTab} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px 10px", fontSize: 16 }}>+</button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab && <QueryEditor tabId={activeTab.id} />}
      </div>
    </div>
  );
}

function ResultsTabs() {
  const { tabs, activeTabId } = useEditor();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab ? <ResultsPanel tabId={activeTab.id} /> : <div style={{ padding: 12, color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>Open a query tab.</div>;
}

function ExplorerPanel() {
  const handleInsert = (text: string) => {
    const { activeTabId } = useEditor.getState();
    if (activeTabId) insertIntoEditor(activeTabId, text);
  };
  return <DbExplorer onInsert={handleInsert} />;
}

const defaultLayout: LayoutData = {
  dockbox: {
    mode: "horizontal",
    children: [
      {
        size: 200,
        tabs: [
          { id: "connections", title: "Connections", content: <ConnectionManager />, cached: true },
          { id: "explorer", title: "Explorer", content: <ExplorerPanel />, cached: true },
          { id: "history", title: "History", content: <QueryHistory />, cached: true },
          { id: "stats", title: "DB Stats", content: <DbStats />, cached: true },
        ],
      },
      {
        size: 600,
        mode: "vertical",
        children: [
          { size: 300, tabs: [{ id: "editor", title: "Editor", content: <EditorTabs />, cached: true }] },
          { size: 200, tabs: [{ id: "results", title: "Results", content: <ResultsTabs />, cached: true }] },
        ],
      },
    ],
  },
};

export default function AppDockLayout() {
  return (
    <DockLayout
      defaultLayout={defaultLayout}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
