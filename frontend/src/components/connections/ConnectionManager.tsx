import { useEffect, useState } from "react";
import { useConnections } from "../../store/connections";

const STATUS_COLOR: Record<string, string> = {
  connected: "#22c55e",
  disconnected: "#94a3b8",
  error: "#ef4444",
};

// ── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  hint: string;
  type?: "text" | "password" | "number";
  placeholder?: string;
  optional?: boolean;
}

const PG_FIELDS: FieldDef[] = [
  { key: "host",     label: "Host",     hint: "Hostname or IP address of the PostgreSQL server.", placeholder: "localhost" },
  { key: "port",     label: "Port",     hint: "Server port. Default: 5432.", type: "number", placeholder: "5432", optional: true },
  { key: "database", label: "Database", hint: "Name of the database to connect to." },
  { key: "user",     label: "User",     hint: "PostgreSQL login username." },
  { key: "password", label: "Password", hint: "Leave empty if the server does not require a password.", type: "password", optional: true },
];

const ATHENA_SSO_FIELDS: FieldDef[] = [
  { key: "region",       label: "Region",       hint: "AWS region where Athena runs (e.g. us-east-1). Required for SSO.", placeholder: "us-east-1", optional: true },
  { key: "profile_name", label: "Profile name", hint: "Named AWS profile from ~/.aws/config. Leave empty to use the default profile.", placeholder: "my-sso-profile", optional: true },
  { key: "schema_name",  label: "Default schema", hint: "Athena database (schema) selected by default. Can be changed per query.", placeholder: "default", optional: true },
  { key: "s3_staging_dir", label: "S3 staging dir", hint: "S3 path where Athena writes query results. Optional if the workgroup has an output location configured.", placeholder: "s3://my-bucket/athena/results/", optional: true },
  { key: "work_group",   label: "Workgroup", hint: "Athena workgroup to submit queries to. Optional — defaults to 'primary'.", placeholder: "primary", optional: true },
];

const ATHENA_CREDS_FIELDS: FieldDef[] = [
  { key: "region",               label: "Region",           hint: "AWS region where Athena runs (e.g. us-east-1).", placeholder: "us-east-1" },
  { key: "aws_access_key_id",    label: "Access Key ID",    hint: "AWS access key ID. Starts with AKIA (long-term) or ASIA (temporary).", placeholder: "AKIAIOSFODNN7EXAMPLE" },
  { key: "aws_secret_access_key",label: "Secret Access Key",hint: "AWS secret access key associated with the access key ID.", type: "password" },
  { key: "schema_name",          label: "Default schema",   hint: "Athena database (schema) selected by default.", placeholder: "default", optional: true },
  { key: "s3_staging_dir",       label: "S3 staging dir",   hint: "S3 path where Athena writes query results. Optional if the workgroup has an output location configured.", placeholder: "s3://my-bucket/athena/results/", optional: true },
  { key: "work_group",           label: "Workgroup",        hint: "Athena workgroup to submit queries to. Optional — defaults to 'primary'.", placeholder: "primary", optional: true },
];

const ATHENA_ENV_FIELDS: FieldDef[] = [
  { key: "schema_name",    label: "Default schema", hint: "Athena database (schema) selected by default.", placeholder: "default", optional: true },
  { key: "s3_staging_dir", label: "S3 staging dir", hint: "S3 path where Athena writes query results. Optional if the workgroup has an output location configured.", placeholder: "s3://my-bucket/athena/results/", optional: true },
  { key: "work_group",     label: "Workgroup",      hint: "Athena workgroup to submit queries to. Optional — defaults to 'primary'.", placeholder: "primary", optional: true },
];

const ATHENA_ENV_VARS = [
  { name: "AWS_ACCESS_KEY_ID",     required: true,  desc: "Access key ID" },
  { name: "AWS_SECRET_ACCESS_KEY", required: true,  desc: "Secret access key" },
  { name: "AWS_SESSION_TOKEN",     required: false, desc: "Session token (temporary credentials)" },
  { name: "AWS_DEFAULT_REGION",    required: false, desc: "Region — falls back to us-east-1" },
];

type AthenaAuth = "sso" | "credentials" | "env";

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultValues(fields: FieldDef[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.placeholder && f.type !== "password" ? "" : ""]));
}

function buildConfig(fields: FieldDef[], values: Record<string, string>, auth: string): Record<string, unknown> {
  const cfg: Record<string, unknown> = { auth };
  for (const f of fields) {
    const v = values[f.key]?.trim() ?? "";
    if (!v && f.optional) continue;
    cfg[f.key] = f.type === "number" ? Number(v) || undefined : v;
  }
  return cfg;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
        {field.label}
        {!field.optional && <span style={{ color: "#ef4444" }}> *</span>}
      </div>
      <input
        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        style={inputStyle}
        autoComplete="off"
      />
      <div style={{ fontSize: 10, color: "#475569", marginTop: 3, lineHeight: 1.4 }}>{field.hint}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectionManager() {
  const { connections, fetch, add, remove, reconnect, setActive, activeId } = useConnections();
  const [name, setName] = useState("");
  const [type, setType] = useState<"postgres" | "athena">("postgres");
  const [athenaAuth, setAthenaAuth] = useState<AthenaAuth>("sso");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const activeFields: FieldDef[] =
    type === "postgres" ? PG_FIELDS :
    athenaAuth === "sso" ? ATHENA_SSO_FIELDS :
    athenaAuth === "credentials" ? ATHENA_CREDS_FIELDS :
    ATHENA_ENV_FIELDS;

  const handleTypeChange = (t: "postgres" | "athena") => {
    setType(t);
    setAthenaAuth("sso");
    setValues({});
    setError(null);
  };

  const handleAuthChange = (a: AthenaAuth) => {
    setAthenaAuth(a);
    setValues({});
    setError(null);
  };

  const handleAdd = async () => {
    setError(null);
    try {
      const auth = type === "postgres" ? "postgres" : athenaAuth;
      const config = buildConfig(activeFields, values, auth);
      await add(name, type, config);
      setName("");
      setValues({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const canSubmit = !!name && activeFields
    .filter((f) => !f.optional)
    .every((f) => (values[f.key] ?? "").trim() !== "");

  return (
    <div style={{ padding: 16, fontSize: 13, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Connections</h3>

      {/* Existing connections */}
      <div style={{ marginBottom: 16 }}>
        {connections.length === 0 && <div style={{ color: "#475569", fontSize: 12 }}>No connections yet.</div>}
        {connections.map((c) => (
          <div key={c.id}>
            <div
              onClick={() => setActive(c.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
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
                >↺</button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
              >×</button>
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
      <div style={{ borderTop: "1px solid #334155", paddingTop: 14 }}>
        <div style={{ marginBottom: 12, fontWeight: 600 }}>New connection</div>

        {/* Name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
            Name <span style={{ color: "#ef4444" }}>*</span>
          </div>
          <input
            placeholder="My database"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>A label to identify this connection.</div>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>Type</div>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as "postgres" | "athena")}
            style={inputStyle}
          >
            <option value="postgres">PostgreSQL</option>
            <option value="athena">AWS Athena</option>
          </select>
        </div>

        {/* Athena auth selector */}
        {type === "athena" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Authentication</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["sso", "credentials", "env"] as AthenaAuth[]).map((a) => (
                <button
                  key={a}
                  onClick={() => handleAuthChange(a)}
                  style={{
                    flex: 1, padding: "4px 0", fontSize: 11, cursor: "pointer", borderRadius: 4,
                    border: `1px solid ${athenaAuth === a ? "#2563eb" : "#2d3f55"}`,
                    background: athenaAuth === a ? "#1d4ed8" : "#0d1520",
                    color: athenaAuth === a ? "#e0eaff" : "#64748b",
                  }}
                >
                  {a === "sso" ? "SSO / profile" : a === "credentials" ? "Access key" : "Env vars"}
                </button>
              ))}
            </div>
            {type === "athena" && athenaAuth === "sso" && (
              <div style={{ fontSize: 10, color: "#475569", marginTop: 6, lineHeight: 1.4 }}>
                Uses the local AWS credential chain: SSO session, ~/.aws/credentials, instance profile, or ECS task role.
              </div>
            )}
            {type === "athena" && athenaAuth === "env" && (
              <div style={{ marginTop: 8, background: "#0d1520", border: "1px solid #1e293b", borderRadius: 4, padding: "8px 10px" }}>
                {ATHENA_ENV_VARS.map((v) => (
                  <div key={v.name} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 10 }}>
                    <span style={{ color: v.required ? "#93c5fd" : "#475569", fontFamily: "monospace", minWidth: 180 }}>{v.name}</span>
                    <span style={{ color: "#475569" }}>{v.required ? "" : "(optional) "}{v.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dynamic fields */}
        {activeFields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={values[f.key] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}

        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button onClick={handleAdd} disabled={!canSubmit} style={btnStyle(canSubmit)}>
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
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  boxSizing: "border-box",
  outline: "none",
};

const btnStyle = (enabled: boolean): React.CSSProperties => ({
  width: "100%",
  marginTop: 4,
  padding: "7px 0",
  background: enabled ? "#1d4ed8" : "#1a2535",
  color: enabled ? "#e0eaff" : "#475569",
  border: `1px solid ${enabled ? "#2563eb" : "#2d3f55"}`,
  borderRadius: 4,
  cursor: enabled ? "pointer" : "default",
  fontSize: 12,
  fontWeight: 600,
});
