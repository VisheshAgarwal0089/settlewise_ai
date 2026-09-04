import { z } from 'zod';

const blankToUndefined = (value) => value === '' ? undefined : value;
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/settlewise.db'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  JWT_TTL: z.string().regex(/^\d+[smhd]$/).default('8h'),
  ADMIN_EMAIL: z.string().email().transform((value) => value.toLowerCase()),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$.{53}$/),
  RAZORPAY_KEY_ID: z.preprocess(blankToUndefined, z.string().optional()),
  RAZORPAY_KEY_SECRET: z.preprocess(blankToUndefined, z.string().optional()),
  RAZORPAY_API_BASE_URL: z.string().url().default('https://api.razorpay.com/v1'),
  RAZORPAY_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  GROQ_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  GROQ_API_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  MAX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(500),
  MAX_CSV_BYTES: z.coerce.number().int().positive().default(5242880),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

const defaults = {
  JWT_SECRET: 'development-only-secret-change-me-1234567890',
  ADMIN_EMAIL: 'admin@settlewise.local',
  ADMIN_PASSWORD_HASH: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx.5HjB5FP1is0hPS5.S0fY3H6u'
};

export function loadEnv(source = process.env) {
  const parsed = schema.safeParse({ ...defaults, ...source });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === defaults.JWT_SECRET) {
    throw new Error('Invalid environment: JWT_SECRET must be replaced in production');
  }
  return Object.freeze(parsed.data);
}

export const env = loadEnv();

