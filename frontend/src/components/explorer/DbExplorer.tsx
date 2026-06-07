import { useState, useCallback, useEffect } from "react";
import { useConnections, type Connection } from "../../store/connections";
import { setTableNames, setColumnNames } from "../../lib/schemaCache";
import axios from "axios";

interface TreeNode {
  label: string;
  type: "connection" | "database" | "schema" | "table" | "view" | "column";
  connId: string;
  parentConnId?: string;
  path?: { db?: string; schema?: string; table?: string };
  meta?: string;
}

// Group PostgreSQL connections that share the same server (host+port+user).
// Other connection types (Athena, etc.) are each their own group.
interface ServerGroup {
  key: string;
  label: string;
  primaryConnId: string;
  connections: Connection[];
}

function buildGroups(connections: Connection[]): ServerGroup[] {
  const pgMap = new Map<string, Connection[]>();
  const others: Connection[] = [];

  for (const c of connections) {
    if (c.type === "postgres" && c.config?.host) {
      const k = `${c.config.host}:${c.config.port ?? 5432}:${c.config.user ?? ""}`;
      const arr = pgMap.get(k) ?? [];
      arr.push(c);
      pgMap.set(k, arr);
    } else {
      others.push(c);
    }
  }

  const groups: ServerGroup[] = [];

  for (const conns of pgMap.values()) {
    // Primary = first connected; label = primary's name
    const primary = conns.find((c) => c.status === "connected") ?? conns[0];
    groups.push({
      key: `pg::${primary.id}`,
      label: primary.name,
      primaryConnId: primary.id,
      connections: conns,
    });
  }

  for (const c of others) {
    groups.push({ key: `other::${c.id}`, label: c.name, primaryConnId: c.id, connections: [c] });
  }

  return groups;
}

interface Props { onInsert?: (text: string) => void }

export default function DbExplorer({ onInsert }: Props) {
  const { connections, activeId, setActive, fork } = useConnections();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [dbCache, setDbCache] = useState<Record<string, string[]>>({});
  const [childCache, setChildCache] = useState<Record<string, TreeNode[]>>({});
  const [dbForks, setDbForks] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const groups = buildGroups(connections);

  // Auto-expand the group whose primary matches activeId
  useEffect(() => {
    const group = groups.find((g) => g.connections.some((c) => c.id === activeId));
    if (!group) return;
    const nodeKey = `grp-${group.key}`;
    if (!expanded.has(nodeKey)) {
      setExpanded((s) => new Set(s).add(nodeKey));
      loadDatabases(group.primaryConnId, nodeKey);
    }
  }, [activeId]);

  const cacheKey = (...parts: string[]) => parts.join("::");

  // Find the connId to use for browsing a database under a group.
  // Priority: a group connection whose config.database matches → local fork → null.
  const getEffectiveConnId = (group: ServerGroup, dbName: string): string | null => {
    const match = group.connections.find(
      (c) => (c.config?.database as string) === dbName && c.status !== "error"
    );
    if (match) return match.id;
    return dbForks[`${group.primaryConnId}::${dbName}`] ?? null;
  };

  const loadDatabases = useCallback(async (primaryConnId: string, nodeKey: string) => {
    if (dbCache[primaryConnId]) return;
    setLoading((s) => new Set(s).add(nodeKey));
    try {
      const { data } = await axios.get<string[]>(
        `/api/connections/${primaryConnId}/explorer/databases`
      );
      setDbCache((c) => ({ ...c, [primaryConnId]: data }));
    } catch {
      setDbCache((c) => ({ ...c, [primaryConnId]: [] }));
    } finally {
      setLoading((s) => { const n = new Set(s); n.delete(nodeKey); return n; });
    }
  }, [dbCache]);

  const connectDatabase = async (group: ServerGroup, dbName: string, nodeKey: string) => {
    const forkKey = `${group.primaryConnId}::${dbName}`;
    setLoading((s) => new Set(s).add(nodeKey));
    try {
      const forked = await fork(group.primaryConnId, { database: dbName });
      setDbForks((f) => ({ ...f, [forkKey]: forked.id }));
      setExpanded((s) => new Set(s).add(nodeKey));
    } catch {
      // leave as not connected
    } finally {
      setLoading((s) => { const n = new Set(s); n.delete(nodeKey); return n; });
    }
  };

  const loadChildren = useCallback(async (node: TreeNode, nodeKey: string) => {
    const { connId, path } = node;
    const { db = "", schema } = path ?? {};
    const key = cacheKey(connId, db, schema ?? "", node.label);
    if (childCache[key]) return;

    setLoading((s) => new Set(s).add(nodeKey));
    try {
      let children: TreeNode[] = [];

      if (node.type === "database" && db) {
        const { data } = await axios.get<string[]>(
          `/api/connections/${connId}/explorer/databases/${db}/schemas`
        );
        children = data.map((s) => ({
          label: s, type: "schema" as const, connId, path: { db, schema: s },
        }));
      } else if (node.type === "schema" && db && schema) {
        const { data } = await axios.get<{ name: string; type: string }[]>(
          `/api/connections/${connId}/explorer/databases/${db}/schemas/${schema}/tables`
        );
        children = data.map((t) => ({
          label: t.name,
          type: t.type === "VIEW" ? "view" as const : "table" as const,
          connId, path: { db, schema, table: t.name },
        }));
        setTableNames(connId, schema, data.map((t) => t.name));
      } else if ((node.type === "table" || node.type === "view") && schema && path?.table) {
        const { data } = await axios.get<{ name: string; type: string }[]>(
          `/api/connections/${connId}/explorer/databases/${db}/schemas/${schema}/tables/${path.table}/columns`
        );
        children = data.map((c) => ({
          label: c.name, type: "column" as const, connId, meta: c.type, path,
        }));
        if (path.table) setColumnNames(connId, schema, path.table, data.map((c) => c.name));
      }

      setChildCache((c) => ({ ...c, [key]: children }));
    } finally {
      setLoading((s) => { const n = new Set(s); n.delete(nodeKey); return n; });
    }
  }, [childCache]);

  const toggle = (node: TreeNode, nodeKey: string) => {
    const isExp = expanded.has(nodeKey);
    if (!isExp && node.type !== "column") loadChildren(node, nodeKey);
    setExpanded((s) => {
      const n = new Set(s);
      isExp ? n.delete(nodeKey) : n.add(nodeKey);
      return n;
    });
  };

  const refreshGroup = (group: ServerGroup, nodeKey: string) => {
    setDbCache((c) => { const n = { ...c }; delete n[group.primaryConnId]; return n; });
    setChildCache((c) => {
      const n = { ...c };
      group.connections.forEach((gc) => {
        Object.keys(n).forEach((k) => { if (k.startsWith(gc.id)) delete n[k]; });
      });
      return n;
    });
    setExpanded((s) => new Set(s).add(nodeKey));
    loadDatabases(group.primaryConnId, nodeKey);
  };

  // Build database nodes for a group, computing the effective connId per database
  const buildDbNodes = (group: ServerGroup): TreeNode[] => {
    const dbs = dbCache[group.primaryConnId] ?? [];
    return dbs.map((db) => {
      const eff = getEffectiveConnId(group, db);
      return {
        label: db,
        type: "database" as const,
        connId: eff ?? group.primaryConnId,
        parentConnId: group.primaryConnId,
        path: { db },
      };
    });
  };

  const resolveChildren = (node: TreeNode, group?: ServerGroup): TreeNode[] | undefined => {
    if (node.type === "connection" && group) {
      return dbCache[group.primaryConnId] !== undefined ? buildDbNodes(group) : undefined;
    }
    const { db = "", schema } = node.path ?? {};
    return childCache[cacheKey(node.connId, db, schema ?? "", node.label)];
  };

  const insertText = (node: TreeNode) => {
    if (!onInsert) return;
    if (node.type === "table" || node.type === "view") {
      onInsert(node.path?.schema ? `${node.path.schema}.${node.label}` : node.label);
    } else {
      onInsert(node.label);
    }
  };

  const renderGroup = (group: ServerGroup) => {
    const nodeKey = `grp-${group.key}`;
    const isExp = expanded.has(nodeKey);
    const isLoadingNode = loading.has(nodeKey);
    const isActive = group.connections.some((c) => c.id === activeId);
    const children = isExp ? buildDbNodes(group) : undefined;

    const matchesSearch = !search || group.label.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch && !children?.length) return null;

    return (
      <div key={nodeKey}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 6px",
            cursor: "pointer",
            background: isActive ? "#0f2040" : "transparent",
            borderLeft: isActive ? "2px solid #2563eb" : "2px solid transparent",
            color: isActive ? "#e0eaff" : "#cbd5e1",
            fontSize: 12,
          }}
          onClick={() => {
            setActive(group.primaryConnId);
            const wasExp = expanded.has(nodeKey);
            if (!wasExp) loadDatabases(group.primaryConnId, nodeKey);
            setExpanded((s) => {
              const n = new Set(s);
              wasExp ? n.delete(nodeKey) : n.add(nodeKey);
              return n;
            });
          }}
        >
          <span style={{ color: "#4b5563", width: 10, flexShrink: 0, fontSize: 9 }}>
            {isExp ? "▼" : "▶"}
          </span>
          <span style={{ color: "#60a5fa", flexShrink: 0 }}>⚡</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {group.label}
          </span>
          <span style={{ color: "#4b5563", fontSize: 10, flexShrink: 0 }}>
            {group.connections[0].type}
          </span>
          {isLoadingNode && <span style={{ color: "#4b5563", fontSize: 10 }}>…</span>}
          <button
            onClick={(e) => { e.stopPropagation(); refreshGroup(group, nodeKey); }}
            title="Refresh"
            style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 11, padding: "0 2px", lineHeight: 1 }}
          >
            ↺
          </button>
        </div>
        {isExp && children && children.map((child, i) =>
          renderNode(child, `${nodeKey}-${i}`, 1, group)
        )}
      </div>
    );
  };

  const renderNode = (node: TreeNode, nodeKey: string, depth: number, group: ServerGroup): React.ReactNode => {
    const isExp = expanded.has(nodeKey);
    const isLoadingNode = loading.has(nodeKey);
    const hasChildren = node.type !== "column";
    const children = isExp ? resolveChildren(node, node.type === "connection" ? group : undefined) : undefined;

    const isDbNode = node.type === "database";
    const isDbConnected = isDbNode && node.parentConnId
      ? getEffectiveConnId(group, node.label) !== null
      : true;

    const matchesSearch = !search || node.label.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch && !children?.length) return null;

    return (
      <div key={nodeKey}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: `3px 6px 3px ${depth * 14 + 6}px`,
            cursor: hasChildren && (!isDbNode || isDbConnected) ? "pointer" : "default",
            color: "#cbd5e1",
            fontSize: 12,
          }}
          onClick={() => {
            if (hasChildren && (!isDbNode || isDbConnected)) toggle(node, nodeKey);
          }}
          onDoubleClick={() => { if (node.type !== "connection") insertText(node); }}
        >
          <span style={{ color: "#4b5563", width: 10, flexShrink: 0, fontSize: 9 }}>
            {hasChildren && (!isDbNode || isDbConnected) ? (isExp ? "▼" : "▶") : ""}
          </span>
          <span style={{ color: iconColor(node.type), flexShrink: 0 }}>{icon(node.type)}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.label}
          </span>
          {node.meta && (
            <span style={{ color: "#4b5563", fontSize: 10, flexShrink: 0 }}>{node.meta}</span>
          )}
          {isLoadingNode && <span style={{ color: "#4b5563", fontSize: 10 }}>…</span>}

          {isDbNode && !isDbConnected && !isLoadingNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                connectDatabase(group, node.label, nodeKey);
              }}
              title="Connect to this database"
              style={{ background: "#1d4ed8", border: "1px solid #2563eb", color: "#e0eaff", cursor: "pointer", fontSize: 10, padding: "1px 5px", borderRadius: 3, lineHeight: 1.4 }}
            >
              connect
            </button>
          )}
          {isDbNode && isDbConnected && (
            <span style={{ color: "#22c55e", fontSize: 10 }}>●</span>
          )}
        </div>
        {isExp && children && children.map((child, i) =>
          renderNode(child, `${nodeKey}-${i}`, depth + 1, group)
        )}
      </div>
    );
  };

  if (connections.length === 0) {
    return (
      <div style={{ padding: 16, color: "#4b5563", fontSize: 12 }}>
        No connections. Add one in the Connections tab.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 8px", borderBottom: "1px solid #1e293b", display: "flex", gap: 4 }}>
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, background: "#0d1520", border: "1px solid #1e293b", color: "#cbd5e1", padding: "3px 6px", borderRadius: 4, fontSize: 12 }}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto", paddingTop: 4 }}>
        {groups.map((g) => renderGroup(g))}
      </div>
    </div>
  );
}

const icon = (t: string) => (
  { connection: "⚡", database: "🗄", schema: "📁", table: "▤", view: "◫", column: "·" }[t] ?? ""
);
const iconColor = (t: string) => (
  { connection: "#60a5fa", database: "#818cf8", schema: "#a78bfa", table: "#34d399", view: "#fbbf24", column: "#4b5563" }[t] ?? "#cbd5e1"
);
