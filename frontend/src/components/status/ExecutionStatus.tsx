import { useEditor } from "../../store/editor";
import { useConnections } from "../../store/connections";

export default function ExecutionStatus() {
  const tabs = useEditor((s) => s.tabs);
  const { connections, activeId } = useConnections();
  const activeConn = connections.find((c) => c.id === activeId);
  const activeTab = useEditor((s) => s.tabs.find((t) => t.id === s.activeTabId));

  const runningCount = tabs.filter((t) => t.status === "running").length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "3px 12px", background: "#0f172a", borderTop: "1px solid #1e293b", fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
      <span>
        <span style={{ color: activeConn ? "#22c55e" : "#64748b" }}>●</span>{" "}
        {activeConn ? activeConn.name : "no connection"}
      </span>
      {activeConn && <span>status: {activeConn.status}</span>}
      {activeTab && activeTab.status !== "idle" && (
        <span>
          last query: {(activeTab.elapsedMs / 1000).toFixed(2)}s · {activeTab.totalRows} rows
        </span>
      )}
      {runningCount > 0 && (
        <span style={{ color: "#facc15" }}>active executions: {runningCount}</span>
      )}
    </div>
  );
}
