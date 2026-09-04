import { Router } from 'express';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { SESSION_COOKIE } from '../../config/constants.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginSchema } from './schemas.js';

const cookieOptions = () => ({
  httpOnly: true, secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 8 * 60 * 60 * 1000, path: '/'
});

export function createAuthRouter(database) {
  const router = Router();
  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }),
    validateBody(loginSchema), async (req, res, next) => {
      const { email, password } = req.validatedBody;
      const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !(await compare(password, user.password_hash))) {
        const error = new Error('Invalid email or password'); error.status = 401; error.code = 'INVALID_CREDENTIALS';
        return next(error);
      }
      database.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
      const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: env.JWT_TTL, algorithm: 'HS256' });
      res.cookie(SESSION_COOKIE, token, cookieOptions()).json({ data: { id: user.id, email: user.email }, meta: {} });
    });
  router.post('/logout', requireAuth, (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions()).json({ data: { loggedOut: true }, meta: {} });
  });
  router.get('/me', requireAuth, (req, res) => res.json({ data: { id: req.user.id, email: req.user.email }, meta: {} }));
  return router;
}

