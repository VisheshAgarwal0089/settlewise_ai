import { z } from 'zod';

export const reviewNoteSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();
export const manualLinkSchema = z.object({
  settlementRecordId: z.string().min(1),
  note: z.string().trim().max(500).optional()
}).strict();

