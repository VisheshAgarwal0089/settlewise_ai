import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(200)
}).strict();

