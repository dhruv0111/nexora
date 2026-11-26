import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { learningPage } from '@/lib/learning/page-policy';
import { podBoard } from '@/lib/projects/read';
import { LearningShell, PageHeading, Empty } from '@/components/learning/shell';
import { displayTime } from '@/lib/learning/policy';
import { PodManagement, text } from '@/components/projects/pod-management';
import { ProjectForm } from '@/components/projects/forms';
const states = [
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'QA_TESTING',
  'DONE',
];
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireRole(['STUDENT', 'MENTOR', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role },
    podId = (await params).podId,
    q = await searchParams,
    d = await learningPage(() => podBoard(a, podId, q));
  return (
    <LearningShell role={a.role} active="projects">
      <Link href="/projects">All project workspaces</Link>
      <PageHeading eyebrow={d.p.project!.title} title={d.p.name}>
        A shared goal. Clear ownership. Reviewable evidence.
      </PageHeading>
      <div className="project-banner">
        Engagement: supervised training ·{' '}
        {d.p.project!.confidential
          ? 'Confidential project: portfolio export is blocked.'
          : 'Portfolio entries require a separate mentor review.'}{' '}
        · Ticket completion does not mean production deployment.
      </div>
      <div className="learn-link-row">
        <a href="#delivery-board">Delivery board</a>
        <a href="#pod-members">Pod members</a>
        <a href="#sprint-timeline">Sprints</a>
        <a href="#concerns">Blockers & security</a>
        <Link href="/projects/portfolio">My portfolio</Link>
      </div>
      <section className="learn-card" id="sprint-timeline">
        <h2>Sprint timeline</h2>
        {d.sprints.length ? (
          <div className="project-timeline">
            {d.sprints.map((sp) => (
              <article key={sp.id}>
                <span className="learn-tag">{sp.status}</span>
                <h3>{sp.name}</h3>
                <p>{sp.goal}</p>
                <small className="learn-meta">
                  {displayTime(sp.startsAt)} – {displayTime(sp.endsAt)} IST
                </small>
                {sp.retrospective && <p>{sp.retrospective}</p>}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No sprints planned yet." />
        )}
      </section>
      <section className="learn-card" id="delivery-board">
        <h2>Delivery board</h2>
        <form className="project-filter">
          <label>
            Search tickets
            <input name="q" defaultValue={q.q} maxLength={100} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={q.status ?? ''}>
              <option value="">All statuses</option>
              {states.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </label>
          <label>
            Sprint
            <select name="sprint" defaultValue={q.sprint ?? ''}>
              <option value="">All sprints</option>
              {d.sprints.map((sp) => (
                <option value={sp.id} key={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignments
            <select name="mine" defaultValue={q.mine ?? ''}>
              <option value="">All pod tickets</option>
              <option value="yes">Assigned to me</option>
            </select>
          </label>
          <button className="button button-secondary">Filter board</button>
        </form>
        <p className="learn-meta">
          Showing up to 24 matching tickets. Open a ticket to change status with
          keyboard-friendly controls.
        </p>
        <div
          className="project-board-scroll"
          role="region"
          aria-label="Kanban delivery board"
          tabIndex={0}
        >
          <div className="project-board">
            {states.map((st) => (
              <section className="project-column" key={st}>
                <h2>{st.replaceAll('_', ' ')}</h2>
                {d.tickets
                  .filter((t) => t.status === st)
                  .map((t) => (
                    <Link
                      href={`/projects/tickets/${t.id}`}
                      className="project-ticket"
                      key={t.id}
                    >
                      <span className="learn-tag">
                        {t.kind} · {t.priority}
                      </span>
                      <h3>{t.title}</h3>
                      <small>{t.assignee?.name ?? 'Unassigned'}</small>
                      <small>
                        {t.dueAt
                          ? `Due ${displayTime(t.dueAt)} IST`
                          : 'No deadline'}
                      </small>
                      <small>
                        {t._count.evidence} approved contribution(s)
                      </small>
                    </Link>
                  ))}
              </section>
            ))}
          </div>
        </div>
        <nav className="learn-pagination" aria-label="Board pagination">
          {d.page > 1 && (
            <Link
              href={`?page=${d.page - 1}&q=${encodeURIComponent(q.q ?? '')}&status=${q.status ?? ''}&mine=${q.mine ?? ''}&sprint=${q.sprint ?? ''}`}
            >
              Previous tickets
            </Link>
          )}
          {d.tickets.length === 24 && (
            <Link
              href={`?page=${d.page + 1}&q=${encodeURIComponent(q.q ?? '')}&status=${q.status ?? ''}&mine=${q.mine ?? ''}&sprint=${q.sprint ?? ''}`}
            >
              Next tickets
            </Link>
          )}
        </nav>
      </section>
      <div className="learn-grid">
        <section className="learn-card" id="pod-members">
          <h2>Your cross-functional pod</h2>
          {d.members.map((m) => (
            <article key={m.userId}>
              <h3>{m.user.name ?? 'Learner'}</h3>
              <span className="learn-tag">
                {m.discipline?.replaceAll('_', ' ') ?? 'Role pending'}
              </span>
              <p>{m.responsibility}</p>
              <small className="learn-meta">
                Joined {displayTime(m.joinedAt)} IST
                {m.leftAt ? ` · Ended ${displayTime(m.leftAt)} IST` : ''}
              </small>
            </article>
          ))}
        </section>
        <section className="learn-card" id="concerns">
          <h2>Blockers & security concerns</h2>
          {d.concerns.map((c) => (
            <details key={c.id}>
              <summary>
                {c.kind} · {c.resolvedAt ? 'Resolved' : 'Open'}
              </summary>
              <p>{c.description}</p>
              {c.resolution && <p>{c.resolution}</p>}
              {a.role !== 'STUDENT' && !c.resolvedAt && (
                <ProjectForm
                  action="concern"
                  values={{
                    id: c.id,
                    podId,
                    kind: c.kind,
                    description: c.description,
                  }}
                  fields={[
                    text(
                      'resolution',
                      'Resolution and follow-up',
                      '',
                      'textarea',
                    ),
                  ]}
                  button="Resolve concern"
                />
              )}
            </details>
          ))}
          <ProjectForm
            action="concern"
            values={{ podId, resolution: '' }}
            fields={[
              {
                name: 'kind',
                label: 'Concern type',
                type: 'select',
                options: [
                  { value: 'DELIVERY', label: 'Delivery blocker' },
                  { value: 'SECURITY', label: 'Security concern' },
                ],
              },
              text(
                'description',
                'Describe the concern without secrets',
                '',
                'textarea',
              ),
            ]}
            button="Escalate concern"
          />
        </section>
        <section className="learn-card">
          <h2>Release sign-offs</h2>
          {d.releases.length ? (
            d.releases.map((r) => (
              <article key={r.id}>
                <h3>{r.title}</h3>
                <span className="learn-tag">
                  {r.status} · Manual supervisor attestation
                </span>
                <p>{r.notes}</p>
                {r.deploymentUrl && (
                  <a
                    href={r.deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Deployment evidence
                  </a>
                )}
              </article>
            ))
          ) : (
            <Empty title="No release sign-off recorded." />
          )}
        </section>
        <section className="learn-card">
          <h2>Activity history</h2>
          {d.history.map((h) => (
            <p className="project-activity" key={h.id}>
              {h.action.replaceAll('_', ' ')}
              <small className="learn-meta">
                {displayTime(h.createdAt)} IST
              </small>
            </p>
          ))}
        </section>
      </div>
      {a.role !== 'STUDENT' && <PodManagement a={a} d={d} />}
    </LearningShell>
  );
}
