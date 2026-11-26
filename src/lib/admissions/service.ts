import 'server-only';
import { getDb } from '@/lib/db';
import { audit, lock, serial } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import {
  applicantSchema,
  draftSchema,
  reviewSchema,
  transitions,
} from './validation';
export async function saveApplication(
  userId: string,
  slug: string,
  input: unknown,
) {
  const body = draftSchema.parse(input);
  return serial(async (tx) => {
    await lock(tx, `application:${userId}:${slug}`);
    const course = await tx.course.findUnique({ where: { slug } });
    ensure(
      course &&
        course.status !== 'ARCHIVED' &&
        (course.status === 'PUBLISHED' || course.previewVisible),
      404,
      'COURSE',
      'This course is unavailable.',
    );
    const current = await tx.application.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });
    if (current?.status !== 'DRAFT' && current)
      return {
        id: current.id,
        version: current.version,
        status: current.status,
        duplicate: true,
      };
    ensure(
      (current?.version ?? 0) === body.version,
      409,
      'VERSION',
      'A newer draft is saved. Reload before making further changes.',
    );
    // Drafts are partial but still field/size validated; submitted snapshots are complete.
    const details =
      body.action === 'submit'
        ? applicantSchema.parse(body.details)
        : body.details;
    if (body.action === 'submit') {
      ensure(
        details.consent === true,
        422,
        'CONSENT',
        'Agree to the application data notice to submit.',
      );
      if (course.assessmentRequired)
        ensure(
          details.assessmentAnswers?.length === 3 &&
            details.assessmentAnswers.every(
              (answer) => answer.trim().length >= 30,
            ),
          422,
          'ASSESSMENT',
          'Complete all three prerequisite questions with at least 30 characters each.',
        );
    }
    const data = {
      details,
      status:
        body.action === 'submit' ? ('SUBMITTED' as const) : ('DRAFT' as const),
      ...(body.action === 'submit'
        ? {
            submittedAt: new Date(),
            consentedAt: new Date(),
            consentVersion: 'application-v1',
          }
        : {}),
    };
    const record = current
      ? await tx.application.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.application.create({
          data: { ...data, userId, courseId: course.id },
        });
    await tx.applicantProfile.upsert({
      where: { userId },
      create: { userId, details },
      update: { details },
    });
    await audit(
      tx,
      userId,
      body.action === 'submit'
        ? 'APPLICATION_SUBMITTED'
        : 'APPLICATION_DRAFT_SAVED',
      'Application',
      record.id,
      { status: record.status, version: record.version, courseId: course.id },
    );
    return { id: record.id, version: record.version, status: record.status };
  });
}
export async function reviewApplication(
  adminId: string,
  id: string,
  input: unknown,
) {
  const body = reviewSchema.parse(input);
  return serial(async (tx) => {
    await lock(tx, `application-review:${id}`);
    const app = await tx.application.findUnique({
      where: { id },
      include: { course: true, enrollment: true },
    });
    ensure(app?.course, 404, 'APPLICATION', 'Application not found.');
    ensure(
      app.version === body.version,
      409,
      'VERSION',
      'This application changed. Reload before reviewing.',
    );
    ensure(
      transitions[app.status]?.includes(body.status),
      409,
      'TRANSITION',
      'That status transition is not permitted.',
    );
    if (body.status === 'ACCEPTED') {
      ensure(
        app.course.status === 'PUBLISHED' && app.course.contentApprovedAt,
        409,
        'CONTENT_APPROVAL',
        'Publish approved course content before admitting applicants.',
      );
      if (app.course.assessmentRequired)
        ensure(
          body.assessmentStatus === 'PASSED',
          409,
          'ASSESSMENT',
          'The prerequisite assessment must be reviewed and passed before acceptance.',
        );
    }
    const updated = await tx.application.update({
      where: { id },
      data: {
        status: body.status,
        assessmentStatus: body.assessmentStatus,
        reviewNote: body.note,
        reviewedAt: new Date(),
        version: { increment: 1 },
        ...(body.status === 'ACCEPTED'
          ? { admittedCourseVersion: app.course.contentVersion }
          : {}),
      },
    });
    await audit(tx, adminId, 'APPLICATION_REVIEWED', 'Application', id, {
      from: app.status,
      to: updated.status,
      assessmentStatus: body.assessmentStatus,
      version: updated.version,
    });
    return { id, status: updated.status, version: updated.version };
  });
}
export async function ownApplications(userId: string) {
  return getDb().application.findMany({
    where: { userId, courseId: { not: null } },
    include: {
      course: { select: { title: true, slug: true } },
      enrollment: { select: { id: true, status: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}
