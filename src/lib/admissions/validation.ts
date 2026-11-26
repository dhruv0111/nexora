import { z } from 'zod';
export const educationSchema = z
  .object({
    qualification: z.string().trim().min(2).max(150),
    institution: z.string().trim().max(180).default(''),
    year: z
      .string()
      .regex(/^$|^(19|20)\d{2}$/)
      .default(''),
  })
  .strict();
export const applicantSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
    education: z.array(educationSchema).min(1).max(4),
    background: z.enum(['NON_TECHNICAL', 'TECHNICAL', 'STUDENT', 'OTHER']),
    backgroundDetails: z
      .string()
      .trim()
      .min(20, 'Describe your starting point in at least 20 characters.')
      .max(1500),
    careerGoals: z
      .string()
      .trim()
      .min(40, 'Describe your goals in at least 40 characters.')
      .max(2000),
    availability: z.enum(['5_10', '10_20', '20_PLUS']),
    timezone: z.string().trim().min(2).max(80),
    assessmentAnswers: z.array(z.string().trim().max(2000)).max(3).default([]),
    consent: z.boolean(),
  })
  .strict();
export type ApplicantDetails = z.infer<typeof applicantSchema>;
export const draftSchema = z
  .object({
    action: z.enum(['save', 'submit']),
    version: z.number().int().nonnegative(),
    details: z
      .object({
        fullName: z.string().max(100).optional(),
        education: z
          .array(
            z
              .object({
                qualification: z.string().max(150),
                institution: z.string().max(180).default(''),
                year: z.string().max(4).default(''),
              })
              .strict(),
          )
          .max(4)
          .optional(),
        background: z
          .enum(['NON_TECHNICAL', 'TECHNICAL', 'STUDENT', 'OTHER'])
          .optional(),
        backgroundDetails: z.string().max(1500).optional(),
        careerGoals: z.string().max(2000).optional(),
        availability: z.enum(['5_10', '10_20', '20_PLUS']).optional(),
        timezone: z.string().max(80).optional(),
        assessmentAnswers: z.array(z.string().max(2000)).max(3).optional(),
        consent: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
export const reviewSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum([
      'IN_REVIEW',
      'ASSESSMENT',
      'ACCEPTED',
      'REJECTED',
      'WAITLISTED',
    ]),
    assessmentStatus: z
      .enum(['PENDING', 'PASSED', 'NEEDS_REVIEW'])
      .default('PENDING'),
    note: z.string().trim().min(5).max(2000),
  })
  .strict();
export const transitions: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW', 'ASSESSMENT', 'WAITLISTED', 'REJECTED'],
  IN_REVIEW: ['ASSESSMENT', 'ACCEPTED', 'REJECTED', 'WAITLISTED'],
  ASSESSMENT: ['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED'],
  WAITLISTED: ['IN_REVIEW', 'ASSESSMENT', 'ACCEPTED', 'REJECTED'],
  ACCEPTED: ['ACCEPTED'],
  REJECTED: [],
  WITHDRAWN: [],
};
