import { create } from "zustand";
import axios from "axios";

export type ConnStatus = "connected" | "disconnected" | "error";

export interface Connection {
  id: string;
  name: string;
  type: "postgres" | "athena";
  status: ConnStatus;
  error?: string;
  config?: Record<string, unknown>;
}

interface ConnectionsState {
  connections: Connection[];
  activeId: string | null;
  fetch: () => Promise<void>;
  add: (name: string, type: string, config: object) => Promise<Connection>;
  remove: (id: string) => Promise<void>;
  reconnect: (id: string) => Promise<void>;
  fork: (id: string, configOverrides: object) => Promise<Connection>;
  setActive: (id: string) => void;
}

export const useConnections = create<ConnectionsState>((set) => ({
  connections: [],
  activeId: null,

  fetch: async () => {
    const { data } = await axios.get<Connection[]>("/api/connections");
    set({ connections: data });
  },

  add: async (name, type, config) => {
    const { data } = await axios.post<Connection>("/api/connections", { name, type, config });
    // Always re-fetch so the list reflects server state regardless of any partial errors
    const { data: list } = await axios.get<Connection[]>("/api/connections");
    set((s) => ({ connections: list, activeId: s.activeId ?? data.id }));
    return data;
  },

  remove: async (id) => {
    await axios.delete(`/api/connections/${id}`);
    const { data: list } = await axios.get<Connection[]>("/api/connections");
    set((s) => ({
      connections: list,
      activeId: s.activeId === id ? (list[0]?.id ?? null) : s.activeId,
    }));
  },

  reconnect: async (id) => {
    await axios.post<Connection>(`/api/connections/${id}/reconnect`);
    const { data: list } = await axios.get<Connection[]>("/api/connections");
    set({ connections: list });
  },

  fork: async (id, configOverrides) => {
    const { data } = await axios.post<Connection>(`/api/connections/${id}/fork`, { config: configOverrides });
    const { data: list } = await axios.get<Connection[]>("/api/connections");
    set((s) => ({ connections: list, activeId: s.activeId ?? data.id }));
    return data;
  },

  setActive: (id) => set({ activeId: id }),
}));
