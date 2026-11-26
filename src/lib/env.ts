import { z } from 'zod';
const optional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().optional(),
);
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.url().optional(),
    ),
    NEXTAUTH_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.url().optional(),
    ),
    NEXTAUTH_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(32).optional(),
    ),
    LEAD_FORM_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(32).optional(),
    ),
    INQUIRY_ORIGIN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.url().optional(),
    ),
    INQUIRY_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    RAZORPAY_MODE: z.enum(['disabled', 'test']).default('disabled'),
    RAZORPAY_KEY_ID: optional,
    RAZORPAY_KEY_SECRET: optional,
    RAZORPAY_WEBHOOK_SECRET: optional,
    CAREER_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3650)
      .default(365),
    GITHUB_PROJECT_TOKEN: optional,
    GITHUB_PROJECT_WEBHOOK_SECRET: optional,
    GITHUB_ID: optional,
    GITHUB_SECRET: optional,
  })
  .superRefine((v, ctx) => {
    if (v.RAZORPAY_KEY_ID && !v.RAZORPAY_KEY_ID.startsWith('rzp_test_'))
      ctx.addIssue({
        code: 'custom',
        path: ['RAZORPAY_KEY_ID'],
        message: 'Only Razorpay test keys are supported in this phase.',
      });
    if (
      v.RAZORPAY_MODE === 'test' &&
      (!v.RAZORPAY_KEY_ID ||
        !v.RAZORPAY_KEY_SECRET ||
        !v.RAZORPAY_WEBHOOK_SECRET)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Test payments require all Razorpay credentials.',
      });
    if (v.DATABASE_URL && !/^postgres(ql)?:/.test(v.DATABASE_URL))
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'PostgreSQL URL required',
      });
    if (v.INQUIRY_ORIGIN && !/^https?:/.test(v.INQUIRY_ORIGIN))
      ctx.addIssue({
        code: 'custom',
        path: ['INQUIRY_ORIGIN'],
        message: 'HTTP or HTTPS origin required',
      });
    if (v.NEXTAUTH_URL && !/^https?:/.test(v.NEXTAUTH_URL))
      ctx.addIssue({
        code: 'custom',
        path: ['NEXTAUTH_URL'],
        message: 'HTTP or HTTPS URL required',
      });

    if (Boolean(v.GITHUB_ID) !== Boolean(v.GITHUB_SECRET))
      ctx.addIssue({
        code: 'custom',
        message: 'Both GitHub credentials are required',
      });
    if (
      v.GITHUB_ID &&
      (!v.DATABASE_URL || !v.NEXTAUTH_SECRET || !v.NEXTAUTH_URL)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Authentication requires DATABASE_URL, NEXTAUTH_SECRET and NEXTAUTH_URL',
      });
  });
export function readEnv(
  input: Record<string, string | undefined> = process.env,
) {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((i) => i.path.join('.') || i.message).join(', ')}`,
    );
  return result.data;
}
export const env = readEnv();
export const authConfigured = Boolean(
  env.DATABASE_URL && env.NEXTAUTH_SECRET && env.NEXTAUTH_URL,
);
