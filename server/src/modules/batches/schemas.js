import { z } from 'zod';
import { SOURCE_MODES } from '../../config/constants.js';

export const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sourceMode: z.enum(SOURCE_MODES),
  requestedCount: z.number().int().min(1).max(500)
}).strict();

