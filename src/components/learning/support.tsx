import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { ticketAccess } from '@/lib/learning/community';
import { displayTime, pageNumber } from '@/lib/learning/policy';
import { ActionForm } from './action-form';
import { Empty } from './shell';
import { Pagination } from './student-sections';
export async function Support({
  actor,
  query,
}: {
  actor: Actor;
  query: Record<string, string | undefined>;
}) {
  ensure(
    ['STUDENT', 'ADMIN'].includes(actor.role),
    403,
    'SUPPORT',
    'Support conversations are restricted to their student owner and support administrators.',
  );
  const db = getDb(),
    page = pageNumber(query.page),
    status = ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(query.status ?? '')
      ? query.status
      : undefined;
  if (query.ticket) {
    const ticket = await ticketAccess(actor, query.ticket),
      [messages, admins] = await Promise.all([
        db.supportMessage.findMany({
          where: { ticketId: ticket.id },
          include: { author: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * 50,
          take: 50,
        }),
        actor.role === 'ADMIN'
          ? db.user.findMany({
              where: { role: 'ADMIN' },
              select: { id: true, name: true },
              take: 100,
            })
          : Promise.resolve([]),
      ]);
    return (
      <section className="learn-card">
        <Link href="/learning/support">All support tickets</Link>
        <h2>{ticket.subject}</h2>
        <span className="learn-tag">{ticket.category}</span>
        <span className="learn-tag">{ticket.priority}</span>
        <span className="learn-tag">{ticket.status}</span>
        {messages.toReversed().map((m) => (
          <article className="learn-message" key={m.id}>
            <strong>
              {m.author.role === 'ADMIN'
                ? 'Support'
                : (m.author.name ?? 'Student')}
            </strong>
            <small className="learn-meta">{displayTime(m.createdAt)} IST</small>
            <p>{m.body}</p>
          </article>
        ))}
        <ActionForm
          key={ticket.version}
          action="reply"
          values={{
            ticketId: ticket.id,
            version: ticket.version,
            ...(actor.role === 'STUDENT' ? { status: 'OPEN' } : {}),
          }}
          fields={[
            {
              name: 'body',
              label: 'Your reply',
              type: 'textarea',
              required: true,
            },
            ...(actor.role === 'ADMIN'
              ? [
                  {
                    name: 'status',
                    label: 'Ticket status',
                    type: 'select' as const,
                    value: ticket.status,
                    options: ['OPEN', 'IN_PROGRESS', 'RESOLVED'].map(
                      (value) => ({ value, label: value }),
                    ),
                  },
                  {
                    name: 'assigneeId',
                    label: 'Support administrator',
                    type: 'select' as const,
                    value: ticket.assigneeId ?? '',
                    options: [
                      { value: '', label: 'Unassigned' },
                      ...admins.map((a) => ({
                        value: a.id,
                        label: a.name ?? a.id,
                      })),
                    ],
                  },
                ]
              : []),
          ]}
          button={
            actor.role === 'STUDENT'
              ? 'Send reply / reopen ticket'
              : 'Send support update'
          }
        />
        <Pagination
          page={page}
          hasNext={messages.length === 50}
          base={`ticket=${ticket.id}&`}
        />
      </section>
    );
  }
  const tickets = await db.supportTicket.findMany({
    where: {
      ...(actor.role === 'STUDENT' ? { userId: actor.id } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * 20,
    take: 20,
  });
  return (
    <>
      <div className="learn-grid">
        <section className="learn-card">
          <h2>Your support conversations</h2>
          <form className="learn-search">
            <label>
              Ticket status
              <select name="status" defaultValue={status ?? ''}>
                <option value="">All statuses</option>
                {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="button button-secondary">Filter tickets</button>
          </form>
          {tickets.length ? (
            <ul className="learn-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <span className="learn-tag">
                    {t.status} · {t.priority}
                  </span>
                  <h3>
                    <Link href={`?ticket=${t.id}`}>{t.subject}</Link>
                  </h3>
                  <small>{displayTime(t.updatedAt)} IST</small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No support tickets here.">
              Ask for help with learning, access, technical issues, or
              accessibility.
            </Empty>
          )}
          <Pagination
            page={page}
            hasNext={tickets.length === 20}
            base={status ? `status=${status}&` : ''}
          />
        </section>
        {actor.role === 'STUDENT' && (
          <section className="learn-card">
            <h2>Let’s work through it.</h2>
            <p>
              Give the team enough context to help. Never include passwords,
              payment secrets, or card information.
            </p>
            <ActionForm
              action="ticket"
              values={{ requestKey: randomUUID() }}
              fields={[
                {
                  name: 'subject',
                  label: 'What do you need help with?',
                  required: true,
                },
                {
                  name: 'category',
                  label: 'Category',
                  type: 'select',
                  options: [
                    'TECHNICAL',
                    'LEARNING',
                    'BILLING',
                    'ACCESSIBILITY',
                  ].map((value) => ({ value, label: value })),
                },
                {
                  name: 'priority',
                  label: 'Priority',
                  type: 'select',
                  options: [
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'HIGH', label: 'High · Blocking my learning' },
                  ],
                },
                {
                  name: 'body',
                  label: 'Describe the issue',
                  type: 'textarea',
                  required: true,
                },
              ]}
              button="Create support ticket"
              success="Ticket created. Open it in your support conversations."
            />
          </section>
        )}
      </div>
      <section className="learn-card">
        <h2>A little help, right here.</h2>
        <details>
          <summary>Why is a lesson locked?</summary>
          <p>
            Learning requires an active enrollment with a verified captured
            payment. Some lessons also require completion of an earlier lesson.
            Contact support if your payment is awaiting reconciliation.
          </p>
        </details>
        <details>
          <summary>How is my progress calculated?</summary>
          <p>
            Completed published lessons divided by all published lessons in your
            course, rounded down to a whole percentage. Assignments, assessment
            passes and attendance are tracked separately. Completion is a
            learner acknowledgement.
          </p>
        </details>
        <details>
          <summary>Can I change a submitted assignment?</summary>
          <p>
            A mentor must grade it and explicitly allow resubmission. The
            deadline must still be open. Save drafts before submitting, and use
            only permitted file formats.
          </p>
        </details>
        <details>
          <summary>How do I escalate a blocking issue?</summary>
          <p>
            Open a high-priority ticket with the technical or learning category.
            Support administrators can assign and resolve it. Replies and status
            are visible here; email notifications and guaranteed response times
            are not configured.
          </p>
        </details>
      </section>
    </>
  );
}
