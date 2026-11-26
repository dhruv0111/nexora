import drafts from '../../../../../../prisma/draft-courses.json';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Workspace } from '@/components/workspace';
import { AdminCourseEditor } from '@/components/admin/course-editor';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function EditCourse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['ADMIN']);
  const course = await getDb().course.findUnique({
    where: { id: (await params).id },
    include: { modules: { orderBy: { startWeek: 'asc' } }, instructors: true },
  });
  if (!course) notFound();
  const mentors = await getDb().mentor.findMany({
    where: { user: { role: 'MENTOR' } },
    include: { user: { select: { name: true } } },
    take: 50,
  });
  return (
    <main id="main" className="dashboard-page admissions-admin">
      <Workspace role="ADMIN">
        <Link
          className="breadcrumb-link"
          href="/dashboard/admin/admissions?view=courses"
        >
          Course administration
        </Link>
        <h1>Edit {course.title}</h1>
        <div className="workflow-notice">
          Approve only against actual supplied source documents. Live payment
          activation is not supported by this phase. Editing course content
          invalidates content approval unless it is explicitly re-approved.
        </div>
        <AdminCourseEditor
          id={course.id}
          initial={{
            version: course.version,
            title: course.title,
            description: course.description,
            audience: course.audience,
            prerequisites: course.prerequisites,
            skills: course.skills,
            technologies: course.technologies,
            durationWeeks: 24,
            deliveryFormat: course.deliveryFormat,
            assessmentRequired: course.assessmentRequired,
            modules: (course.modules.length
              ? course.modules
              : (drafts.find((d) => d.track === course.track)?.modules ?? [])
            ).map(({ startWeek, title, summary, weeklyTopics }) => ({
              startWeek,
              title,
              summary,
              weeklyTopics,
            })),
            status: course.status,
            previewVisible: course.previewVisible,
            contentSource: course.contentSource ?? '',
            approveContent: false,
            priceMinor: course.priceMinor,
            currency: 'INR',
            approvePrice: false,
            termsVersion: course.termsVersion ?? '',
            enrollmentTerms: course.enrollmentTerms ?? '',
            refundPolicy: course.refundPolicy ?? '',
            approveTerms: false,
            mentorIds: course.instructors.map((i) => i.mentorId),
          }}
          mentors={mentors.map((m) => ({
            id: m.id,
            name: m.user.name ?? 'Unnamed mentor profile',
          }))}
        />
      </Workspace>
    </main>
  );
}
