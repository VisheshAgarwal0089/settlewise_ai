import { env } from './config/env.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { seedAdmin } from './db/seedAdmin.js';
import { createApp } from './app.js';

const database = openDatabase();
migrate(database);
seedAdmin(database);
const server = createApp(database).listen(env.PORT, '0.0.0.0', () => console.log(`SettleWise API listening on ${env.PORT}`));

function shutdown() {
  server.close(() => { database.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
