const tableMap = new Map<string, string[]>();
const columnMap = new Map<string, string[]>();

export function setTableNames(connId: string, schema: string, names: string[]) {
  tableMap.set(`${connId}::${schema}`, names);
}

export function setColumnNames(connId: string, schema: string, table: string, names: string[]) {
  columnMap.set(`${connId}::${schema}::${table}`, names);
}

export function getAllTableNames(): string[] {
  const out = new Set<string>();
  tableMap.forEach((ns) => ns.forEach((n) => out.add(n)));
  return [...out];
}

export function getAllColumnNames(): string[] {
  const out = new Set<string>();
  columnMap.forEach((ns) => ns.forEach((n) => out.add(n)));
  return [...out];
}
