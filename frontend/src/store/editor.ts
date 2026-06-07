import { create } from "zustand";

export interface Tab {
  id: string;
  title: string;
  sql: string;
  params: string;       // raw JSON string
  connectionId: string;
  rows: Record<string, unknown>[];
  totalRows: number;
  status: "idle" | "running" | "done" | "error" | "cancelled";
  elapsedMs: number;
  executionId: string | null;
  errorMessage: string;
}

const makeTab = (id: string): Tab => ({
  id,
  title: `Query ${id}`,
  sql: "",
  params: "{}",
  connectionId: "",
  rows: [],
  totalRows: 0,
  status: "idle",
  elapsedMs: 0,
  executionId: null,
  errorMessage: "",
});

interface EditorState {
  tabs: Tab[];
  activeTabId: string;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
}

let counter = 1;

export const useEditor = create<EditorState>((set) => ({
  tabs: [makeTab("1")],
  activeTabId: "1",

  addTab: () => {
    const id = String(++counter);
    set((s) => ({ tabs: [...s.tabs, makeTab(id)], activeTabId: id }));
  },

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? "") : s.activeTabId;
      return { tabs: tabs.length ? tabs : [makeTab(String(++counter))], activeTabId };
    }),

  setActive: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
}));
