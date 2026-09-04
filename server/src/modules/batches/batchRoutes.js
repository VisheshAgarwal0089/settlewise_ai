import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { validateBody } from '../../middleware/validate.js';
import { createBatchSchema } from './schemas.js';
import { createBatch, getBatch } from './batchService.js';
import { fetchSettlementSchema } from '../ingestion/schemas.js';
import { importCsv, importRazorpay } from '../ingestion/ingestionService.js';
import { generateOrdersSchema } from '../generator/schemas.js';
import { generateOrders } from '../generator/generatorService.js';
import { reconcileBatch } from '../reconciliation/reconcileBatch.js';
import { exportBatchCsv } from '../exports/exportService.js';

export function createBatchRouter(database, { razorpayClient }) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_CSV_BYTES, files: 1 } });
  router.post('/', validateBody(createBatchSchema), (req, res) => res.status(201).json({ data: createBatch(database, req.validatedBody), meta: {} }));
  router.get('/:batchId', (req, res, next) => {
    const batch = getBatch(database, req.params.batchId);
    if (!batch) { const error = new Error('Batch not found'); error.status = 404; error.code = 'BATCH_NOT_FOUND'; return next(error); }
    res.json({ data: batch, meta: {} });
  });
  router.post('/:batchId/settlements/upload', upload.single('file'), (req, res, next) => {
    try {
      if (!req.file) { const error = new Error('A CSV file is required'); error.status = 400; error.code = 'FILE_REQUIRED'; throw error; }
      if (!req.file.originalname.toLowerCase().endsWith('.csv')) { const error = new Error('Only CSV files are accepted'); error.status = 400; error.code = 'CSV_FILE_REQUIRED'; throw error; }
      const result = importCsv(database, { batchId: req.params.batchId, buffer: req.file.buffer, originalName: req.file.originalname, userId: req.user.id, requestId: req.requestId });
      res.status(201).json({ data: result, meta: {} });
    } catch (error) { next(error); }
  });
  router.post('/:batchId/settlements/fetch', validateBody(fetchSettlementSchema), async (req, res, next) => {
    try { res.status(201).json({ data: await importRazorpay(database, { batchId: req.params.batchId, query: req.validatedBody, client: razorpayClient, userId: req.user.id, requestId: req.requestId }), meta: {} }); }
    catch (error) { next(error); }
  });
  router.post('/:batchId/orders/generate', validateBody(generateOrdersSchema), (req, res, next) => {
    try { res.status(201).json({ data: generateOrders(database, { batchId: req.params.batchId, ...req.validatedBody, userId: req.user.id, requestId: req.requestId }), meta: {} }); }
    catch (error) { next(error); }
  });
  router.post('/:batchId/reconcile', (req, res, next) => {
    try { res.json({ data: reconcileBatch(database, { batchId: req.params.batchId, userId: req.user.id, requestId: req.requestId }), meta: {} }); }
    catch (error) { next(error); }
  });
  router.get('/:batchId/export.csv', (req, res, next) => {
    try {
      const result = exportBatchCsv(database, { batchId: req.params.batchId, userId: req.user.id, requestId: req.requestId });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.content);
    } catch (error) { next(error); }
  });
  return router;
}
