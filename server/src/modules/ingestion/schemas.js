import { z } from 'zod';

const optionalIdentifier = z.string().trim().transform((value) => value || null);
export const csvRowSchema = z.object({
  entity_id: z.string().trim().min(1),
  type: z.enum(['payment', 'refund', 'transfer', 'adjustment']),
  amount: z.coerce.number().int().nonnegative(),
  currency: z.literal('INR'),
  fee: z.coerce.number().int().nonnegative(),
  tax: z.coerce.number().int().nonnegative(),
  credit: z.coerce.number().int().nonnegative(),
  debit: z.coerce.number().int().nonnegative(),
  settled: z.union([z.literal('0'), z.literal('1')]),
  created_at: z.coerce.number().int().positive(),
  settled_at: z.union([z.literal(''), z.coerce.number().int().positive()]),
  settlement_id: optionalIdentifier,
  settlement_utr: optionalIdentifier,
  order_id: optionalIdentifier,
  order_receipt: optionalIdentifier,
  payment_id: optionalIdentifier
}).strict();

