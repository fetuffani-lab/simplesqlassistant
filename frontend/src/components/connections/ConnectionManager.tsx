import { useEffect, useState } from "react";
import { useConnections } from "../../store/connections";

const STATUS_COLOR: Record<string, string> = {
  connected: "#22c55e",
  disconnected: "#94a3b8",
  error: "#ef4444",
};

const DEFAULT_PG = JSON.stringify(
  { host: "localhost", port: 5432, database: "", user: "", password: "" },
  null,
  2
);

const ATHENA_TEMPLATES: Record<string, object> = {
  sso: { region: "us-east-1", s3_staging_dir: "s3://bucket/prefix/", schema_name: "default", auth: "sso" },
  credentials: { region: "us-east-1", s3_staging_dir: "s3://bucket/prefix/", schema_name: "default", auth: "credentials", aws_access_key_id: "", aws_secret_access_key: "" },
  env: { s3_staging_dir: "s3://bucket/prefix/", schema_name: "default", auth: "env" },
};

const ENV_VARS_NOTE = "Reads: AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY · AWS_SESSION_TOKEN · AWS_DEFAULT_REGION";

export default function ConnectionManager() {
  const { connections, fetch, add, remove, reconnect, setActive, activeId } = useConnections();
  const [name, setName] = useState("");
  const [type, setType] = useState<"postgres" | "athena">("postgres");
  const [athenaAuth, setAthenaAuth] = useState<"sso" | "credentials" | "env">("sso");
  const [configJson, setConfigJson] = useState(DEFAULT_PG);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleTypeChange = (t: "postgres" | "athena") => {
    setType(t);
    if (t === "postgres") {
      setConfigJson(DEFAULT_PG);
    } else {
      setAthenaAuth("sso");
      setConfigJson(JSON.stringify(ATHENA_TEMPLATES["sso"], null, 2));
    }
  };

  const handleAthenaAuthChange = (auth: "sso" | "credentials" | "env") => {
    setAthenaAuth(auth);
    setConfigJson(JSON.stringify(ATHENA_TEMPLATES[auth], null, 2));
  };

  const handleAdd = async () => {
    setError(null);
    try {
      const config = JSON.parse(configJson);
      await add(name, type, config);
      setName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h3 style={{ marginTop: 0 }}>Connections</h3>

      {/* Existing connections */}
      <div style={{ marginBottom: 16 }}>
        {connections.length === 0 && <div style={{ color: "#94a3b8" }}>No connections</div>}
        {connections.map((c) => (
          <div key={c.id}>
            <div
              onClick={() => setActive(c.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: c.status === "error" ? "4px 4px 0 0" : 4,
                cursor: "pointer",
                background: c.id === activeId ? "#0f2040" : "#111827",
                border: `1px solid ${c.id === activeId ? "#2563eb" : "#1e293b"}`,
                color: c.id === activeId ? "#e0eaff" : "#94a3b8",
                marginBottom: c.status === "error" ? 0 : 4,
              }}
            >
              <span style={{ color: STATUS_COLOR[c.status], fontSize: 10 }}>●</span>
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>{c.type}</span>
              {c.status === "error" && (
                <button
                  onClick={(e) => { e.stopPropagation(); reconnect(c.id); }}
                  style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 11, padding: "0 4px" }}
                  title="Retry connection"
                >
                  ↺
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {c.status === "error" && c.error && (
              <div style={{ fontSize: 10, color: "#f87171", background: "#1c0a0a", border: "1px solid #1e293b", borderTop: "none", padding: "3px 8px", borderRadius: "0 0 4px 4px", marginBottom: 4, wordBreak: "break-all" }}>
                {c.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new connection */}
      <div style={{ borderTop: "1px solid #334155", paddingTop: 12 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>New connection</div>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as "postgres" | "athena")}
          style={{ ...inputStyle, marginTop: 6 }}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="athena">AWS Athena</option>
        </select>

        {type === "athena" && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Auth</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["sso", "credentials", "env"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => handleAthenaAuthChange(a)}
                  style={{
                    flex: 1, padding: "3px 0", fontSize: 11, cursor: "pointer", borderRadius: 4,
                    border: `1px solid ${athenaAuth === a ? "#2563eb" : "#2d3f55"}`,
                    background: athenaAuth === a ? "#1d4ed8" : "#0d1520",
                    color: athenaAuth === a ? "#e0eaff" : "#64748b",
                  }}
                >
                  {a === "sso" ? "SSO / profile" : a === "credentials" ? "Access key" : "Env vars"}
                </button>
              ))}
            </div>
            {athenaAuth === "env" && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#64748b", background: "#0d1520", border: "1px solid #1e293b", borderRadius: 4, padding: "4px 8px" }}>
                {ENV_VARS_NOTE}
              </div>
            )}
          </div>
        )}

        <textarea
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          rows={8}
          style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
        />
        {error && <div style={{ color: "#ef4444", marginTop: 4 }}>{error}</div>}
        <button onClick={handleAdd} style={btnStyle} disabled={!name}>
          Connect
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d1520",
  border: "1px solid #2d3f55",
  color: "#cbd5e1",
  padding: "6px 8px",
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
  boxSizing: "border-box",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "6px 16px",
  background: "#1d4ed8",
  color: "#e0eaff",
  border: "1px solid #2563eb",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 12,
  fontWeight: 600,
};
