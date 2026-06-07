import { useRef, useCallback } from "react";
import { useEditor } from "../store/editor";

export function useQuerySocket(tabId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const updateTab = useEditor((s) => s.updateTab);

  const run = useCallback(
    (connectionId: string, sql: string, params: unknown) => {
      if (wsRef.current) wsRef.current.close();

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/api/ws/${connectionId}/query`);
      wsRef.current = ws;

      updateTab(tabId, { status: "running", rows: [], totalRows: 0, errorMessage: "" });

      ws.onopen = () => ws.send(JSON.stringify({ sql, params }));

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "rows") {
          updateTab(tabId, { rows: msg.rows, totalRows: msg.total });
          window.dispatchEvent(new CustomEvent("history:refresh"));
        } else if (msg.status) {
          updateTab(tabId, {
            status: msg.status,
            elapsedMs: msg.elapsed_ms ?? 0,
            executionId: msg.execution_id ?? null,
            errorMessage: msg.message ?? "",
          });
        }
      };

      ws.onerror = () => updateTab(tabId, { status: "error", errorMessage: "WebSocket error" });
      ws.onclose = () => {
        wsRef.current = null;
      };
    },
    [tabId, updateTab]
  );

  const cancel = useCallback(
    async (connectionId: string, executionId: string) => {
      await fetch(`/api/connections/${connectionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution_id: executionId }),
      });
    },
    []
  );

  return { run, cancel };
}
