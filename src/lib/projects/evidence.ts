import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { httpsUrl } from '@/lib/learning/content';
import { podAccess } from './policy';
import { id } from './service';
export async function submitEvidence(a: Actor, input: unknown) {
  const b = z
    .object({
      ticketId: id,
      requestKey: z.uuid(),
      kind: z.enum(['ARTIFACT', 'PULL_REQUEST', 'COMMIT']),
      summary: z.string().trim().min(20).max(10000),
      url: httpsUrl,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `ticket:${b.ticketId}`);
    const t = await tx.projectTicket.findUnique({ where: { id: b.ticketId } });
    ensure(t, 404, 'TICKET', 'Ticket not found.');
    await podAccess(a, t.podId, tx);
    ensure(
      a.role === 'STUDENT' && t.assigneeId === a.id,
      403,
      'OWNER',
      'Only the assigned student can submit contribution evidence.',
    );
    ensure(
      t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW',
      409,
      'STATE',
      'Submit evidence during development or review.',
    );
    const old = await tx.contributionEvidence.findUnique({
      where: { requestKey: b.requestKey },
    });
    if (old) {
      ensure(
        old.userId === a.id &&
          old.ticketId === t.id &&
          old.summary === b.summary &&
          old.url === (b.url || null) &&
          old.kind === b.kind,
        409,
        'KEY_REUSE',
        'Evidence request key already used.',
      );
      return { id: old.id };
    }
    if (b.kind !== 'ARTIFACT')
      ensure(b.url, 422, 'URL', 'Provide the actual GitHub link.');
    const e = await tx.contributionEvidence.create({
      data: {
        ticketId: t.id,
        userId: a.id,
        kind: b.kind,
        summary: b.summary,
        url: b.url || null,
        ticketVersion: t.version,
        requestKey: b.requestKey,
      },
    });
    await audit(
      tx,
      a.id,
      'CONTRIBUTION_SUBMITTED',
      'ContributionEvidence',
      e.id,
      { ticketId: t.id, ticketVersion: t.version },
    );
    return { id: e.id };
  });
}
export async function reviewEvidence(a: Actor, input: unknown) {
  const b = z
    .object({
      id,
      version: z.number().int().positive(),
      status: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
      feedback: z.string().trim().min(20).max(5000),
      evaluation: z.number().int().min(1).max(5),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `evidence:${b.id}`);
    const e = await tx.contributionEvidence.findUnique({
      where: { id: b.id },
      include: { ticket: true },
    });
    ensure(e, 404, 'EVIDENCE', 'Contribution not found.');
    await podAccess(a, e.ticket.podId, tx, true);
    ensure(
      e.userId !== a.id && e.version === b.version && e.status === 'SUBMITTED',
      409,
      'VERSION',
      'Review the current submitted evidence revision.',
    );
    if (b.status === 'APPROVED')
      ensure(
        e.url ||
          (await tx.projectFile.count({
            where: { evidenceId: e.id, removedAt: null },
          })) > 0,
        422,
        'ARTIFACT_REQUIRED',
        'Approval requires an inspectable evidence link or private attachment, not a summary alone.',
      );
    await tx.evidenceRevision.create({
      data: {
        evidenceId: e.id,
        version: e.version,
        snapshot: JSON.parse(JSON.stringify(e)),
      },
    });
    await tx.contributionEvidence.update({
      where: { id: e.id },
      data: {
        status: b.status,
        feedback: b.feedback,
        evaluation: b.evaluation,
        reviewerId: a.id,
        reviewedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.portfolioEntry.updateMany({
      where: { evidenceId: e.id },
      data: { status: 'DRAFT', approvedAt: null },
    });
    await audit(
      tx,
      a.id,
      'CONTRIBUTION_REVIEWED',
      'ContributionEvidence',
      e.id,
      { status: b.status, evaluation: b.evaluation, feedback: b.feedback },
    );
    return { id: e.id };
  });
}
export async function comment(a: Actor, input: unknown) {
  const b = z
    .object({ ticketId: id, body: z.string().trim().min(2).max(5000) })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const t = await tx.projectTicket.findUnique({ where: { id: b.ticketId } });
    ensure(t, 404, 'TICKET', 'Ticket not found.');
    await podAccess(a, t.podId, tx);
    const c = await tx.projectComment.create({ data: { ...b, userId: a.id } });
    await audit(tx, a.id, 'PROJECT_COMMENTED', 'ProjectTicket', t.id, {
      commentId: c.id,
    });
    return { id: c.id };
  });
}
export async function concern(a: Actor, input: unknown) {
  const b = z
    .object({
      podId: id,
      id: id.optional(),
      kind: z.enum(['SECURITY', 'DELIVERY']),
      description: z.string().trim().min(20).max(5000),
      resolution: z.string().trim().max(5000),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await podAccess(a, b.podId, tx, !!b.id);
    if (b.id) {
      ensure(
        b.resolution.length >= 20,
        422,
        'RESOLUTION',
        'Document how the concern was resolved.',
      );
      const c = await tx.projectConcern.findFirst({
        where: { id: b.id, podId: b.podId, resolvedAt: null },
      });
      ensure(c, 404, 'CONCERN', 'Open concern not found.');
      await tx.projectConcern.update({
        where: { id: c.id },
        data: {
          resolution: b.resolution,
          resolvedAt: new Date(),
          resolvedBy: a.id,
        },
      });
      await audit(
        tx,
        a.id,
        'PROJECT_CONCERN_RESOLVED',
        'ProjectConcern',
        c.id,
        { resolution: b.resolution },
      );
      return { id: c.id };
    }
    const c = await tx.projectConcern.create({
      data: {
        podId: b.podId,
        kind: b.kind,
        description: b.description,
        openedBy: a.id,
      },
    });
    await audit(tx, a.id, 'PROJECT_CONCERN_OPENED', 'ProjectConcern', c.id, {
      podId: b.podId,
      kind: b.kind,
    });
    return { id: c.id };
  });
}
export async function release(a: Actor, input: unknown) {
  const b = z
    .object({
      podId: id,
      title: z.string().trim().min(3).max(160),
      notes: z.string().trim().min(20).max(10000),
      status: z.enum(['READY', 'DEPLOYED']),
      deploymentUrl: httpsUrl,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `pod:${b.podId}`);
    await podAccess(a, b.podId, tx, true);
    ensure(
      (await tx.projectTicket.count({ where: { podId: b.podId } })) > 0 &&
        (await tx.projectTicket.count({
          where: { podId: b.podId, status: { not: 'DONE' } },
        })) === 0,
      409,
      'RELEASE_GATE',
      'All tickets must pass their delivery gates.',
    );
    ensure(
      (await tx.projectConcern.count({
        where: { podId: b.podId, resolvedAt: null },
      })) === 0,
      409,
      'BLOCKERS',
      'Resolve security and delivery concerns before release sign-off.',
    );
    ensure(
      (await tx.projectTicket.count({
        where: {
          podId: b.podId,
          OR: [
            { codeReviewed: false },
            { qaAccepted: false },
            { dodAccepted: false },
            { securityCleared: false },
          ],
        },
      })) === 0,
      409,
      'QUALITY_GATE',
      'Current review gates must still pass.',
    );
    const missing = await tx.$queryRaw<
      { id: string }[]
    >`SELECT t.id FROM "ProjectTicket" t WHERE t."podId"=${b.podId} AND NOT EXISTS (SELECT 1 FROM "ContributionEvidence" e WHERE e."ticketId"=t.id AND e."userId"=t."assigneeId" AND e.status='APPROVED') LIMIT 1`;
    ensure(
      missing.length === 0,
      409,
      'EVIDENCE_GATE',
      'Each delivered ticket needs current approved assignee evidence.',
    );
    if (b.status === 'DEPLOYED')
      ensure(
        b.deploymentUrl,
        422,
        'DEPLOYMENT',
        'Record actual deployment evidence. Ticket completion is not deployment.',
      );
    const r = await tx.projectRelease.create({
      data: {
        podId: b.podId,
        title: b.title,
        notes: b.notes,
        status: b.status,
        deploymentUrl: b.deploymentUrl || null,
        signedBy: a.id,
      },
    });
    await audit(tx, a.id, 'PROJECT_RELEASE_SIGNED', 'ProjectRelease', r.id, {
      status: r.status,
      attestation: 'MANUAL_SUPERVISOR_SIGNOFF',
    });
    return { id: r.id };
  });
}
export async function portfolio(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      evidenceId: id,
      version: z.number().int().nonnegative(),
      description: z.string().trim().min(20).max(3000),
      challenges: z.string().trim().min(20).max(3000),
      outcome: z.string().trim().max(1000),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `portfolio:${a.id}:${b.evidenceId}`);
    const e = await tx.contributionEvidence.findFirst({
      where: { id: b.evidenceId, userId: a.id, status: 'APPROVED' },
      include: { ticket: { include: { pod: { include: { project: true } } } } },
    });
    ensure(
      a.role === 'STUDENT' && e,
      404,
      'EVIDENCE',
      'Approved owned evidence is required.',
    );
    await podAccess(a, e.ticket.podId, tx);
    ensure(
      !e.ticket.pod.project!.confidential,
      403,
      'CONFIDENTIAL',
      'Confidential projects cannot be exported to portfolios.',
    );
    const old = await tx.portfolioEntry.findUnique({
      where: { userId_evidenceId: { userId: a.id, evidenceId: e.id } },
    });
    ensure(
      (old?.version ?? 0) === b.version,
      409,
      'VERSION',
      'Portfolio changed.',
    );
    const data = {
      description: b.description,
      challenges: b.challenges,
      outcome: b.outcome,
      status: 'DRAFT',
      approvedAt: null,
      reviewerId: null,
    };
    const p = old
      ? await tx.portfolioEntry.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.portfolioEntry.create({
          data: { ...data, userId: a.id, evidenceId: e.id },
        });
    await audit(tx, a.id, 'PORTFOLIO_DRAFTED', 'PortfolioEntry', p.id, {
      version: p.version,
    });
    return { id: p.id };
  });
}
export async function reviewPortfolio(a: Actor, input: unknown) {
  const b = z
    .object({
      id,
      version: z.number().int().positive(),
      approve: z.boolean(),
      feedback: z.string().trim().min(20).max(3000),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const p = await tx.portfolioEntry.findUnique({
      where: { id: b.id },
      include: { evidence: { include: { ticket: true } } },
    });
    ensure(p, 404, 'PORTFOLIO', 'Portfolio not found.');
    await podAccess(a, p.evidence.ticket.podId, tx, true);
    ensure(
      p.userId !== a.id &&
        p.version === b.version &&
        p.evidence.status === 'APPROVED',
      409,
      'VERSION',
      'Review the current approved evidence and portfolio revision.',
    );
    const entry = await tx.portfolioEntry.update({
      where: { id: p.id },
      data: {
        status: b.approve ? 'APPROVED' : 'CHANGES_REQUESTED',
        approvedAt: b.approve ? new Date() : null,
        reviewerId: a.id,
        feedback: b.feedback,
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'PORTFOLIO_REVIEWED', 'PortfolioEntry', p.id, {
      approved: b.approve,
      feedback: b.feedback,
    });
    return { id: entry.id };
  });
}
export async function exportPortfolio(userId: string) {
  const entries = await getDb().portfolioEntry.findMany({
    where: {
      userId,
      status: 'APPROVED',
      approvedAt: { not: null },
      evidence: {
        status: 'APPROVED',
        ticket: {
          pod: { project: { confidential: false, status: 'PUBLISHED' } },
        },
      },
    },
    include: {
      evidence: {
        include: {
          ticket: { include: { pod: { include: { project: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const memberships = await getDb().podMember.findMany({
    where: {
      userId,
      podId: { in: entries.map((p) => p.evidence.ticket.podId) },
    },
    select: {
      podId: true,
      joinedAt: true,
      leftAt: true,

      supervisorId: true,
    },
    take: 100,
  });
  const owner = await getDb().user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  // No raw repository, evidence URLs, internal acceptance text or confidential filenames are exported.
  return {
    author: { userId, name: owner?.name ?? null },
    engagementType: 'SUPERVISED_TRAINING',
    disclaimer:
      'Educational project contributions, not employment, an internship, or an apprenticeship. Hours and employment certificates are not issued.',
    entries: entries.map((p) => ({
      project: p.evidence.ticket.pod.project!.title,
      participation:
        memberships.find((m) => m.podId === p.evidence.ticket.podId) ?? null,
      description: p.description,
      technologies: p.evidence.ticket.pod.project!.technologies,
      responsibility: p.description,
      challenges: p.challenges,
      mentorApprovedOutcome: p.outcome || null,
      contributionDate: p.evidence.submittedAt,
      reviewedAt: p.evidence.reviewedAt,
      supervisorId: p.evidence.reviewerId,
      source: p.evidence.githubVerifiedAt
        ? 'GITHUB_IDENTITY_CHECKED_AND_MENTOR_REVIEWED'
        : 'MENTOR_REVIEWED_ARTIFACT',
      evidenceId: p.evidence.id,
      portfolioApprovedAt: p.approvedAt,
    })),
  };
}
