// tested with: claude code v2.1.118
import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
// Bun embeds the SQL string at compile time so `bun build --compile` ships a
// self-contained binary; from-source runs read the same string at startup.
import schemaSrc from "./schema.sql" with { type: "text" };

/**
 * Open sessions.db at the resolved path. Creates parent dirs if needed, applies
 * the canonical schema (idempotent), then runs additive ALTER TABLE migrations
 * for any columns that were added in later schema versions and aren't present
 * on a pre-existing database.
 *
 * The v3 schema additions -- sessions.{project_root,branch,worktree_root} and
 * recent_files.{branch,worktree_root} -- are nullable so older code paths can
 * still read these tables before the writers are taught about them.
 */
export function openDb(dbPath: string): Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schemaSrc);
  applyAdditiveColumns(db, "sessions", [
    ["project_root", "TEXT"],
    ["branch", "TEXT"],
    ["worktree_root", "TEXT"],
  ]);
  applyAdditiveColumns(db, "recent_files", [
    ["branch", "TEXT"],
    ["worktree_root", "TEXT"],
  ]);
  // v3 indexes referencing columns added above. CREATE INDEX IF NOT EXISTS in
  // schema.sql cannot run before the ADD COLUMN, so they live here.
  for (const stmt of [
    "CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_root, ended_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_branch ON sessions(branch, ended_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_recent_files_branch ON recent_files(path, branch)",
    "CREATE INDEX IF NOT EXISTS idx_recent_files_worktree ON recent_files(path, worktree_root)",
  ]) {
    db.exec(stmt);
  }
  return db;
}

/**
 * SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. We introspect via
 * pragma_table_info, then ADD COLUMN only what's missing. Safe to call
 * repeatedly. Throws on any non-"duplicate column" error so genuine schema
 * corruption is loud.
 */
function applyAdditiveColumns(
  db: Database,
  table: string,
  columns: Array<[name: string, type: string]>,
): void {
  // pragma_table_info doesn't accept bound parameters in sqlite; the function
  // signature is `pragma_table_info('literal_table_name')`. Caller passes a
  // hardcoded table name from this file, never user input, so the
  // interpolation is safe; we still validate to prevent accidental
  // refactoring footguns.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(`applyAdditiveColumns: invalid table identifier ${table}`);
  }
  const present = new Set(
    (db.query(`SELECT name FROM pragma_table_info('${table}')`).all() as Array<{
      name: string;
    }>).map((r) => r.name),
  );
  for (const [name, type] of columns) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`applyAdditiveColumns: invalid column identifier ${name}`);
    }
    if (present.has(name)) continue;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/duplicate column/i.test(msg)) {
        throw new Error(`migrate: failed to add ${table}.${name}: ${msg}`);
      }
    }
  }
}

/**
 * Migrate cc state from the v2 location (~/.claude/cc/) to the v3 location
 * (~/.claude/channels/cc/) -- aligns with the imessage plugin's
 * ~/.claude/channels/imessage/ convention. Idempotent and safe to run on every
 * server start: noop if the new dir already exists or the legacy dir is absent.
 *
 * Strategy: rename the whole legacy directory in one atomic step. The sqlite
 * WAL companion files (-shm, -wal) follow because they live in the same dir.
 * A symlink is left at the old path so any external tooling still pointing at
 * it keeps working until the user removes the symlink manually.
 */
export function migrateLegacyStateDir(legacy: string, target: string): void {
  if (fs.existsSync(target)) return;
  if (!fs.existsSync(legacy)) return;
  // If legacy is already a symlink (e.g. previous migration), don't loop.
  try {
    if (fs.lstatSync(legacy).isSymbolicLink()) return;
  } catch {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.renameSync(legacy, target);
    fs.symlinkSync(target, legacy);
    process.stderr.write(
      `cc: migrated state dir ${legacy} -> ${target} (symlink left at old path)\n`,
    );
  } catch (err) {
    process.stderr.write(
      `cc: state-dir migration ${legacy} -> ${target} failed: ${err}\n`,
    );
  }
}
