import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { approveMatch, getMatchDetail, manualLinkMatch, rejectMatch } from './reviewService.js';
import { manualLinkSchema, reviewNoteSchema } from './schemas.js';
import { explainMatch } from '../explanations/explanationService.js';

export function createReviewRouter(database, { groqClient }) {
  const router = Router();
  router.get('/:matchId', (req, res, next) => {
    try { res.json({ data: getMatchDetail(database, req.params.matchId), meta: {} }); } catch (error) { next(error); }
  });
  router.post('/:matchId/approve', validateBody(reviewNoteSchema), (req, res, next) => {
    try { res.json({ data: approveMatch(database, { matchId: req.params.matchId, userId: req.user.id, requestId: req.requestId, ...req.validatedBody }), meta: {} }); } catch (error) { next(error); }
  });
  router.post('/:matchId/reject', validateBody(reviewNoteSchema), (req, res, next) => {
    try { res.json({ data: rejectMatch(database, { matchId: req.params.matchId, userId: req.user.id, requestId: req.requestId, ...req.validatedBody }), meta: {} }); } catch (error) { next(error); }
  });
  router.post('/:matchId/manual-link', validateBody(manualLinkSchema), (req, res, next) => {
    try { res.json({ data: manualLinkMatch(database, { matchId: req.params.matchId, userId: req.user.id, requestId: req.requestId, ...req.validatedBody }), meta: {} }); } catch (error) { next(error); }
  });
  router.post('/:matchId/explanation/retry', async (req, res, next) => {
    try { res.json({ data: await explainMatch(database, { matchId: req.params.matchId, client: groqClient }), meta: {} }); } catch (error) { next(error); }
  });
  return router;
}
