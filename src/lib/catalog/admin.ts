import 'server-only';
import { z } from 'zod';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
export const moduleSchema = z
  .object({
    startWeek: z.number().int().min(1).max(24),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(10).max(1200),
    weeklyTopics: z.array(z.string().trim().min(5).max(250)).length(4),
  })
  .strict();
export const courseEditSchema = z
  .object({
    version: z.number().int().positive(),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(3000),
    audience: z.array(z.string().trim().min(5).max(300)).min(1).max(12),
    prerequisites: z.array(z.string().trim().min(5).max(400)).min(1).max(12),
    skills: z.array(z.string().trim().min(5).max(300)).min(1).max(20),
    technologies: z.array(z.string().trim().min(1).max(80)).min(1).max(15),
    durationWeeks: z.literal(24),
    deliveryFormat: z.string().trim().min(5).max(200),
    assessmentRequired: z.boolean(),
    modules: z.array(moduleSchema).length(6),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    previewVisible: z.boolean(),
    contentSource: z.string().trim().max(1000),
    approveContent: z.boolean(),
    priceMinor: z.number().int().min(100).max(100000000).nullable(),
    currency: z.literal('INR'),
    approvePrice: z.boolean(),
    termsVersion: z.string().trim().max(80),
    enrollmentTerms: z.string().trim().max(20000),
    refundPolicy: z.string().trim().max(20000),
    approveTerms: z.boolean(),
    mentorIds: z.array(z.string().max(100)).max(12),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      [...v.modules]
        .sort((a, b) => a.startWeek - b.startWeek)
        .some((m, i) => m.startWeek !== 1 + i * 4)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['modules'],
        message:
          'Modules must cover weeks 1–24 exactly, starting at 1, 5, 9, 13, 17, and 21.',
      });
  });
export async function editCourse(adminId: string, id: string, input: unknown) {
  const b = courseEditSchema.parse(input);
  return serial(async (tx) => {
    await lock(tx, `course:${id}`);
    const current = await tx.course.findUnique({
      where: { id },
      include: { modules: { orderBy: { startWeek: 'asc' } } },
    });
    ensure(current, 404, 'COURSE', 'Course not found.');
    ensure(
      current.version === b.version,
      409,
      'VERSION',
      'Course changed. Reload before saving.',
    );
    if (b.approveContent || b.approvePrice || b.approveTerms)
      ensure(
        b.contentSource.length >= 8,
        422,
        'SOURCE',
        'Provide the approved curriculum/prerequisite source reference.',
      );
    if (b.approvePrice)
      ensure(
        b.priceMinor !== null,
        422,
        'PRICE',
        'Enter an approved fee before approving pricing.',
      );
    if (b.approveTerms)
      ensure(
        b.termsVersion &&
          b.enrollmentTerms.length >= 100 &&
          b.refundPolicy.length >= 50,
        422,
        'TERMS',
        'Provide a version and approved enrollment/refund text.',
      );
    if (b.mentorIds.length) {
      const count = await tx.mentor.count({
        where: { id: { in: b.mentorIds }, user: { role: 'MENTOR' } },
      });
      ensure(
        count === new Set(b.mentorIds).size,
        422,
        'MENTOR',
        'Choose existing mentor-role profiles.',
      );
    }
    await tx.courseRevision.upsert({
      where: { courseId_version: { courseId: id, version: current.version } },
      update: {},
      create: {
        courseId: id,
        version: current.version,
        content: JSON.parse(JSON.stringify(current)),
      },
    });
    ensure(
      current.track !== 'AI_ENGINEERING' || b.assessmentRequired,
      422,
      'AI_ASSESSMENT',
      'AI Engineering must retain its technical prerequisite assessment.',
    );
    const now = new Date();
    const content = {
      title: b.title,
      description: b.description,
      audience: b.audience,
      prerequisites: b.prerequisites,
      skills: b.skills,
      technologies: b.technologies,
      durationWeeks: b.durationWeeks,
      deliveryFormat: b.deliveryFormat,
      assessmentRequired: b.assessmentRequired,
    };
    const changed =
      Object.entries(content).some(
        ([key, value]) =>
          JSON.stringify(current[key as keyof typeof current]) !==
          JSON.stringify(value),
      ) ||
      JSON.stringify(
        current.modules.map(({ startWeek, title, summary, weeklyTopics }) => ({
          startWeek,
          title,
          summary,
          weeklyTopics,
        })),
      ) !== JSON.stringify(b.modules);
    const priceChanged =
      current.priceMinor !== b.priceMinor || current.currency !== b.currency;
    const termsChanged =
      current.termsVersion !== b.termsVersion ||
      current.enrollmentTerms !== b.enrollmentTerms ||
      current.refundPolicy !== b.refundPolicy;
    const contentApprovedAt = b.approveContent
      ? now
      : changed
        ? null
        : current.contentApprovedAt;
    const priceApprovedAt = b.approvePrice
      ? now
      : priceChanged
        ? null
        : current.priceApprovedAt;
    const termsApprovedAt = b.approveTerms
      ? now
      : termsChanged
        ? null
        : current.termsApprovedAt;
    ensure(
      b.status !== 'PUBLISHED' || contentApprovedAt,
      422,
      'CONTENT',
      'Approved content is required before publication.',
    );
    const course = await tx.course.update({
      where: { id },
      data: {
        ...content,
        status: b.status,
        previewVisible: b.previewVisible,
        contentSource: b.contentSource || null,
        contentApprovedAt,
        priceMinor: b.priceMinor,
        currency: b.currency,
        priceApprovedAt,
        termsVersion: b.termsVersion || null,
        enrollmentTerms: b.enrollmentTerms || null,
        refundPolicy: b.refundPolicy || null,
        termsApprovedAt,
        version: { increment: 1 },
        contentVersion: { increment: changed ? 1 : 0 },
        priceVersion: { increment: priceChanged ? 1 : 0 },
      },
    });
    for (const item of b.modules) {
      await tx.curriculumModule.upsert({
        where: {
          courseId_startWeek: { courseId: id, startWeek: item.startWeek },
        },
        create: { ...item, courseId: id },
        update: item,
      });
    }
    await tx.courseInstructor.deleteMany({ where: { courseId: id } });
    if (b.mentorIds.length)
      await tx.courseInstructor.createMany({
        data: [...new Set(b.mentorIds)].map((mentorId) => ({
          courseId: id,
          mentorId,
        })),
      });
    await audit(tx, adminId, 'COURSE_UPDATED', 'Course', id, {
      version: course.version,
      status: course.status,
      contentVersion: course.contentVersion,
      priceVersion: course.priceVersion,
      contentApproved: !!contentApprovedAt,
      priceApproved: !!priceApprovedAt,
      termsApproved: !!termsApprovedAt,
    });
    return { id, version: course.version };
  });
}
export const cohortSchema = z
  .object({
    courseId: z.string().min(1).max(100),
    name: z.string().trim().min(3).max(100),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    capacity: z.number().int().min(1).max(10000),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    admissionsOpen: z.boolean(),
    mentorIds: z.array(z.string().max(100)).max(12),
  })
  .strict();
export async function createCohort(adminId: string, input: unknown) {
  const b = cohortSchema.parse(input);
  ensure(
    new Date(b.endsAt) > new Date(b.startsAt),
    422,
    'DATES',
    'End date must follow start date.',
  );
  return serial(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: b.courseId } });
    ensure(course, 404, 'COURSE', 'Course not found.');
    ensure(
      b.status !== 'PUBLISHED' ||
        (course.status === 'PUBLISHED' && course.contentApprovedAt),
      409,
      'APPROVAL',
      'Publish approved course content first.',
    );
    if (b.mentorIds.length)
      ensure(
        (await tx.mentor.count({
          where: { id: { in: b.mentorIds }, user: { role: 'MENTOR' } },
        })) === new Set(b.mentorIds).size,
        422,
        'MENTOR',
        'Choose existing mentor profiles.',
      );
    const c = await tx.cohort.create({
      data: {
        courseId: b.courseId,
        name: b.name,
        startsAt: new Date(b.startsAt),
        endsAt: new Date(b.endsAt),
        capacity: b.capacity,
        status: b.status,
        admissionsOpen: b.admissionsOpen,
        mentors: {
          create: [...new Set(b.mentorIds)].map((mentorId) => ({ mentorId })),
        },
      },
    });
    await audit(tx, adminId, 'COHORT_CREATED', 'Cohort', c.id, {
      courseId: c.courseId,
      capacity: c.capacity,
      status: c.status,
    });
    return { id: c.id };
  });
}
