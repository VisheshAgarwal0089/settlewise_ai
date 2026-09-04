import { z } from 'zod';

const optionalIdentifier = z.union([z.string(), z.null(), z.undefined()]).transform((value) => typeof value === 'string' ? value.trim() || null : null);
const integer = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().nonnegative());
const positiveTimestamp = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().positive());
const optionalTimestamp = z.union([z.literal(''), z.null(), z.undefined(), positiveTimestamp]).transform((value) => value === '' || value == null ? null : value);
const settledValue = z.union([z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1')]).transform((value) => value === true || value === 1 || value === '1');

export const sourceRecordSchema = z.object({
  entity_id: z.string().trim().min(1),
  type: z.enum(['payment', 'refund', 'transfer', 'adjustment']),
  amount: integer,
  currency: z.literal('INR'),
  fee: integer,
  tax: integer,
  credit: integer,
  debit: integer,
  settled: settledValue,
  created_at: positiveTimestamp,
  settled_at: optionalTimestamp,
  settlement_id: optionalIdentifier,
  settlement_utr: optionalIdentifier,
  order_id: optionalIdentifier,
  order_receipt: optionalIdentifier,
  payment_id: optionalIdentifier
}).strict();

export const csvRowSchema = sourceRecordSchema;
export const fetchSettlementSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).optional()
}).strict();
