import { z } from 'zod';
export const inquiryPrograms = [
  'qa-sdet',
  'full-stack',
  'ai-engineering',
  'data-analytics',
  'undecided',
] as const;
export const inquirySchema = z.object({
  name: z.string().trim().min(2, 'Enter at least two characters.').max(100),
  email: z
    .email('Enter a valid email address.')
    .trim()
    .max(254)
    .transform((v) => v.toLowerCase()),
  program: z.enum(inquiryPrograms, {
    error: 'Choose a program or select Not sure yet.',
  }),
  intent: z.enum(['program_interest', 'career_call']),
  message: z
    .string()
    .trim()
    .max(1000, 'Keep your message under 1,000 characters.')
    .default(''),
  consent: z.literal(true, {
    error: 'Please agree to the inquiry data notice.',
  }),
  website: z.string().max(0, 'Unable to accept this request.').default(''),
});
export type InquiryInput = z.infer<typeof inquirySchema>;
