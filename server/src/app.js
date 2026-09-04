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
import { createAuditRouter } from './modules/audit/auditRoutes.js';
import { createBatchRouter } from './modules/batches/batchRoutes.js';
import { razorpayClient as defaultRazorpayClient } from './providers/razorpayClient.js';
import { groqClient as defaultGroqClient } from './providers/groqClient.js';
import { createReviewRouter } from './modules/reviews/reviewRoutes.js';
import { createResetRouter } from './modules/exports/resetRoutes.js';

const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApp(database, { razorpayClient = defaultRazorpayClient, groqClient = defaultGroqClient } = {}) {
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
  app.use('/api/v1/batches', createBatchRouter(database, { razorpayClient }));
  app.use('/api/v1/matches', createReviewRouter(database, { groqClient }));
  app.use('/api/v1/data', createResetRouter(database));
  app.use('/api/v1/audit-logs', createAuditRouter(database));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
