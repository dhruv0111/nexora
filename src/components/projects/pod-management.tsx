import { getDb } from '@/lib/db';
import { paidWhere } from '@/lib/learning/policy';
import type { Actor } from '@/lib/domain/http';
import type { podBoard } from '@/lib/projects/read';
import { ProjectForm } from './forms';
import type { Field } from '@/components/learning/action-form';
export const dateInput = (date: Date | null) =>
  date ? new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16) : '';
export const text = (
  name: string,
  label: string,
  value = '',
  type: Field['type'] = 'text',
): Field => ({ name, label, value, type, required: true });
export async function PodManagement({
  a,
  d,
}: {
  a: Actor;
  d: Awaited<ReturnType<typeof podBoard>>;
}) {
  const db = getDb(),
    [eligible, mentors] = await Promise.all([
      db.enrollment.findMany({
        where: {
          ...paidWhere,
          cohort: {
            status: 'PUBLISHED',
            course: { status: 'PUBLISHED', contentApprovedAt: { not: null } },
            ...(a.role === 'MENTOR'
              ? { mentors: { some: { mentor: { userId: a.id } } } }
              : {}),
          },
        },
        include: {
          user: { select: { name: true } },
          cohort: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
        take: 100,
      }),
      db.projectStaff.findMany({
        where: { projectId: d.p.projectId!, user: { role: 'MENTOR' } },
        include: { user: { select: { name: true } } },
        take: 20,
      }),
    ]);
  return (
    <>
      <section className="learn-card">
        <h2>Pod membership & supervision</h2>
        <p className="learn-meta">
          Choose a learner and their matching paid enrollment. Supervisors must
          also be assigned to that learner’s cohort. Participation dates are
          recorded by the server.
        </p>
        <ProjectForm
          action="member"
          values={{ podId: d.p.id, version: 0, remove: false }}
          fields={[
            {
              name: 'userId',
              label: 'Eligible learner',
              type: 'select',
              options: eligible.map((e) => ({
                value: e.userId,
                label: e.user.name ?? e.userId,
              })),
            },
            {
              name: 'enrollmentId',
              label: 'Verified enrollment',
              type: 'select',
              options: eligible.map((e) => ({
                value: e.id,
                label: `${e.user.name ?? 'Student'} · ${e.cohort.name}`,
              })),
            },
            {
              name: 'supervisorId',
              label: 'Assigned supervisor',
              type: 'select',
              options: mentors.map((m) => ({
                value: m.userId,
                label: m.user.name ?? m.userId,
              })),
            },
            text('responsibility', 'Actual responsibilities', '', 'textarea'),
          ]}
          button="Assign pod member"
        />
        {d.members
          .filter((m) => !m.leftAt)
          .map((m) => (
            <details key={m.userId}>
              <summary>
                {m.user.name ?? 'Learner'} · Membership controls
              </summary>
              <ProjectForm
                action="member"
                values={{
                  podId: d.p.id,
                  userId: m.userId,
                  enrollmentId: m.enrollmentId ?? '',
                  supervisorId: m.supervisorId ?? '',
                  responsibility: m.responsibility,
                  version: m.version,
                  remove: true,
                }}
                fields={[]}
                button="End this participation"
              />
            </details>
          ))}
      </section>
      <section className="learn-card">
        <h2>Sprint planning</h2>
        <ProjectForm
          action="sprint"
          values={{
            podId: d.p.id,
            version: 0,
            status: 'PLANNED',
            retrospective: '',
          }}
          fields={[
            text('name', 'Sprint name'),
            text('goal', 'Sprint goal', '', 'textarea'),
            text('startsAt', 'Sprint start (IST)', '', 'datetime-local'),
            text('endsAt', 'Sprint end (IST)', '', 'datetime-local'),
          ]}
          button="Plan sprint"
        />
        {d.sprints.map((s) => (
          <details key={s.id}>
            <summary>
              {s.name} · {s.status}
            </summary>
            <ProjectForm
              key={s.version}
              action="sprint"
              values={{ id: s.id, podId: d.p.id, version: s.version }}
              fields={[
                text('name', 'Sprint name', s.name),
                text('goal', 'Sprint goal', s.goal, 'textarea'),
                text(
                  'startsAt',
                  'Sprint start (IST)',
                  dateInput(s.startsAt),
                  'datetime-local',
                ),
                text(
                  'endsAt',
                  'Sprint end (IST)',
                  dateInput(s.endsAt),
                  'datetime-local',
                ),
                {
                  name: 'status',
                  label: 'Sprint lifecycle',
                  type: 'select',
                  value: s.status,
                  options: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(
                    (value) => ({ value, label: value }),
                  ),
                },
                {
                  name: 'retrospective',
                  label: 'Outcomes & retrospective',
                  type: 'textarea',
                  value: s.retrospective,
                },
              ]}
              button="Update sprint"
            />
          </details>
        ))}
      </section>
      <section className="learn-card">
        <h2>Create a delivery ticket</h2>
        <ProjectForm
          action="ticket"
          values={{ podId: d.p.id, version: 0, issueUrl: '' }}
          fields={[
            text('title', 'Ticket title'),
            text('requirements', 'Technical requirements', '', 'textarea'),
            text(
              'acceptance',
              'Acceptance criteria (one per line)',
              '',
              'lines',
            ),
            text(
              'definitionOfDone',
              'Definition of Done (one per line)',
              '',
              'lines',
            ),
            {
              name: 'kind',
              label: 'Work type',
              type: 'select',
              options: ['STORY', 'TASK', 'DEFECT'].map((value) => ({
                value,
                label: value,
              })),
            },
            {
              name: 'priority',
              label: 'Priority',
              type: 'select',
              value: 'MEDIUM',
              options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({
                value,
                label: value,
              })),
            },
            {
              name: 'sprintId',
              label: 'Sprint',
              type: 'select',
              options: [
                { value: '', label: 'Unscheduled backlog' },
                ...d.sprints
                  .filter((s) => ['PLANNED', 'ACTIVE'].includes(s.status))
                  .map((s) => ({ value: s.id, label: s.name })),
              ],
            },
            {
              name: 'assigneeId',
              label: 'Assignee',
              type: 'select',
              options: [
                { value: '', label: 'Unassigned' },
                ...d.members
                  .filter((m) => !m.leftAt)
                  .map((m) => ({
                    value: m.userId,
                    label: m.user.name ?? m.userId,
                  })),
              ],
            },
            text('dueAt', 'Ticket deadline (IST)', '', 'datetime-local'),
            {
              name: 'issueUrl',
              label: 'Authorized GitHub issue URL (optional)',
              type: 'url',
              value: '',
            },
          ]}
          button="Create ticket"
        />
      </section>
      <section className="learn-card">
        <h2>Quality & release sign-off</h2>
        <p>
          All tickets must be Done and concerns resolved. Readiness does not
          imply a production deployment. Deployment evidence is a manual
          supervisor attestation.
        </p>
        <ProjectForm
          action="release"
          values={{ podId: d.p.id }}
          fields={[
            text('title', 'Release name'),
            text(
              'notes',
              'Review outcomes and deployment evidence',
              '',
              'textarea',
            ),
            {
              name: 'status',
              label: 'Release attestation',
              type: 'select',
              options: [
                { value: 'READY', label: 'Ready for release review' },
                {
                  value: 'DEPLOYED',
                  label: 'Deployment attested with evidence',
                },
              ],
            },
            {
              name: 'deploymentUrl',
              label: 'Actual HTTPS deployment evidence URL',
              type: 'url',
              value: '',
            },
          ]}
          button="Record supervisor sign-off"
        />
      </section>
    </>
  );
}
