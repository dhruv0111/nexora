import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { exportPortfolio } from '@/lib/projects/evidence';
import { LearningShell, PageHeading, Empty } from '@/components/learning/shell';
import { displayTime } from '@/lib/learning/policy';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await requireRole(['STUDENT', 'MENTOR', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role };
  const report = a.role === 'STUDENT' ? await exportPortfolio(a.id) : null,
    evidence =
      a.role === 'STUDENT'
        ? await getDb().contributionEvidence.findMany({
            where: { userId: a.id },
            select: {
              id: true,
              ticketId: true,
              summary: true,
              status: true,
              submittedAt: true,
              reviewedAt: true,
              reviewerId: true,
              ticket: {
                select: {
                  title: true,
                  pod: {
                    select: {
                      id: true,
                      name: true,
                      project: {
                        select: { title: true, engagementType: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
            take: 100,
          })
        : [];
  return (
    <LearningShell role={a.role} active="projects">
      <Link href="/projects">Project workspaces</Link>
      <PageHeading
        eyebrow="EVIDENCE YOU CAN EXPLAIN"
        title="Your project contribution portfolio."
      >
        Accurate descriptions, reviewed artifacts, and a clear account of what
        you built.
      </PageHeading>
      <div className="project-banner">
        Supervised training only. This report is not an employment, internship
        or apprenticeship certificate. Hours are omitted because no reliable
        time-recording process is connected. Private repository links and
        confidential artifacts are excluded from portfolio exports.
      </div>
      {a.role === 'STUDENT' && (
        <section className="learn-card">
          <h2>Approved portfolio entries</h2>
          <p>
            Both contribution approval and a separate publication review are
            required. Confidential projects remain excluded even when evidence
            is approved.
          </p>
          <a
            className="button button-primary"
            href="/api/projects/export"
            download="nexora-training-portfolio.json"
          >
            Export approved portfolio JSON
          </a>
          {report?.entries.length ? (
            report.entries.map((p) => (
              <article className="project-evidence" key={p.evidenceId}>
                <h3>{p.project}</h3>
                <p>{p.description}</p>
                <p>{p.challenges}</p>
                {p.mentorApprovedOutcome && (
                  <p>Reviewed outcome: {p.mentorApprovedOutcome}</p>
                )}
                <span className="learn-meta">
                  {p.source.replaceAll('_', ' ')} · {p.technologies.join(' · ')}
                </span>
              </article>
            ))
          ) : (
            <Empty title="No publication-approved entries yet.">
              Start with reviewed project evidence. Drafts and unverified claims
              are never exported.
            </Empty>
          )}
        </section>
      )}
      <section className="learn-card">
        <h2>Private contribution history</h2>
        <p className="learn-meta">
          Dates come from actual submissions and supervisor reviews. View your
          pod for recorded membership start/end dates and responsibilities.
        </p>
        {evidence.map((e) => (
          <article className="project-evidence" key={e.id}>
            <h3>
              {e.ticket.pod.project?.title ?? 'Training project'} ·{' '}
              {e.ticket.title}
            </h3>
            <span className="learn-tag">{e.status}</span>
            <p>{e.summary}</p>
            <span className="learn-meta">
              Submitted {displayTime(e.submittedAt)} IST ·{' '}
              {e.reviewedAt
                ? `Reviewed ${displayTime(e.reviewedAt)} IST`
                : 'Awaiting review'}
            </span>
            <Link href={`/projects/tickets/${e.ticketId}`}>
              Open evidence and supervisor feedback
            </Link>
          </article>
        ))}
      </section>
    </LearningShell>
  );
}
