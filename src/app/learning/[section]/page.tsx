import '@/styles/learning.css';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { DomainError } from '@/lib/domain/errors';
import { LearningShell, PageHeading } from '@/components/learning/shell';
import { StudentSection } from '@/components/learning/student-sections';
import { StaffSection } from '@/components/learning/staff-sections';
import { Support } from '@/components/learning/support';
export const dynamic = 'force-dynamic';
const titles: Record<string, string> = {
  courses: 'Your learning, in focus.',
  classes: 'Make space for learning.',
  assignments: 'Practice. Reflect. Improve.',
  assessments: 'Put your understanding to work.',
  announcements: 'Stay connected to your cohort.',
  support: 'You don’t have to figure it out alone.',
  history: 'The steps you’ve taken.',
  cohorts: 'A clear view of your cohort.',
  content: 'Build a thoughtful learning path.',
  instructors: 'The right guidance, in place.',
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const section = (await params).section;
  if (!titles[section]) notFound();
  const session = await requireRole(
    section === 'content' || section === 'instructors'
      ? ['ADMIN']
      : section === 'cohorts'
        ? ['MENTOR', 'ADMIN']
        : section === 'support'
          ? ['STUDENT', 'ADMIN']
          : ['STUDENT', 'MENTOR', 'ADMIN'],
  );
  const a = { id: session.user.id, role: session.user.role },
    q = await searchParams;
  let content: React.ReactNode;
  try {
    content =
      section === 'support'
        ? await Support({ actor: a, query: q })
        : a.role === 'STUDENT'
          ? await StudentSection({ userId: a.id, section, query: q })
          : await StaffSection({ actor: a, section, query: q });
  } catch (e) {
    if (e instanceof DomainError)
      return (
        <LearningShell role={a.role} active={section}>
          <PageHeading title="This learning resource is unavailable.">
            {e.status === 404
              ? 'The record was not found in your workspace.'
              : 'Your account does not have access to this resource.'}
          </PageHeading>
        </LearningShell>
      );
    throw e;
  }
  return (
    <LearningShell role={a.role} active={section}>
      <PageHeading title={titles[section]} />
      {content}
    </LearningShell>
  );
}
