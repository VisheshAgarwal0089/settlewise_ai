import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { resetAllData } from './resetService.js';

const resetSchema = z.object({ confirmation: z.literal('RESET ALL DATA') }).strict();

export function createResetRouter(database) {
  const router = Router();
  router.delete('/', validateBody(resetSchema), (req, res, next) => {
    try { res.json({ data: resetAllData(database, { confirmation: req.validatedBody.confirmation, userId: req.user.id, requestId: req.requestId }), meta: {} }); } catch (error) { next(error); }
  });
  return router;
}
