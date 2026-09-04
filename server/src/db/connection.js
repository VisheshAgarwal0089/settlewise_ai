import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';

export function openDatabase(databasePath = env.DATABASE_PATH) {
  const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(process.cwd(), databasePath);
  if (resolvedPath !== ':memory:') mkdirSync(dirname(resolvedPath), { recursive: true });
  const database = new Database(resolvedPath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  return database;
}

