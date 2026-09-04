import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { APP_VERSION } from './config/constants.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { createAuthRouter } from './modules/auth/authRoutes.js';
import { verifyAuditChain } from './modules/audit/auditService.js';

const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApp(database) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use((req, _res, next) => {
    if (mutating.has(req.method) && req.path !== '/api/v1/auth/login' && req.get('origin') !== env.CLIENT_ORIGIN) {
      const error = new Error('Request origin is not allowed'); error.status = 403; error.code = 'ORIGIN_NOT_ALLOWED';
      return next(error);
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_req, res, next) => {
    try {
      database.prepare('SELECT 1').get();
      res.json({ status: 'ok', version: APP_VERSION, database: 'ok' });
    } catch (error) { next(error); }
  });
  app.use('/api/v1/auth', createAuthRouter(database));
  app.use('/api/v1', requireAuth, rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  app.get('/api/v1/audit-logs/verify', (req, res) => res.json({ data: verifyAuditChain(database, req.query.batchId), meta: {} }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

