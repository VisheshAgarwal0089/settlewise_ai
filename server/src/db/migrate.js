import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './connection.js';

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrate(database) {
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = database.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');
  const record = database.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const apply = database.transaction((name, sql) => {
    database.exec(sql);
    record.run(name, new Date().toISOString());
  });
  for (const name of readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort()) {
    if (!applied.get(name)) apply(name, readFileSync(join(migrationDirectory, name), 'utf8'));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const database = openDatabase();
  migrate(database);
  database.close();
  console.log('Migrations complete');
}

