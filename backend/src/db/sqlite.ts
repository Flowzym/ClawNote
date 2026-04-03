import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

type SqliteScalar = string | number | null | Uint8Array;
type StatementParams = SqliteScalar[] | Record<string, SqliteScalar>;
type RowObject = Record<string, unknown>;

interface SqlJsStatementLike {
  bind(params?: StatementParams): void;
  step(): boolean;
  getAsObject(): RowObject;
  free(): void;
}

interface SqlJsDatabaseLike {
  run(sql: string, params?: StatementParams): void;
  prepare(sql: string): SqlJsStatementLike;
  export(): Uint8Array;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const rootDir = path.resolve(__dirname, '../../..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'app.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const seedPath = path.join(__dirname, 'seed.sql');

const sqlJsEntryPath = require.resolve('sql.js');
const sqlJsDistDir = path.dirname(sqlJsEntryPath);

function resolveSqlJsAsset(filename: string): string {
  return path.join(sqlJsDistDir, filename);
}

function normalizeParams(params: unknown[]): StatementParams | undefined {
  if (params.length === 0) {
    return undefined;
  }

  if (params.length === 1) {
    const [single] = params;

    if (Array.isArray(single)) {
      return single as SqliteScalar[];
    }

    if (single !== null && typeof single === 'object') {
      return single as Record<string, SqliteScalar>;
    }
  }

  return params as SqliteScalar[];
}

class PreparedStatementProxy {
  constructor(
    private readonly owner: SqliteDatabaseProxy,
    private readonly sql: string,
  ) {}

  all<T = RowObject>(...params: unknown[]): T[] {
    return this.owner.queryAll<T>(this.sql, params);
  }

  get<T = RowObject>(...params: unknown[]): T | undefined {
    return this.owner.queryOne<T>(this.sql, params);
  }

  run(...params: unknown[]) {
    return this.owner.runStatement(this.sql, params);
  }
}

class SqliteDatabaseProxy {
  private instance: SqlJsDatabaseLike | null = null;

  async initialize(): Promise<void> {
    if (this.instance) {
      return;
    }

    fs.mkdirSync(dataDir, { recursive: true });

    const SQL = await initSqlJs({
      locateFile: (file) => resolveSqlJsAsset(file),
    });

    const database = fs.existsSync(dbPath)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
      : new SQL.Database();

    this.instance = database as SqlJsDatabaseLike;

    this.instance.run('PRAGMA foreign_keys = ON;');

    const hasWorkspacesTable = this.queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ['workspaces'],
    );

    if (hasWorkspacesTable) {
      return;
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    const seedSql = fs.readFileSync(seedPath, 'utf-8');

    this.instance.run(schemaSql);
    this.instance.run(seedSql);

    this.persistSync();
  }

  prepare(sql: string): PreparedStatementProxy {
    return new PreparedStatementProxy(this, sql);
  }

  exec(sql: string): void {
    const database = this.ensureInitialized();
    database.run(sql);
    this.persistSync();
  }

  queryAll<T = RowObject>(sql: string, params: unknown[] = []): T[] {
    const database = this.ensureInitialized();
    const statement = database.prepare(sql);

    try {
      const normalizedParams = normalizeParams(params);

      if (normalizedParams !== undefined) {
        statement.bind(normalizedParams);
      }

      const rows: T[] = [];

      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }

      return rows;
    } finally {
      statement.free();
    }
  }

  queryOne<T = RowObject>(sql: string, params: unknown[] = []): T | undefined {
    return this.queryAll<T>(sql, params)[0];
  }

  runStatement(sql: string, params: unknown[] = []) {
    const database = this.ensureInitialized();
    const normalizedParams = normalizeParams(params);

    if (normalizedParams === undefined) {
      database.run(sql);
    } else {
      database.run(sql, normalizedParams);
    }

    const changesRow = this.queryOne<{ changes: number }>('SELECT changes() AS changes');

    this.persistSync();

    return {
      changes: Number(changesRow?.changes ?? 0),
    };
  }

  private ensureInitialized(): SqlJsDatabaseLike {
    if (!this.instance) {
      throw new Error('Datenbank wurde noch nicht initialisiert');
    }

    return this.instance;
  }

  private persistSync(): void {
    const database = this.ensureInitialized();
    const binary = database.export();
    fs.writeFileSync(dbPath, Buffer.from(binary));
  }
}

export const db = new SqliteDatabaseProxy();

export async function initializeDatabase(): Promise<void> {
  await db.initialize();
}
