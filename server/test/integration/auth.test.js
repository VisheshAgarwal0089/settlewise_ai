import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { createApp } from '../../src/app.js';

let database; let app;
beforeEach(() => { database = openDatabase(':memory:'); migrate(database); database.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run('user-1', 'admin@settlewise.local', hashSync('correct-password', 4), new Date().toISOString()); app = createApp(database); });
afterEach(() => database.close());

describe('health and authentication', () => {
  it('reports database health', async () => { const response = await request(app).get('/health'); expect(response.status).toBe(200); expect(response.body.database).toBe('ok'); });
  it('logs in and accesses current user', async () => { const agent = request.agent(app); const login = await agent.post('/api/v1/auth/login').send({ email: 'ADMIN@settlewise.local', password: 'correct-password' }); expect(login.status).toBe(200); const current = await agent.get('/api/v1/auth/me'); expect(current.status).toBe(200); expect(current.body.data.email).toBe('admin@settlewise.local'); });
  it('rejects invalid credentials', async () => { const response = await request(app).post('/api/v1/auth/login').send({ email: 'admin@settlewise.local', password: 'wrong' }); expect(response.status).toBe(401); expect(response.body.error.code).toBe('INVALID_CREDENTIALS'); });
});

