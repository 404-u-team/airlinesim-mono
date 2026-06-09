// eslint-disable-next-line import-x/no-unresolved -- bun:sqlite is a Bun built-in module.
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Single SQLite database for all BFF game-state. Path is overridable via BFF_DB_PATH
// (tests use ":memory:"). Collections are stored as one JSON document per name, which
// keeps each storage module's existing read-modify-write logic intact while moving the
// durable store off fragile JSON files. Legacy JSON files are imported once on first read.
const isTest = typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test" || "expect" in globalThis);
const databasePath = process.env.BFF_DB_PATH ?? (isTest ? ":memory:" : resolve(import.meta.dir, "../../data/game-state/game.db"));

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

export const db = new Database(databasePath, { create: true });

db.run("PRAGMA journal_mode = WAL;");
db.run("CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, data TEXT NOT NULL);");

const readStatement = db.query<{ data: string }, [string]>("SELECT data FROM documents WHERE name = ?");
const writeStatement = db.query<unknown, [string, string]>(
  "INSERT INTO documents (name, data) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET data = excluded.data",
);

export function readDocument<TValue>(name: string, fallback: TValue, legacyJsonPath?: string): TValue {
  const row = readStatement.get(name);

  if (row) {
    return JSON.parse(row.data) as TValue;
  }

  if (legacyJsonPath && databasePath !== ":memory:" && existsSync(legacyJsonPath)) {
    try {
      const imported = JSON.parse(readFileSync(legacyJsonPath, "utf8")) as TValue;
      writeDocument(name, imported);

      return imported;
    } catch {
      // Fall through to the empty fallback on a malformed legacy file.
    }
  }

  return fallback;
}

export function writeDocument(name: string, value: unknown): void {
  writeStatement.run(name, JSON.stringify(value));
}
