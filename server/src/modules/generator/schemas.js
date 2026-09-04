import { z } from 'zod';

export const generateOrdersSchema = z.object({
  count: z.literal(150),
  seed: z.union([z.string().min(1).max(100), z.number().int()]).optional()
}).strict();
