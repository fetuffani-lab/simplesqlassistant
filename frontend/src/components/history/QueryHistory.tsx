import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useConnections } from "../../store/connections";
import { useEditor, type Tab } from "../../store/editor";

interface HistoryEntry {
  id: number;
  timestamp: number;
  connection_id: string;
  connection_name: string;
  sql: string;
  status: string;
  duration_ms: number;
  rows_returned: number;
}

const STATUS_COLOR: Record<string, string> = {
  done: "#4ade80",
  error: "#f87171",
  cancelled: "#94a3b8",
  running: "#fbbf24",
};

async function cancelExecution(connectionId: string, executionId: string) {
  await fetch(`/api/connections/${connectionId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ execution_id: executionId }),
  });
}

export default function QueryHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const { activeId } = useConnections();
  const runningTabs = useEditor((s) => s.tabs.filter((t) => t.status === "running"));
  const addTab = useEditor((s) => s.addTab);
  const updateTab = useEditor((s) => s.updateTab);
  const setActive = useEditor((s) => s.setActive);

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (activeId) params.connection_id = activeId;
    if (search) params.search = search;
    try {
      const { data } = await axios.get<HistoryEntry[]>("/api/history", { params });
      setEntries(data);
    } catch {
      // ignore
    }
  }, [activeId, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("history:refresh", handler);
    return () => window.removeEventListener("history:refresh", handler);
  }, [load]);

  const openInEditor = (entry: HistoryEntry) => {
    addTab();
    setTimeout(() => {
      const allTabs = useEditor.getState().tabs;
      const last = allTabs[allTabs.length - 1];
      updateTab(last.id, { sql: entry.sql, connectionId: entry.connection_id });
      setActive(last.id);
    }, 0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 12 }}>
      <div style={{ padding: "4px 8px", borderBottom: "1px solid #1e293b", display: "flex", gap: 4 }}>
        <input
          placeholder="Search queries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "3px 6px", borderRadius: 4, fontSize: 12 }}
        />
        <button onClick={load} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 4, cursor: "pointer", padding: "0 6px", fontSize: 11 }}>↺</button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Running queries at top */}
        {runningTabs.map((tab) => (
          <RunningRow key={tab.id} tab={tab} />
        ))}

        {entries.length === 0 && runningTabs.length === 0 && (
          <div style={{ padding: 12, color: "#64748b" }}>No history.</div>
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            onClick={() => openInEditor(e)}
            style={{ padding: "6px 10px", borderBottom: "1px solid #1e293b", cursor: "pointer" }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = "#1e293b")}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
          >
            <div style={{ color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.sql}</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: STATUS_COLOR[e.status] ?? "#94a3b8", fontWeight: 600 }}>{e.status}</span>
              <span>{e.connection_name}</span>
              <span>{e.rows_returned} rows</span>
              <span>{(e.duration_ms / 1000).toFixed(2)}s</span>
              <span style={{ marginLeft: "auto" }}>{new Date(e.timestamp * 1000).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunningRow({ tab }: { tab: Tab }) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!tab.executionId || !tab.connectionId || cancelling) return;
    setCancelling(true);
    try {
      await cancelExecution(tab.connectionId, tab.executionId);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{ padding: "6px 10px", borderBottom: "1px solid #1e293b", background: "#0d1a0d" }}>
      <div style={{ color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {tab.sql || "(no query)"}
      </div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ color: "#fbbf24", fontWeight: 600 }}>running</span>
        <span>{tab.title}</span>
        <span style={{ marginLeft: "auto" }}>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 3, cursor: "pointer", padding: "1px 6px", fontSize: 11 }}
          >
            ■ Stop
          </button>
        </span>
      </div>
    </div>
  );
}
