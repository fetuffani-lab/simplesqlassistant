import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { useEditor } from "../../store/editor";

interface Props { tabId: string }

const helper = createColumnHelper<Record<string, unknown>>();

export default function ResultsGrid({ tabId }: Props) {
  const tab = useEditor((s) => s.tabs.find((t) => t.id === tabId));
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => {
    if (!tab?.rows.length) return [];
    return Object.keys(tab.rows[0]).map((key) =>
      helper.accessor((row) => row[key], {
        id: key,
        header: key,
        cell: (info) => {
          const v = info.getValue();
          return v === null ? <span style={{ color: "#64748b" }}>NULL</span> : String(v);
        },
      })
    );
  }, [tab?.rows]);

  const table = useReactTable({
    data: tab?.rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!tab) return null;

  if (tab.status === "idle") {
    return <div style={emptyStyle}>Run a query to see results.</div>;
  }
  if (tab.status === "running") {
    return <div style={emptyStyle}>Running…</div>;
  }
  if (tab.status === "error") {
    return <div style={{ ...emptyStyle, color: "#ef4444" }}>{tab.errorMessage || "Query error"}</div>;
  }
  if (!tab.rows.length) {
    return <div style={emptyStyle}>Query returned no rows.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "3px 8px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
        {tab.rows.length} of {tab.totalRows} rows · {(tab.elapsedMs / 1000).toFixed(2)}s
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: "monospace" }}>
          <thead style={{ position: "sticky", top: 0, background: "#1e293b", zIndex: 1 }}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{ padding: "5px 10px", textAlign: "left", cursor: "pointer", userSelect: "none", borderBottom: "2px solid #1e3a5f", color: "#93c5fd", whiteSpace: "nowrap", background: "#111827" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? "#0d1520" : "#0f1d2e" }}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ padding: "3px 10px", borderBottom: "1px solid #1a2535", color: "#cbd5e1", whiteSpace: "nowrap", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#64748b",
  fontFamily: "monospace",
  fontSize: 13,
};
