import { useRef, useEffect } from "react";
import Editor, { OnMount, BeforeMount, Monaco } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { useEditor } from "../../store/editor";
import { useConnections } from "../../store/connections";
import { useQuerySocket } from "../../hooks/useQuerySocket";
import ParamPanel from "./ParamPanel";
import { registerEditor, unregisterEditor } from "../../lib/editorRegistry";
import { getAllTableNames, getAllColumnNames } from "../../lib/schemaCache";

interface Props { tabId: string }

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "AS",
  "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN", "ON",
  "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "DISTINCT", "ALL",
  "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM",
  "CREATE TABLE", "DROP TABLE", "ALTER TABLE", "WITH",
  "UNION", "UNION ALL", "EXCEPT", "INTERSECT",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "EXISTS", "BETWEEN", "LIKE", "ILIKE",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF",
  "CAST", "EXTRACT", "DATE_TRUNC", "NOW", "CURRENT_TIMESTAMP", "CURRENT_DATE",
  "TRUE", "FALSE", "ASC", "DESC", "NULLS FIRST", "NULLS LAST",
];

let completionRegistered = false;

export default function QueryEditor({ tabId }: Props) {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useEditor((s) => s.updateTab);
  const connections = useConnections((s) => s.connections);
  const activeConnId = useConnections((s) => s.activeId);
  const { run, cancel } = useQuerySocket(tabId);

  useEffect(() => {
    if (tab && !tab.connectionId && activeConnId) {
      updateTab(tabId, { connectionId: activeConnId });
    }
  }, [activeConnId, tab?.connectionId, tabId]);

  useEffect(() => {
    return () => unregisterEditor(tabId);
  }, [tabId]);

  const handleRunRef = useRef<() => void>(() => {});

  const handleRun = () => {
    const current = useEditor.getState().tabs.find((t) => t.id === tabId);
    if (!current?.connectionId || !current.sql.trim()) return;
    let params: unknown = {};
    try { params = JSON.parse(current.params); } catch { params = {}; }
    run(current.connectionId, current.sql, params);
  };

  handleRunRef.current = handleRun;

  const handleCancel = () => {
    const current = useEditor.getState().tabs.find((t) => t.id === tabId);
    if (current?.executionId && current.connectionId) {
      cancel(current.connectionId, current.executionId);
    }
  };

  const handleBeforeMount: BeforeMount = (monaco: Monaco) => {
    if (completionRegistered) return;
    completionRegistered = true;

    monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", "."],
      provideCompletionItems: (model: MonacoEditor.editor.ITextModel, position: MonacoEditor.Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const kwSuggestions = SQL_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: "z_" + kw,
        }));

        const tableSuggestions = getAllTableNames().map((t) => ({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: t,
          range,
          sortText: "a_" + t,
        }));

        const colSuggestions = getAllColumnNames().map((c) => ({
          label: c,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: c,
          range,
          sortText: "b_" + c,
        }));

        return { suggestions: [...tableSuggestions, ...colSuggestions, ...kwSuggestions] };
      },
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    registerEditor(tabId, editor);
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => handleRunRef.current()
    );
  };

  if (!tab) return null;

  const isRunning = tab.status === "running";
  const canRun = !!tab.connectionId && !!tab.sql.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={toolbar}>
        <select
          value={tab.connectionId}
          onChange={(e) => updateTab(tabId, { connectionId: e.target.value })}
          style={selectStyle}
        >
          <option value="">— connection —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.status === "connected" ? "● " : "○ "}{c.name}
            </option>
          ))}
        </select>

        {!isRunning ? (
          <button onClick={handleRun} disabled={!canRun} style={runBtn(canRun)}>
            ▶ Run
          </button>
        ) : (
          <button onClick={handleCancel} style={cancelBtn}>
            ■ Stop
          </button>
        )}

        <span style={{ fontSize: 11, color: "#475569" }}>Ctrl+Enter</span>

        {tab.status !== "idle" && (
          <span style={{ fontSize: 11, color: statusColor(tab.status), marginLeft: 4 }}>
            {tab.status}
            {tab.elapsedMs > 0 && ` · ${(tab.elapsedMs / 1000).toFixed(2)}s`}
            {tab.errorMessage && ` — ${tab.errorMessage}`}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={tab.sql}
          onChange={(v) => updateTab(tabId, { sql: v ?? "" })}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            renderLineHighlight: "line",
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
          }}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
        />
      </div>

      <div style={{ height: 110, borderTop: "1px solid #1e293b", flexShrink: 0 }}>
        <ParamPanel tabId={tabId} />
      </div>
    </div>
  );
}

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 10px",
  background: "#161f2e",
  borderBottom: "1px solid #1e293b",
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  background: "#0d1520",
  color: "#cbd5e1",
  border: "1px solid #2d3f55",
  borderRadius: 4,
  padding: "3px 8px",
  fontFamily: "monospace",
  fontSize: 12,
  cursor: "pointer",
};

const runBtn = (enabled: boolean): React.CSSProperties => ({
  padding: "3px 12px",
  background: enabled ? "#166534" : "#1a2535",
  color: enabled ? "#86efac" : "#475569",
  border: `1px solid ${enabled ? "#166534" : "#2d3f55"}`,
  borderRadius: 4,
  cursor: enabled ? "pointer" : "default",
  fontFamily: "monospace",
  fontSize: 12,
  fontWeight: 600,
});

const cancelBtn: React.CSSProperties = {
  padding: "3px 12px",
  background: "#450a0a",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 12,
  fontWeight: 600,
};

const statusColor = (s: string) =>
  ({ running: "#fbbf24", done: "#4ade80", error: "#f87171", cancelled: "#94a3b8" }[s] ?? "#cbd5e1");
