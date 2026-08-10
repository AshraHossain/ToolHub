import fs from "fs";
import path from "path";

// Lightweight JSON-file-backed "tables" - avoids native module build issues
// (e.g. better-sqlite3) while keeping a simple synchronous CRUD API that the
// rest of the app uses. Swappable for a real SQL database later.

const DB_DIR = path.join(__dirname, "..", "..", "data");

export type TableName =
  | "servers"
  | "tools"
  | "roles"
  | "permissions"
  | "role_assignments"
  | "health_checks"
  | "version_records"
  | "usage_events"
  | "approval_requests";

const ALL_TABLES: TableName[] = [
  "servers",
  "tools",
  "roles",
  "permissions",
  "role_assignments",
  "health_checks",
  "version_records",
  "usage_events",
  "approval_requests",
];

function filePath(table: TableName): string {
  return path.join(DB_DIR, table + ".json");
}

const cache = new Map<TableName, any[]>();

function load(table: TableName): any[] {
  if (cache.has(table)) {
    return cache.get(table) as any[];
  }
  const fp = filePath(table);
  let data: any[] = [];
  if (fs.existsSync(fp)) {
    try {
      data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    } catch (err) {
      data = [];
    }
  }
  cache.set(table, data);
  return data;
}

function save(table: TableName): void {
  const rows = cache.get(table);
  fs.writeFileSync(filePath(table), JSON.stringify(rows || [], null, 2));
}

export function initSchema(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  for (const table of ALL_TABLES) {
    if (!fs.existsSync(filePath(table))) {
      cache.set(table, []);
      save(table);
    }
  }
}

function findIndexById(rows: any[], id: string): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      return i;
    }
  }
  return -1;
}

export const store = {
  all<T = any>(table: TableName): T[] {
    return load(table).slice();
  },
  find<T = any>(table: TableName, predicate: (row: T) => boolean): T | undefined {
    return load(table).find(predicate as any);
  },
  filter<T = any>(table: TableName, predicate: (row: T) => boolean): T[] {
    return load(table).filter(predicate as any);
  },
  insert<T extends Record<string, any>>(table: TableName, row: T): T {
    const rows = load(table);
    rows.push(row);
    save(table);
    return row;
  },
  update<T extends { id: string }>(table: TableName, id: string, updates: Partial<T>): T | undefined {
    const rows = load(table);
    const idx = findIndexById(rows, id);
    if (idx === -1) {
      return undefined;
    }
    rows[idx] = Object.assign({}, rows[idx], updates);
    save(table);
    return rows[idx];
  },
  remove(table: TableName, id: string): boolean {
    const rows = load(table);
    const idx = findIndexById(rows, id);
    if (idx === -1) {
      return false;
    }
    rows.splice(idx, 1);
    save(table);
    return true;
  },
  removeWhere(table: TableName, predicate: (row: any) => boolean): number {
    const rows = load(table);
    const before = rows.length;
    const remaining = rows.filter(function (r) {
      return !predicate(r);
    });
    cache.set(table, remaining);
    save(table);
    return before - remaining.length;
  },
};
