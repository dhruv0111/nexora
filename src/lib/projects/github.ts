import 'server-only';
import { z } from 'zod';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { serial, audit } from '@/lib/domain/transaction';
import { ensure, DomainError } from '@/lib/domain/errors';
import { verifyHmac, sha256 } from '@/lib/payments/security';
import type { Actor } from '@/lib/domain/http';
import { projectAccess, podAccess } from './policy';
export const repoName = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  .max(200)
  .refine((v) => !v.split('/').some((p) => p === '.' || p === '..'));
export function githubLink(url: string) {
  const m =
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(pull|commit|issues)\/([a-f0-9]{40}|[1-9][0-9]{0,9})$/.exec(
      url,
    );
  ensure(
    m,
    422,
    'GITHUB_LINK',
    'Use an exact GitHub pull request, issue, or full commit URL.',
  );
  repoName.parse(m[1]);
  ensure(
    m[2] === 'commit'
      ? /^[a-f0-9]{40}$/.test(m[3])
      : /^[1-9][0-9]*$/.test(m[3]),
    422,
    'GITHUB_LINK',
    'Invalid GitHub identifier.',
  );
  return { repository: m[1], kind: m[2], reference: m[3] };
}
export type GitHubApi = {
  ready(): boolean;
  get(path: string): Promise<unknown>;
};
export const githubApi: GitHubApi = {
  ready: () => !!env.GITHUB_PROJECT_TOKEN,
  get: async (path) => {
    ensure(
      env.GITHUB_PROJECT_TOKEN,
      503,
      'GITHUB_DISABLED',
      'GitHub verification is not configured. Manual evidence review remains available.',
    );
    const r = await fetch(`https://api.github.com/${path}`, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_PROJECT_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    });
    ensure(
      r.ok,
      502,
      'GITHUB_UNAVAILABLE',
      'GitHub could not verify the selected repository resource.',
    );
    return r.json();
  },
};
export async function linkRepository(a: Actor, input: unknown) {
  const b = z
    .object({ projectId: z.string().min(1).max(100), fullName: repoName })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    ensure(
      a.role === 'ADMIN',
      403,
      'ADMIN',
      'Only an administrator may authorize repositories.',
    );
    await projectAccess(a, b.projectId, tx);
    const r = await tx.projectRepository.create({ data: b });
    await audit(tx, a.id, 'PROJECT_REPOSITORY_LINKED', 'Project', b.projectId, {
      repository: b.fullName,
    });
    return { id: r.id };
  });
}
export async function verifyEvidence(
  a: Actor | null,
  evidenceId: string,
  api: GitHubApi = githubApi,
) {
  ensure(
    api.ready(),
    503,
    'GITHUB_DISABLED',
    'GitHub verification is disabled; use mentor review of manual evidence.',
  );
  const db = getDb(),
    e = await db.contributionEvidence.findUnique({
      where: { id: evidenceId },
      include: { ticket: { include: { pod: true } } },
    });
  ensure(e?.url, 404, 'EVIDENCE', 'Linked contribution not found.');
  if (a) {
    await podAccess(a, e.ticket.podId);
    ensure(
      a.role !== 'STUDENT' || e.userId === a.id,
      403,
      'OWNER',
      'Only your contribution may be verified.',
    );
  }
  const link = githubLink(e.url);
  ensure(
    link.kind !== 'issues',
    422,
    'AUTHORSHIP',
    'An issue link alone does not verify a contribution.',
  );
  ensure(
    (await db.projectRepository.count({
      where: { projectId: e.ticket.pod.projectId!, fullName: link.repository },
    })) === 1,
    403,
    'REPOSITORY',
    'Repository is not authorized for this project.',
  );
  const account = await db.account.findFirst({
    where: { userId: e.userId, provider: 'github' },
    select: { providerAccountId: true },
  });
  ensure(
    account,
    409,
    'GITHUB_IDENTITY',
    'Sign in with the GitHub identity that authored this work.',
  );
  const repo = z
    .object({ private: z.boolean() })
    .parse(await api.get(`repos/${link.repository}`));
  const author = z.object({ id: z.number().int().positive() }).nullable();
  let authorId: string, sha: string, state: string;
  if (link.kind === 'pull') {
    const pr = z
      .object({
        user: author,
        head: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
        merged: z.boolean(),
        state: z.string(),
        base: z.object({ repo: z.object({ full_name: z.string() }) }),
      })
      .parse(await api.get(`repos/${link.repository}/pulls/${link.reference}`));
    ensure(
      pr.user &&
        pr.base.repo.full_name.toLowerCase() === link.repository.toLowerCase(),
      409,
      'GITHUB_IDENTITY',
      'PR identity or target repository did not match.',
    );
    authorId = String(pr.user.id);
    sha = pr.head.sha;
    const reviews = z
      .array(
        z.object({
          user: author,
          state: z.string(),
          submitted_at: z.string().nullable(),
        }),
      )
      .max(100)
      .parse(
        await api.get(
          `repos/${link.repository}/pulls/${link.reference}/reviews?per_page=100`,
        ),
      );
    const latest = new Map<string, string>();
    reviews
      .filter((r) => r.user && String(r.user.id) !== authorId)
      .sort((a, b) =>
        (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''),
      )
      .forEach((r) => {
        if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
          latest.set(String(r.user!.id), r.state);
      });
    state = pr.merged
      ? 'MERGED'
      : [...latest.values()].includes('CHANGES_REQUESTED')
        ? 'CHANGES_REQUESTED'
        : [...latest.values()].includes('APPROVED')
          ? 'REVIEWED_APPROVED'
          : 'NO_APPROVAL_IN_FIRST_100_REVIEWS';
  } else {
    const commit = z
      .object({
        sha: z.string().regex(/^[a-f0-9]{40}$/),
        author,
        committer: author,
        commit: z.object({
          verification: z.object({ verified: z.boolean(), reason: z.string() }),
        }),
      })
      .parse(
        await api.get(`repos/${link.repository}/commits/${link.reference}`),
      );
    ensure(
      commit.author &&
        commit.committer &&
        commit.sha === link.reference &&
        String(commit.committer.id) === account.providerAccountId,
      409,
      'GITHUB_IDENTITY',
      'Commit must map to an authenticated GitHub author and exact SHA.',
    );
    ensure(
      commit.commit.verification.verified &&
        commit.commit.verification.reason === 'valid',
      409,
      'GITHUB_SIGNATURE',
      'A GitHub-verified commit signature is required. Unsigned or differently attributed commits remain manual evidence.',
    );
    authorId = String(commit.author.id);
    sha = commit.sha;
    state = 'SIGNED_AUTHOR_AND_COMMITTER_MATCHED';
  }
  ensure(
    authorId === account.providerAccountId,
    403,
    'GITHUB_IDENTITY',
    'GitHub authorship does not match this student. No verified work was recorded.',
  );
  return serial(async (tx) => {
    const current = await tx.contributionEvidence.findUniqueOrThrow({
      where: { id: e.id },
    });
    ensure(
      current.version === e.version && current.url === e.url,
      409,
      'VERSION',
      'Evidence changed during verification.',
    );
    const changed = !!current.providerSha && current.providerSha !== sha;
    await tx.contributionEvidence.update({
      where: { id: e.id },
      data: {
        githubVerifiedAt: new Date(),
        githubAuthorId: authorId,
        providerSha: sha,
        githubState: state,
        repositoryPublic: !repo.private,
        ...(changed
          ? {
              status: 'CHANGES_REQUESTED',
              feedback:
                'GitHub head changed; a fresh mentor review is required.',
              version: { increment: 1 },
            }
          : {}),
      },
    });
    if (changed)
      await tx.projectTicket.update({
        where: { id: e.ticketId },
        data: {
          status: 'IN_REVIEW',
          codeReviewed: false,
          qaAccepted: false,
          dodAccepted: false,
          securityCleared: false,
          version: { increment: 1 },
        },
      });
    if (changed)
      await tx.portfolioEntry.updateMany({
        where: { evidenceId: e.id },
        data: { status: 'DRAFT', approvedAt: null },
      });
    await audit(
      tx,
      a?.id ?? null,
      'GITHUB_EVIDENCE_CHECKED',
      'ContributionEvidence',
      e.id,
      { providerSha: sha, state, identityMatched: true },
    );
    return { id: e.id, state, identityMatched: true };
  });
}
export async function githubWebhook(
  raw: Buffer,
  signature: string,
  deliveryId: string,
  event: string,
  secret = env.GITHUB_PROJECT_WEBHOOK_SECRET ?? '',
  api: GitHubApi = githubApi,
) {
  ensure(
    secret,
    503,
    'GITHUB_DISABLED',
    'GitHub webhook secret is not configured.',
  );
  ensure(
    signature.startsWith('sha256=') &&
      verifyHmac(raw, signature.slice(7), secret),
    400,
    'WEBHOOK_SIGNATURE',
    'Invalid GitHub webhook signature.',
  );
  z.uuid().parse(deliveryId);
  ensure(event.length <= 80, 400, 'EVENT', 'Invalid event.');
  const payload = z
      .object({
        repository: z.object({ full_name: repoName }).optional(),
        pull_request: z
          .object({ number: z.number().int().positive() })
          .optional(),
      })
      .parse(JSON.parse(raw.toString('utf8'))),
    hash = sha256(raw),
    repository = payload.repository?.full_name ?? null;
  const saved = await getDb().projectWebhook.upsert({
    where: { deliveryId },
    create: { deliveryId, payloadHash: hash, event, repository },
    update: {},
  });
  ensure(
    saved.payloadHash === hash && saved.event === event,
    409,
    'DELIVERY_COLLISION',
    'Webhook identity was reused with different content.',
  );
  if (saved.state === 'PROCESSED' || saved.state === 'IGNORED')
    return { received: true, duplicate: true };
  if (
    !repository ||
    !payload.pull_request ||
    !['pull_request', 'pull_request_review'].includes(event) ||
    !(await getDb().projectRepository.count({
      where: { fullName: repository },
    }))
  ) {
    await getDb().projectWebhook.update({
      where: { id: saved.id },
      data: { state: 'IGNORED', processedAt: new Date() },
    });
    return { received: true, ignored: true };
  }
  const claimed = await getDb().projectWebhook.updateMany({
    where: {
      id: saved.id,
      OR: [
        { state: { in: ['RECEIVED', 'FAILED'] } },
        {
          state: 'PROCESSING',
          processingAt: { lt: new Date(Date.now() - 5 * 60000) },
        },
      ],
    },
    data: { state: 'PROCESSING', processingAt: new Date() },
  });
  if (!claimed.count) return { received: true, pending: true };
  try {
    const matching = await getDb().contributionEvidence.findMany({
      where: {
        url: `https://github.com/${repository}/pull/${payload.pull_request.number}`,
      },
      select: { id: true },
      take: 100,
    });
    for (const e of matching) await verifyEvidence(null, e.id, api);
    await getDb().projectWebhook.update({
      where: { id: saved.id },
      data: { state: 'PROCESSED', processedAt: new Date(), reason: null },
    });
    return { received: true };
  } catch (error) {
    await getDb().projectWebhook.update({
      where: { id: saved.id },
      data: {
        state: 'FAILED',
        reason: error instanceof DomainError ? error.code : 'RETRY_REQUIRED',
      },
    });
    throw error;
  }
}
