import { useState, useEffect } from "react";
import axios from "axios";
import { useConnections } from "../../store/connections";

interface StatsResult {
  type: string;
  metrics: Record<string, unknown>;
}

export default function DbStats() {
  const { activeId } = useConnections();
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [running, setRunning] = useState<unknown[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    if (!activeId) return;
    setError("");
    try {
      const [s, r] = await Promise.all([
        axios.get<StatsResult>(`/api/connections/${activeId}/stats`),
        axios.get<unknown[]>(`/api/connections/${activeId}/stats/running`),
      ]);
      setStats(s.data);
      setRunning(r.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [activeId]);

  if (!activeId) return <div style={msg}>Select a connection.</div>;
  if (error) return <div style={{ ...msg, color: "#ef4444" }}>{error}</div>;
  if (!stats) return <div style={msg}>Loading…</div>;

  const metrics = stats.metrics as Record<string, unknown>;

  return (
    <div style={{ padding: 12, fontFamily: "monospace", fontSize: 12, overflow: "auto" }}>
      <h4 style={{ marginTop: 0, color: "#94a3b8" }}>DB Stats — {stats.type}</h4>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {Object.entries(metrics).map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "3px 8px", color: "#94a3b8", whiteSpace: "nowrap" }}>{k}</td>
              <td style={{ padding: "3px 8px", color: "#e2e8f0" }}>{v === null ? "N/A" : String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {running.length > 0 && (
        <>
          <h4 style={{ color: "#94a3b8", marginTop: 16 }}>Running queries ({running.length})</h4>
          {(running as Record<string, unknown>[]).map((r, i) => (
            <div key={i} style={{ background: "#1e293b", borderRadius: 4, padding: "6px 8px", marginBottom: 6 }}>
              <div style={{ color: "#facc15", fontSize: 11, marginBottom: 2 }}>
                {String(r.pid ?? r.id ?? "")} · {String(r.usename ?? r.status ?? "")}
              </div>
              <div style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {String(r.query ?? r.sql ?? "").slice(0, 200)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const msg: React.CSSProperties = { padding: 12, color: "#64748b", fontFamily: "monospace", fontSize: 12 };
