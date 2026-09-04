import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { SESSION_COOKIE } from '../config/constants.js';

export function requireAuth(req, _res, next) {
  try {
    req.user = jwt.verify(req.cookies?.[SESSION_COOKIE], env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    const error = new Error('Authentication required');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    next(error);
  }
}

