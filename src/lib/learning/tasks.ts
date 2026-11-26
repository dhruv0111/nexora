import 'server-only';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { cohortAccess, studentAccess } from './policy';
import { httpsUrl } from './content';
const id = z.string().min(1).max(100);
export const rubricSchema = z
  .array(
    z
      .object({
        criterion: z.string().trim().min(3).max(160),
        points: z.number().int().min(1).max(100),
      })
      .strict(),
  )
  .min(1)
  .max(10);
export async function saveAssignment(actor: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version: z.number().int().nonnegative(),
      cohortId: id,
      title: z.string().trim().min(3).max(160),
      instructions: z.string().trim().min(20).max(10000),
      dueAt: z.iso.datetime(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
      allowResubmit: z.boolean(),
      rubric: rubricSchema,
      resourceUrl: httpsUrl,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await cohortAccess(actor, b.cohortId, tx);
    await lock(tx, `tasks:${b.cohortId}`);
    const current = b.id
      ? await tx.assignment.findFirst({
          where: { id: b.id, cohortId: b.cohortId },
        })
      : null;
    ensure(
      b.id ? current?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Assignment changed. Reload before saving.',
    );
    if (current)
      ensure(
        (await tx.submission.count({
          where: { assignmentId: current.id, state: { not: 'DRAFT' } },
        })) === 0 ||
          JSON.stringify(rubricSchema.parse(current.rubric)) ===
            JSON.stringify(b.rubric),
        409,
        'RUBRIC_LOCKED',
        'Rubrics cannot change after a submission.',
      );
    const data = {
      cohortId: b.cohortId,
      title: b.title,
      instructions: b.instructions,
      dueAt: new Date(b.dueAt),
      status: b.status,
      allowResubmit: b.allowResubmit,
      rubric: b.rubric,
      resourceUrl: b.resourceUrl || null,
    };
    const a = current
      ? await tx.assignment.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.assignment.create({ data });
    await audit(tx, actor.id, 'ASSIGNMENT_SAVED', 'Assignment', a.id, {
      version: a.version,
      status: a.status,
    });
    return { id: a.id };
  });
}
export const submissionSchema = z
  .object({
    assignmentId: id,
    enrollmentId: id,
    version: z.number().int().nonnegative(),
    action: z.enum(['save', 'submit']),
    body: z.string().trim().max(20000),
    repositoryUrl: httpsUrl,
  })
  .strict();
export async function submitAssignment(userId: string, input: unknown) {
  const b = submissionSchema.parse(input);
  return serial(async (tx) => {
    await lock(tx, `submission:${userId}:${b.assignmentId}`);
    const e = await studentAccess(userId, b.enrollmentId, tx);
    const a = await tx.assignment.findFirst({
      where: { id: b.assignmentId, cohortId: e.cohortId, status: 'PUBLISHED' },
    });
    ensure(a, 404, 'ASSIGNMENT', 'Assignment not found.');
    const current = await tx.submission.findUnique({
      where: { assignmentId_userId: { assignmentId: a.id, userId } },
    });
    // Exact retries of a final submission are harmless, including requests retried after a lost response.
    if (
      b.action === 'submit' &&
      current?.state === 'SUBMITTED' &&
      current.body === b.body &&
      current.repositoryUrl === b.repositoryUrl
    )
      return { id: current.id, version: current.version, state: current.state };
    ensure(
      (current?.version ?? 0) === b.version,
      409,
      'VERSION',
      'Submission changed. Reload before saving.',
    );
    ensure(
      !current ||
        current.state === 'DRAFT' ||
        (current.state === 'GRADED' && a.allowResubmit),
      409,
      'RESUBMIT',
      'Resubmission must be explicitly permitted after grading.',
    );
    ensure(
      a.dueAt && a.dueAt > new Date(),
      409,
      'DEADLINE',
      'The deadline has passed. Contact your mentor.',
    );
    if (b.action === 'submit')
      ensure(
        b.body.length >= 20 ||
          b.repositoryUrl ||
          (current &&
            (await tx.learningFile.count({
              where: { submissionId: current.id },
            })) > 0),
        422,
        'SUBMISSION',
        'Provide at least 20 characters, a repository link, or an uploaded file.',
      );
    if (current)
      await tx.submissionRevision.create({
        data: {
          submissionId: current.id,
          version: current.version,
          snapshot: JSON.parse(JSON.stringify(current)),
        },
      });
    const state = b.action === 'submit' ? 'SUBMITTED' : 'DRAFT';
    const data = {
      body: b.body,
      repositoryUrl: b.repositoryUrl,
      state,
      ...(b.action === 'submit' ? { submittedAt: new Date() } : {}),
      feedback: null,
      score: null,
      gradedAt: null,
      rubricScores: Prisma.DbNull,
    };
    const s = current
      ? await tx.submission.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.submission.create({
          data: { ...data, assignmentId: a.id, userId },
        });
    await audit(
      tx,
      userId,
      b.action === 'submit' ? 'ASSIGNMENT_SUBMITTED' : 'SUBMISSION_DRAFTED',
      'Submission',
      s.id,
      { version: s.version, assignmentId: a.id },
    );
    return { id: s.id, version: s.version, state: s.state };
  });
}
export async function gradeSubmission(actor: Actor, input: unknown) {
  const b = z
    .object({
      submissionId: id,
      version: z.number().int().positive(),
      feedback: z.string().trim().min(10).max(5000),
      scores: z.array(z.number().int().min(0).max(100)).min(1).max(10),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const s = await tx.submission.findUnique({
      where: { id: b.submissionId },
      include: { assignment: true },
    });
    ensure(s, 404, 'SUBMISSION', 'Submission not found.');
    await cohortAccess(actor, s.assignment.cohortId, tx);
    await lock(tx, `submission:${s.userId}:${s.assignmentId}`);
    const current = await tx.submission.findUniqueOrThrow({
      where: { id: s.id },
    });
    ensure(
      current.version === b.version && current.state === 'SUBMITTED',
      409,
      'VERSION',
      'Only the current submitted revision can be graded.',
    );
    const rubric = rubricSchema.parse(s.assignment.rubric);
    ensure(
      b.scores.length === rubric.length &&
        b.scores.every((n, i) => n <= rubric[i].points),
      422,
      'RUBRIC',
      'Scores must match the published rubric.',
    );
    await tx.submissionRevision.create({
      data: {
        submissionId: current.id,
        version: current.version,
        snapshot: JSON.parse(JSON.stringify(current)),
      },
    });
    const result = await tx.submission.update({
      where: { id: s.id },
      data: {
        score: b.scores.reduce((a, n) => a + n, 0),
        rubricScores: b.scores,
        feedback: b.feedback,
        graderId: actor.id,
        gradedAt: new Date(),
        state: 'GRADED',
        version: { increment: 1 },
      },
    });
    await audit(tx, actor.id, 'SUBMISSION_GRADED', 'Submission', s.id, {
      score: result.score,
      version: result.version,
      rubricVersion: s.assignment.version,
    });
    await tx.learningNotification.create({
      data: {
        userId: s.userId,
        title: `Feedback is ready: ${s.assignment.title}`,
        href: '/learning/assignments',
      },
    });
    return { id: s.id, score: result.score };
  });
}
export const questionsSchema = z
  .array(
    z
      .object({
        prompt: z.string().trim().min(5).max(1000),
        options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
        correctIndex: z.number().int().min(0).max(5),
      })
      .strict()
      .refine(
        (q) => q.correctIndex < q.options.length,
        'Answer must reference an option.',
      ),
  )
  .min(1)
  .max(30);
export async function saveQuiz(actor: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version: z.number().int().nonnegative(),
      cohortId: id,
      title: z.string().trim().min(3).max(160),
      questions: questionsSchema,
      passPercent: z.number().int().min(1).max(100),
      maxAttempts: z.number().int().min(1).max(10),
      dueAt: z.iso.datetime(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const c = await cohortAccess(actor, b.cohortId, tx);
    await lock(tx, `quiz:${b.id ?? b.cohortId}`);
    const old = b.id
      ? await tx.assessment.findFirst({ where: { id: b.id, cohortId: c.id } })
      : null;
    ensure(
      b.id ? old?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Assessment changed. Reload.',
    );
    if (old)
      ensure(
        (await tx.assessmentAttempt.count({
          where: { assessmentId: old.id },
        })) === 0 ||
          (JSON.stringify(questionsSchema.parse(old.questions)) ===
            JSON.stringify(b.questions) &&
            old.passPercent === b.passPercent &&
            old.maxAttempts === b.maxAttempts &&
            old.dueAt?.toISOString() === b.dueAt),
        409,
        'ATTEMPTS_EXIST',
        'Create a new assessment instead of modifying one with attempts.',
      );
    const data = {
      cohortId: c.id,
      courseId: c.courseId,
      title: b.title,
      questions: b.questions,
      maxScore: b.questions.length,
      passPercent: b.passPercent,
      maxAttempts: b.maxAttempts,
      dueAt: new Date(b.dueAt),
      status: b.status,
    };
    const a = old
      ? await tx.assessment.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.assessment.create({ data });
    await audit(tx, actor.id, 'ASSESSMENT_SAVED', 'Assessment', a.id, {
      version: a.version,
      status: a.status,
    });
    return { id: a.id };
  });
}
export async function attemptQuiz(userId: string, input: unknown) {
  const b = z
    .object({
      enrollmentId: id,
      assessmentId: id,
      version: z.number().int().positive(),
      requestKey: z.uuid(),
      answers: z.array(z.number().int().min(0).max(5)).min(1).max(30),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `quiz-attempt:${userId}:${b.assessmentId}`);
    const e = await studentAccess(userId, b.enrollmentId, tx);
    const quiz = await tx.assessment.findFirst({
      where: { id: b.assessmentId, cohortId: e.cohortId, status: 'PUBLISHED' },
    });
    ensure(quiz, 404, 'ASSESSMENT', 'Assessment not found.');
    const retry = await tx.assessmentAttempt.findUnique({
      where: { requestKey: b.requestKey },
    });
    if (retry) {
      ensure(
        retry.userId === userId &&
          retry.assessmentId === quiz.id &&
          JSON.stringify(retry.answers) === JSON.stringify(b.answers),
        409,
        'KEY_REUSE',
        'Use a new attempt key.',
      );
      return { id: retry.id, score: retry.score, passed: retry.passed };
    }
    ensure(
      quiz.version === b.version,
      409,
      'VERSION',
      'Assessment changed. Reload before attempting.',
    );
    ensure(
      quiz.dueAt && quiz.dueAt > new Date(),
      409,
      'DEADLINE',
      'Assessment deadline passed.',
    );
    ensure(
      (await tx.assessmentAttempt.count({
        where: { assessmentId: quiz.id, userId },
      })) < quiz.maxAttempts,
      409,
      'ATTEMPT_LIMIT',
      'No attempts remaining.',
    );
    const questions = questionsSchema.parse(quiz.questions);
    ensure(
      b.answers.length === questions.length &&
        b.answers.every((a, i) => a < questions[i].options.length),
      422,
      'ANSWERS',
      'Answer every question with a valid option.',
    );
    const score = questions.filter(
        (q, i) => q.correctIndex === b.answers[i],
      ).length,
      passed = (score / questions.length) * 100 >= quiz.passPercent;
    const a = await tx.assessmentAttempt.create({
      data: {
        assessmentId: quiz.id,
        userId,
        requestKey: b.requestKey,
        answers: b.answers,
        score,
        passed,
        submittedAt: new Date(),
        contentVersion: quiz.version,
      },
    });
    await audit(tx, userId, 'ASSESSMENT_ATTEMPTED', 'AssessmentAttempt', a.id, {
      assessmentId: quiz.id,
      score,
      passed,
      contentVersion: quiz.version,
    });
    return { id: a.id, score, passed };
  });
}
export async function assignmentForStudent(
  userId: string,
  enrollmentId: string,
  assignmentId: string,
) {
  const e = await studentAccess(userId, enrollmentId);
  const a = await getDb().assignment.findFirst({
    where: { id: assignmentId, cohortId: e.cohortId, status: 'PUBLISHED' },
    include: {
      submissions: {
        where: { userId },
        include: {
          attachments: { select: { id: true, name: true, size: true } },
        },
        take: 1,
      },
    },
  });
  ensure(a, 404, 'ASSIGNMENT', 'Assignment not found.');
  return a;
}
