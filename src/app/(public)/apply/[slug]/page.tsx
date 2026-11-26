import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { ApplicationWizard } from '@/components/admissions/application-wizard';
import { applicantPage } from '@/lib/admissions/page-auth';
import { getDb } from '@/lib/db';
import type { ApplicantDetails } from '@/lib/admissions/validation';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function Apply({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const who = await applicantPage(`/apply/${slug}`);
  const course = await getDb().course.findUnique({ where: { slug } });
  if (
    !course ||
    course.status === 'ARCHIVED' ||
    (course.status !== 'PUBLISHED' && !course.previewVisible)
  )
    notFound();
  const [app, profile] = await Promise.all([
    getDb().application.findUnique({
      where: { userId_courseId: { userId: who.id, courseId: course.id } },
    }),
    getDb().applicantProfile.findUnique({ where: { userId: who.id } }),
  ]);
  if (app && app.status !== 'DRAFT') redirect(`/applications/${app.id}`);
  const initial = (app?.details ??
    profile?.details ??
    {}) as Partial<ApplicantDetails>;
  return (
    <main id="main" className="admissions-page">
      <Container>
        <p className="eyebrow">LEARN WITH PURPOSE. APPLY WITH CLARITY.</p>
        <h1>Start your next chapter.</h1>
        {!course.contentApprovedAt && (
          <div className="catalog-notice">
            This course is a planning preview. Your application can be saved and
            reviewed, but acceptance requires approved content, and payment
            remains gated by approved fees, dates, and legal terms.
          </div>
        )}
        <ApplicationWizard
          slug={slug}
          title={course.title}
          assessmentRequired={course.assessmentRequired}
          initial={
            app
              ? initial
              : { ...initial, assessmentAnswers: ['', '', ''], consent: false }
          }
          initialVersion={app?.version ?? 0}
        />
      </Container>
    </main>
  );
}
