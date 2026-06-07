import { useState } from "react";
import { useEditor } from "../../store/editor";

interface Props { tabId: string; onClose: () => void }

export default function ExportDialog({ tabId, onClose }: Props) {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === tabId));
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [separator, setSeparator] = useState(",");
  const [decimalSeparator, setDecimalSeparator] = useState(".");
  const [includeHeader, setIncludeHeader] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!tab) return null;

  const handleExport = async () => {
    setLoading(true);
    setError("");
    try {
      let params: unknown = {};
      try { params = JSON.parse(tab.params); } catch { params = {}; }
      const res = await fetch(`/api/connections/${tab.connectionId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: tab.sql, params, format, separator, decimal_separator: decimalSeparator, include_header: includeHeader }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={dialog}>
        <h3 style={{ marginTop: 0 }}>Export data</h3>
        <label style={labelStyle}>Format</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")} style={inputStyle}>
          <option value="csv">CSV</option>
          <option value="xlsx">XLSX</option>
        </select>
        {format === "csv" && (
          <>
            <label style={labelStyle}>Column separator</label>
            <input value={separator} onChange={(e) => setSeparator(e.target.value)} style={inputStyle} />
          </>
        )}
        <label style={labelStyle}>Decimal separator</label>
        <select value={decimalSeparator} onChange={(e) => setDecimalSeparator(e.target.value)} style={inputStyle}>
          <option value=".">. (period)</option>
          <option value=",">, (comma)</option>
        </select>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} />
          Include header row
        </label>
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={handleExport} disabled={loading} style={{ ...btnStyle, background: "#3b82f6" }}>
            {loading ? "Exporting…" : "Download"}
          </button>
          <button onClick={onClose} style={{ ...btnStyle, background: "#334155" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const dialog: React.CSSProperties = { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 24, minWidth: 280, fontFamily: "monospace" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#94a3b8", marginTop: 10, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", padding: "4px 8px", borderRadius: 4, fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" };
const btnStyle: React.CSSProperties = { padding: "6px 14px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 12 };
