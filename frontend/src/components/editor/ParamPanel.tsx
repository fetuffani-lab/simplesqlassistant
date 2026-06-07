import { useEditor } from "../../store/editor";

interface Props { tabId: string }

export default function ParamPanel({ tabId }: Props) {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useEditor((s) => s.updateTab);

  if (!tab) return null;

  let preview = "";
  try {
    const p = JSON.parse(tab.params);
    const isArray = Array.isArray(p);
    preview = isArray
      ? `Loop: ${p.length} iterations`
      : Object.keys(p).length === 0
      ? "No params"
      : `Keys: ${Object.keys(p).join(", ")}`;
  } catch {
    preview = "Invalid JSON";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f172a" }}>
      <div style={{ padding: "4px 8px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #1e293b" }}>
        PARAMS (JSON object or array) — {preview}
      </div>
      <textarea
        value={tab.params}
        onChange={(e) => updateTab(tabId, { params: e.target.value })}
        spellCheck={false}
        style={{
          flex: 1,
          background: "#0f172a",
          color: "#e2e8f0",
          border: "none",
          padding: 8,
          fontFamily: "monospace",
          fontSize: 12,
          resize: "none",
          outline: "none",
        }}
      />
    </div>
  );
}
