import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export function runGlobalMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      github_url TEXT,
      default_agent TEXT NOT NULL DEFAULT 'claude',
      last_opened TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function runProjectMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS swimlanes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      is_terminal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      swimlane_id TEXT NOT NULL REFERENCES swimlanes(id),
      position INTEGER NOT NULL,
      agent TEXT,
      session_id TEXT,
      worktree_path TEXT,
      branch_name TEXT,
      pr_number INTEGER,
      pr_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_swimlane_position ON tasks(swimlane_id, position);

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS swimlane_transitions (
      id TEXT PRIMARY KEY,
      from_swimlane_id TEXT NOT NULL REFERENCES swimlanes(id),
      to_swimlane_id TEXT NOT NULL REFERENCES swimlanes(id),
      skill_id TEXT NOT NULL REFERENCES skills(id),
      execution_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_transitions_from_to ON swimlane_transitions(from_swimlane_id, to_swimlane_id);
  `);

  // Seed default swimlanes if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM swimlanes').get() as { c: number };
  if (count.c === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT INTO swimlanes (id, name, position, color, is_terminal, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const defaults = [
      { name: 'Backlog', color: '#6b7280', terminal: 0 },
      { name: 'Planning', color: '#8b5cf6', terminal: 0 },
      { name: 'Running', color: '#3b82f6', terminal: 0 },
      { name: 'Review', color: '#f59e0b', terminal: 0 },
      { name: 'Done', color: '#10b981', terminal: 1 },
    ];
    // uuid is imported at the top of the file
    const tx = db.transaction(() => {
      defaults.forEach((lane, i) => {
        insert.run(uuidv4(), lane.name, i, lane.color, lane.terminal, now);
      });
    });
    tx();
  }
}
