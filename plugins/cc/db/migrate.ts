// tested with: claude code v2.1.118
import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
// Bun embeds the SQL string at compile time so `bun build --compile` ships a
// self-contained binary; from-source runs read the same string at startup.
import schemaSrc from "./schema.sql" with { type: "text" };

export function openDb(dbPath: string): Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schemaSrc);
  return db;
}
