import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { openDatabase } from './connection.js';
import { migrate } from './migrate.js';

export function seedAdmin(database) {
  const email = env.ADMIN_EMAIL.toLowerCase();
  database.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
  `).run(randomUUID(), email, env.ADMIN_PASSWORD_HASH, new Date().toISOString());
  return database.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const database = openDatabase();
  migrate(database);
  const user = seedAdmin(database);
  database.close();
  console.log(`Seeded ${user.email}`);
}

