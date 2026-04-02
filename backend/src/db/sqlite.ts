import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'app.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const seedPath = path.join(__dirname, 'seed.sql');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  const hasWorkspacesTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'")
    .get();

  if (hasWorkspacesTable) {
    return;
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');

  db.exec(schemaSql);
  db.exec(seedSql);
}
