import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ticketRead } from '@/lib/projects/read';
import { learningPage } from '@/lib/learning/page-policy';
import { allowedTransition } from '@/lib/projects/policy';
import { LearningShell, PageHeading } from '@/components/learning/shell';
import { ProjectForm, EvidenceUpload } from '@/components/projects/forms';
import { text } from '@/components/projects/pod-management';
import { displayTime } from '@/lib/learning/policy';
import { githubApi } from '@/lib/projects/github';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireRole(['STUDENT', 'MENTOR', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role },
    id = (await params).id,
    d = await learningPage(() => ticketRead(a, id)),
    t = d.t,
    staff = a.role !== 'STUDENT';
  const [members, sprints] = staff
    ? await Promise.all([
        getDb().podMember.findMany({
          where: { podId: t.podId, leftAt: null },
          include: { user: { select: { name: true } } },
          take: 100,
        }),
        getDb().projectSprint.findMany({
          where: { podId: t.podId, status: { in: ['PLANNED', 'ACTIVE'] } },
          take: 30,
        }),
      ])
    : [[], []];
  const next = [
    'BACKLOG',
    'READY',
    'IN_PROGRESS',
    'IN_REVIEW',
    'QA_TESTING',
    'DONE',
  ].filter((status) => allowedTransition(t.status, status, !staff));
  return (
    <LearningShell role={a.role} active="projects">
      <Link href={`/projects/${t.podId}`}>{d.p.name} / Delivery board</Link>
      <PageHeading eyebrow={`${t.kind} · ${t.priority}`} title={t.title}>
        {t.assignee?.name ?? 'Unassigned'} · {t.sprint?.name ?? 'Backlog'} ·
        Revision {t.version}
      </PageHeading>
      <div className="project-columns">
        <div>
          <section className="learn-card">
            <span className="learn-tag">{t.status}</span>
            {staff &&
              ['BACKLOG', 'READY', 'IN_PROGRESS'].includes(t.status) && (
                <details>
                  <summary>Edit ticket scope or assignment</summary>
                  <p>
                    Changing delivery requirements invalidates existing evidence
                    approvals and publication reviews.
                  </p>
                  <ProjectForm
                    key={t.version}
                    action="ticket"
                    values={{ id: t.id, podId: t.podId, version: t.version }}
                    fields={[
                      text('title', 'Edit ticket title', t.title),
                      text(
                        'requirements',
                        'Edit technical requirements',
                        t.requirements,
                        'textarea',
                      ),
                      text(
                        'acceptance',
                        'Edit acceptance criteria (one per line)',
                        t.acceptance.join('\n'),
                        'lines',
                      ),
                      text(
                        'definitionOfDone',
                        'Edit Definition of Done (one per line)',
                        t.definitionOfDone.join('\n'),
                        'lines',
                      ),
                      {
                        name: 'sprintId',
                        label: 'Assigned sprint',
                        type: 'select',
                        value: t.sprintId ?? '',
                        options: [
                          { value: '', label: 'Backlog' },
                          ...sprints.map((s) => ({
                            value: s.id,
                            label: s.name,
                          })),
                        ],
                      },
                      {
                        name: 'assigneeId',
                        label: 'Assigned learner',
                        type: 'select',
                        value: t.assigneeId ?? '',
                        options: [
                          { value: '', label: 'Unassigned' },
                          ...members.map((m) => ({
                            value: m.userId,
                            label: m.user.name ?? m.userId,
                          })),
                        ],
                      },
                      {
                        name: 'priority',
                        label: 'Ticket priority',
                        type: 'select',
                        value: t.priority,
                        options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(
                          (value) => ({ value, label: value }),
                        ),
                      },
                      {
                        name: 'kind',
                        label: 'Ticket work type',
                        type: 'select',
                        value: t.kind,
                        options: ['STORY', 'TASK', 'DEFECT'].map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                      text(
                        'dueAt',
                        'Edit deadline (IST)',
                        t.dueAt
                          ? new Date(t.dueAt.getTime() + 330 * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : '',
                        'datetime-local',
                      ),
                      {
                        name: 'issueUrl',
                        label: 'Authorized GitHub issue URL',
                        type: 'url',
                        value: t.issueUrl ?? '',
                      },
                    ]}
                    button="Save ticket changes"
                  />
                </details>
              )}
            <h2>Technical requirements</h2>
            <p className="learn-lesson-body">{t.requirements}</p>
            <h3>Acceptance criteria</h3>
            <ul>
              {t.acceptance.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <h3>Definition of Done</h3>
            <ul>
              {t.definitionOfDone.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="learn-meta">
              Due {t.dueAt ? displayTime(t.dueAt) + ' IST' : 'not scheduled'}
            </p>
            {t.issueUrl && (
              <a href={t.issueUrl} target="_blank" rel="noopener noreferrer">
                Linked issue
              </a>
            )}
            {next.length > 0 && (staff || t.assigneeId === a.id) && (
              <ProjectForm
                key={t.version}
                action="move"
                values={{ ticketId: t.id, version: t.version }}
                fields={[
                  {
                    name: 'status',
                    label: 'Move ticket to',
                    type: 'select',
                    options: next.map((value) => ({
                      value,
                      label: value.replaceAll('_', ' '),
                    })),
                  },
                ]}
                button="Update ticket status"
              />
            )}
          </section>
          <section className="learn-card">
            <h2>Contribution evidence</h2>
            <p className="learn-note">
              A submitted link is unverified. Mentor review and optional GitHub
              identity checks are recorded separately. No hours or employment
              experience are inferred.
            </p>
            {d.evidence.map((e) => (
              <article className="project-evidence" key={e.id}>
                <h3>
                  {e.user.name ?? 'Learner'} · {e.kind}
                </h3>
                <span className="learn-tag">{e.status}</span>
                <p>{e.summary}</p>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    Open submitted evidence link
                  </a>
                )}
                <p className="learn-meta">
                  {e.githubVerifiedAt
                    ? `GitHub identity checked · ${e.githubState}`
                    : 'GitHub verification: not performed'}{' '}
                  · Submitted {displayTime(e.submittedAt)} IST
                </p>
                {e.feedback && (
                  <div className="learn-note">
                    <strong>Supervisor feedback</strong>
                    <p>{e.feedback}</p>
                    <span>Quality evaluation: {e.evaluation ?? '—'} / 5</span>
                  </div>
                )}
                {e.files.map((f) => (
                  <p key={f.id}>
                    <a href={`/api/projects/files/${f.id}`}>
                      Download {f.name}
                    </a>
                  </p>
                ))}
                {!staff && e.userId === a.id && e.status === 'SUBMITTED' && (
                  <EvidenceUpload evidenceId={e.id} />
                )}
                <ProjectForm
                  action="verify"
                  values={{ id: e.id }}
                  fields={[]}
                  button={
                    githubApi.ready()
                      ? 'Verify GitHub identity'
                      : 'Check GitHub integration availability'
                  }
                />
                {staff && e.status === 'SUBMITTED' && (
                  <ProjectForm
                    key={e.version}
                    action="review"
                    values={{ id: e.id, version: e.version }}
                    fields={[
                      {
                        name: 'status',
                        label: 'Evidence review decision',
                        type: 'select',
                        options: [
                          {
                            value: 'CHANGES_REQUESTED',
                            label: 'Request changes',
                          },
                          {
                            value: 'APPROVED',
                            label: 'Approve reviewed contribution',
                          },
                          { value: 'REJECTED', label: 'Reject' },
                        ],
                      },
                      text(
                        'feedback',
                        'Review rationale and actionable feedback',
                        '',
                        'textarea',
                      ),
                      {
                        name: 'evaluation',
                        label: 'Evidence quality evaluation (1–5)',
                        type: 'number',
                        min: 1,
                        max: 5,
                        value: 3,
                        required: true,
                      },
                    ]}
                    button="Save evidence review"
                  />
                )}
                {!staff &&
                  e.userId === a.id &&
                  e.status === 'APPROVED' &&
                  !d.p.project!.confidential && (
                    <details>
                      <summary>Create or revise portfolio summary</summary>
                      <ProjectForm
                        action="portfolio"
                        values={{
                          evidenceId: e.id,
                          version:
                            d.portfolios.find(
                              (p) => p.evidenceId === e.id && p.userId === a.id,
                            )?.version ?? 0,
                        }}
                        fields={[
                          text(
                            'description',
                            'Public project contribution description',
                            d.portfolios.find((p) => p.evidenceId === e.id)
                              ?.description ?? '',
                            'textarea',
                          ),
                          text(
                            'challenges',
                            'Technical challenges and decisions',
                            d.portfolios.find((p) => p.evidenceId === e.id)
                              ?.challenges ?? '',
                            'textarea',
                          ),
                          {
                            name: 'outcome',
                            label:
                              'Measurable outcome (only if supported by evidence)',
                            type: 'textarea',
                            value:
                              d.portfolios.find((p) => p.evidenceId === e.id)
                                ?.outcome ?? '',
                          },
                        ]}
                        button="Save portfolio draft"
                      />
                    </details>
                  )}
                {a.role === 'ADMIN' &&
                  e.files.map((f) => (
                    <details key={f.id}>
                      <summary>Retention control: {f.name}</summary>
                      <ProjectForm
                        action="retire"
                        values={{ kind: 'FILE', id: f.id }}
                        fields={[
                          text(
                            'reason',
                            'Reason to retire and erase file bytes',
                            '',
                            'textarea',
                          ),
                        ]}
                        button="Retire private attachment"
                      />
                    </details>
                  ))}
              </article>
            ))}
            {!staff &&
              t.assigneeId === a.id &&
              ['IN_PROGRESS', 'IN_REVIEW'].includes(t.status) && (
                <ProjectForm
                  action="evidence"
                  values={{ ticketId: t.id, requestKey: randomUUID() }}
                  fields={[
                    {
                      name: 'kind',
                      label: 'Evidence type',
                      type: 'select',
                      options: [
                        {
                          value: 'ARTIFACT',
                          label: 'Manual artifact / document / analysis',
                        },
                        { value: 'PULL_REQUEST', label: 'GitHub pull request' },
                        { value: 'COMMIT', label: 'GitHub commit (full SHA)' },
                      ],
                    },
                    text(
                      'summary',
                      'Your actual contribution and supporting evidence',
                      '',
                      'textarea',
                    ),
                    {
                      name: 'url',
                      label:
                        'Actual evidence HTTPS link (optional for attachments)',
                      type: 'url',
                      value: '',
                    },
                  ]}
                  button="Submit contribution evidence"
                />
              )}
          </section>
          <section className="learn-card">
            <h2>Discussion</h2>
            {d.comments.toReversed().map((c) => (
              <article className="learn-message" key={c.id}>
                <strong>{c.user.name ?? 'Team member'}</strong>
                <p>{c.body}</p>
                <small className="learn-meta">
                  {displayTime(c.createdAt)} IST
                </small>
              </article>
            ))}
            <ProjectForm
              action="comment"
              values={{ ticketId: t.id }}
              fields={[text('body', 'Add a project comment', '', 'textarea')]}
              button="Post comment"
            />
          </section>
        </div>
        <aside>
          <section className="learn-card">
            <h2>Review & quality gates</h2>
            {[
              ['Lead review', t.codeReviewed],
              ['QA acceptance', t.qaAccepted],
              ['Definition of Done', t.dodAccepted],
              ['Security review', t.securityCleared],
            ].map(([label, done]) => (
              <p key={String(label)}>
                <span className="learn-tag">{done ? 'Passed' : 'Pending'}</span>
                {label}
              </p>
            ))}
            {staff && ['IN_REVIEW', 'QA_TESTING'].includes(t.status) && (
              <ProjectForm
                key={t.version}
                action="quality"
                values={{ ticketId: t.id, version: t.version }}
                fields={[
                  {
                    name: 'codeReviewed',
                    label: 'Lead review completed',
                    type: 'checkbox',
                    value: t.codeReviewed,
                  },
                  {
                    name: 'qaAccepted',
                    label: 'QA acceptance verified',
                    type: 'checkbox',
                    value: t.qaAccepted,
                  },
                  {
                    name: 'dodAccepted',
                    label: 'All Definition of Done items verified',
                    type: 'checkbox',
                    value: t.dodAccepted,
                  },
                  {
                    name: 'securityCleared',
                    label: 'Security review cleared',
                    type: 'checkbox',
                    value: t.securityCleared,
                  },
                  text(
                    'note',
                    'Sign-off rationale and evidence',
                    '',
                    'textarea',
                  ),
                ]}
                button="Record quality sign-off"
              />
            )}
            <p className="learn-meta">
              Done requires all gates and an approved contribution. Deployment
              requires a separate supervisor attestation.
            </p>
          </section>
          {staff &&
            d.portfolios.map((p) => (
              <section className="learn-card" key={p.id}>
                <h2>Portfolio publication review</h2>
                <span className="learn-tag">{p.status}</span>
                <p>{p.description}</p>
                <p>{p.challenges}</p>
                <p>{p.outcome}</p>
                <p>
                  Check accuracy, substantiation and confidentiality before
                  approval.
                </p>
                <ProjectForm
                  action="portfolio-review"
                  values={{ id: p.id, version: p.version }}
                  fields={[
                    {
                      name: 'approve',
                      label:
                        'Approve this description and any stated outcome for export',
                      type: 'checkbox',
                    },
                    text(
                      'feedback',
                      'Portfolio review rationale',
                      '',
                      'textarea',
                    ),
                  ]}
                  button="Review portfolio entry"
                />
              </section>
            ))}
        </aside>
      </div>
    </LearningShell>
  );
}
