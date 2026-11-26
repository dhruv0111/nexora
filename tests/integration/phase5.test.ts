import { beforeEach, afterEach, it, describe, expect } from 'vitest';
import { randomUUID, createHmac } from 'node:crypto';
import { projectFixture } from './project-fixture';
import { podAccess } from '@/lib/projects/policy';
import { projectsFor } from '@/lib/projects/read';
import {
  createPod,
  saveTicket,
  saveProject,
  transition,
  quality,
  membership,
  sprint,
} from '@/lib/projects/service';
import {
  submitEvidence,
  reviewEvidence,
  portfolio,
  reviewPortfolio,
  exportPortfolio,
  release,
  concern,
} from '@/lib/projects/evidence';
import { projectUpload, projectFile, retire } from '@/lib/projects/files';
import {
  githubWebhook,
  verifyEvidence,
  linkRepository,
  type GitHubApi,
} from '@/lib/projects/github';
let f: Awaited<ReturnType<typeof projectFixture>>;
beforeEach(async () => {
  f = await projectFixture();
});
afterEach(async () => {
  await f?.cleanup();
});
async function move(status: string, staff = true) {
  const t = await f.db.projectTicket.findUniqueOrThrow({
    where: { id: f.ticketId },
  });
  return transition(staff ? f.mentorActor : f.studentActor, {
    ticketId: t.id,
    version: t.version,
    status,
  });
}
async function evidence(kind = 'ARTIFACT', url = '') {
  await move('READY');
  await move('IN_PROGRESS', false);
  const record = await submitEvidence(f.studentActor, {
    ticketId: f.ticketId,
    kind,
    summary:
      'Implemented request validation and supplied invalid-input regression evidence.',
    url,
    requestKey: randomUUID(),
  });
  if (kind === 'ARTIFACT')
    await projectUpload(
      f.studentActor,
      record.id,
      new File(
        ['Actual isolated validation artifact and regression evidence.'],
        'reviewable.txt',
        { type: 'text/plain' },
      ),
    );
  return record;
}
async function approve(id: string) {
  return reviewEvidence(f.mentorActor, {
    id,
    version: 1,
    status: 'APPROVED',
    feedback:
      'Reviewed the artifact and verified the specific stated implementation and test evidence.',
    evaluation: 4,
  });
}
async function gates() {
  const t = await f.db.projectTicket.findUniqueOrThrow({
    where: { id: f.ticketId },
  });
  return quality(f.mentorActor, {
    ticketId: t.id,
    version: t.version,
    codeReviewed: true,
    qaAccepted: true,
    dodAccepted: true,
    securityCleared: true,
    note: 'Reviewed the change, QA evidence, Definition of Done and security checks.',
  });
}
describe('Phase 5 delivery, evidence and confidentiality invariants', () => {
  it('rejects cross-pod, unrelated mentor and unpaid access, including discovery', async () => {
    await expect(
      podAccess({ id: f.otherStudent.id, role: 'STUDENT' }, f.podId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(podAccess(f.otherActor, f.podId)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await projectsFor({ id: f.otherStudent.id, role: 'STUDENT' }),
    ).toHaveLength(0);
    const peerEnrollment = await f.db.enrollment.create({
      data: {
        userId: f.otherStudent.id,
        cohortId: f.cohort.id,
        status: 'ACTIVE',
        payments: {
          create: {
            amountMinor: 123400,
            currency: 'INR',
            provider: 'razorpay',
            providerRef: `pay_peer${randomUUID().replaceAll('-', '')}`,
            idempotencyKey: randomUUID(),
            status: 'SUCCEEDED',
            verifiedAt: new Date(),
          },
        },
      },
    });
    const peerPod = await createPod(f.mentorActor, {
      projectId: f.projectId,
      name: 'Another pod in the same project',
    });
    await membership(f.mentorActor, {
      podId: peerPod.id,
      userId: f.otherStudent.id,
      enrollmentId: peerEnrollment.id,
      supervisorId: f.mentor.id,
      responsibility:
        'Contribute to a different authorized pod in the same project.',
      version: 0,
      remove: false,
    });
    await expect(
      podAccess({ id: f.otherStudent.id, role: 'STUDENT' }, f.podId),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await projectsFor({ id: f.otherStudent.id, role: 'STUDENT' })
      )[0].pods.map((p) => p.id),
    ).toEqual([peerPod.id]);
    await f.db.agilePod.delete({ where: { id: peerPod.id } });
    await f.db.payment.update({
      where: { id: f.paymentId },
      data: { status: 'REFUNDED' },
    });
    await expect(podAccess(f.studentActor, f.podId)).rejects.toMatchObject({
      status: 403,
    });
    expect(await projectsFor(f.studentActor)).toHaveLength(0);
  });
  it('publishes project drafts with scoped versioned controls and preserves confidentiality authority', async () => {
    const p = await f.db.project.findUniqueOrThrow({
        where: { id: f.projectId },
      }),
      body = {
        id: p.id,
        version: p.version,
        title: p.title,
        brief: p.brief,
        technologies: p.technologies,
        confidential: p.confidential,
        status: 'DRAFT',
        publicationNote:
          'Preparing this supervised project for a reviewed training launch.',
      };
    await expect(saveProject(f.studentActor, body)).rejects.toMatchObject({
      status: 403,
    });
    await saveProject(f.mentorActor, body);
    expect(await projectsFor(f.studentActor)).toHaveLength(0);
    await expect(
      saveProject(f.mentorActor, {
        ...body,
        version: 2,
        status: 'PUBLISHED',
        confidential: true,
      }),
    ).rejects.toMatchObject({ code: 'PUBLICATION' });
    await saveProject(f.adminActor, {
      ...body,
      version: 2,
      status: 'PUBLISHED',
    });
    expect((await projectsFor(f.studentActor))[0].id).toBe(p.id);
    await expect(
      saveProject(f.adminActor, { ...body, status: 'PUBLISHED' }),
    ).rejects.toMatchObject({ code: 'VERSION' });
  });
  it('requires verified enrollment, a real supervisor and current membership versions', async () => {
    await expect(
      membership(f.mentorActor, {
        podId: f.podId,
        userId: f.otherStudent.id,
        enrollmentId: f.enrollmentId,
        supervisorId: f.mentor.id,
        responsibility: 'Trying to assign an unrelated unpaid learner.',
        version: 0,
        remove: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      membership(f.mentorActor, {
        podId: f.podId,
        userId: f.student.id,
        enrollmentId: f.enrollmentId,
        supervisorId: f.mentor.id,
        responsibility: 'Trying a stale membership update.',
        version: 0,
        remove: false,
      }),
    ).rejects.toMatchObject({ code: 'VERSION' });
  });
  it('supports cross-track paid members only after supervisor cohort authorization', async () => {
    const c = await f.db.course.create({
      data: {
        slug: `cross-${f.projectId}`,
        title: 'Isolated AI track',
        description: 'Synthetic cross-functional fixture only.',
        track: 'AI_ENGINEERING',
        status: 'PUBLISHED',
        contentApprovedAt: new Date(),
      },
    });
    const cohort = await f.db.cohort.create({
      data: { courseId: c.id, name: 'Isolated AI cohort', status: 'PUBLISHED' },
    });
    const e = await f.db.enrollment.create({
      data: {
        userId: f.otherStudent.id,
        cohortId: cohort.id,
        status: 'ACTIVE',
        payments: {
          create: {
            amountMinor: 10000,
            currency: 'INR',
            provider: 'razorpay',
            providerRef: `pay_cross${randomUUID().replaceAll('-', '')}`,
            idempotencyKey: randomUUID(),
            status: 'SUCCEEDED',
            verifiedAt: new Date(),
          },
        },
      },
    });
    const b = {
      podId: f.podId,
      userId: f.otherStudent.id,
      enrollmentId: e.id,
      supervisorId: f.mentor.id,
      responsibility:
        'Evaluate synthetic matching quality and explain the result.',
      version: 0,
      remove: false,
    };
    try {
      await expect(membership(f.adminActor, b)).rejects.toMatchObject({
        status: 404,
      });
      await f.db.cohortMentor.create({
        data: { cohortId: cohort.id, mentorId: f.profile.id },
      });
      await membership(f.adminActor, b);
      expect(
        (
          await f.db.podMember.findUniqueOrThrow({
            where: {
              podId_userId: { podId: f.podId, userId: f.otherStudent.id },
            },
          })
        ).discipline,
      ).toBe('AI_ENGINEERING');
    } finally {
      await f.db.podMember.deleteMany({
        where: { podId: f.podId, userId: f.otherStudent.id },
      });
      await f.db.payment.deleteMany({ where: { enrollmentId: e.id } });
      await f.db.enrollment.delete({ where: { id: e.id } });
      await f.db.cohort.delete({ where: { id: cohort.id } });
      await f.db.course.delete({ where: { id: c.id } });
    }
  });
  it('enforces transitions, assignee ownership, review gates and security blockers', async () => {
    await expect(move('DONE', false)).rejects.toMatchObject({
      code: 'TRANSITION',
    });
    const e = await evidence();
    await move('IN_REVIEW', false);
    await expect(move('QA_TESTING')).rejects.toMatchObject({
      code: 'REVIEW_GATE',
    });
    await gates();
    await move('QA_TESTING');
    await expect(move('DONE')).rejects.toMatchObject({ code: 'EVIDENCE_GATE' });
    await approve(e.id);
    const c = await concern(f.studentActor, {
      podId: f.podId,
      kind: 'SECURITY',
      description: 'A potential unsafe input boundary needs explicit review.',
      resolution: '',
    });
    await expect(move('DONE')).rejects.toMatchObject({ code: 'SECURITY_GATE' });
    await concern(f.mentorActor, {
      id: c.id,
      podId: f.podId,
      kind: 'SECURITY',
      description: 'Reviewed unsafe input boundary.',
      resolution:
        'Added validation and checked the invalid-input regression evidence.',
    });
    expect((await move('DONE')).status).toBe('DONE');
  });
  it('protects ticket edits and invalidates approvals when reviewed requirements change', async () => {
    const e = await evidence();
    await approve(e.id);
    const t = await f.db.projectTicket.findUniqueOrThrow({
      where: { id: f.ticketId },
    });
    const b = {
      id: t.id,
      podId: t.podId,
      version: t.version,
      sprintId: t.sprintId!,
      assigneeId: t.assigneeId!,
      title: t.title,
      requirements:
        'Updated validation requirements with a new edge-case criterion.',
      acceptance: t.acceptance,
      definitionOfDone: t.definitionOfDone,
      priority: t.priority,
      kind: t.kind,
      dueAt: t.dueAt!.toISOString(),
      issueUrl: '',
    };
    await expect(saveTicket(f.studentActor, b)).rejects.toMatchObject({
      status: 403,
    });
    await saveTicket(f.mentorActor, b);
    expect(
      (
        await f.db.contributionEvidence.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).status,
    ).toBe('CHANGES_REQUESTED');
    await expect(saveTicket(f.mentorActor, b)).rejects.toMatchObject({
      code: 'VERSION',
    });
  });
  it('keeps manual evidence unverified, records review and does not permit student approval', async () => {
    const e = await evidence();
    await expect(
      reviewEvidence(f.studentActor, {
        id: e.id,
        version: 1,
        status: 'APPROVED',
        feedback: 'Attempt to approve my own submitted artifact.',
        evaluation: 5,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await approve(e.id);
    const row = await f.db.contributionEvidence.findUniqueOrThrow({
      where: { id: e.id },
    });
    expect(row.status).toBe('APPROVED');
    expect(row.githubVerifiedAt).toBeNull();
    expect(
      await f.db.evidenceRevision.count({ where: { evidenceId: e.id } }),
    ).toBe(1);
  });
  it('makes exact evidence retries idempotent and keeps requested changes in history', async () => {
    await move('READY');
    await move('IN_PROGRESS', false);
    const b = {
      ticketId: f.ticketId,
      kind: 'ARTIFACT',
      summary:
        'An actual isolated validation contribution with inspectable evidence.',
      url: '',
      requestKey: randomUUID(),
    };
    const e = await submitEvidence(f.studentActor, b);
    expect((await submitEvidence(f.studentActor, b)).id).toBe(e.id);
    await expect(approve(e.id)).rejects.toMatchObject({
      code: 'ARTIFACT_REQUIRED',
    });
    await reviewEvidence(f.mentorActor, {
      id: e.id,
      version: 1,
      status: 'CHANGES_REQUESTED',
      feedback: 'Add an explicit regression for an empty input payload.',
      evaluation: 2,
    });
    expect(
      (
        await f.db.contributionEvidence.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).status,
    ).toBe('CHANGES_REQUESTED');
  });
  it('exports only separately approved owned evidence and excludes confidential projects and URLs', async () => {
    const e = await evidence();
    await approve(e.id);
    const p = await portfolio(f.studentActor, {
      evidenceId: e.id,
      version: 0,
      description:
        'Implemented and tested the request-validation boundary for a supervised training project.',
      challenges:
        'Separated parsing, validation errors and tested invalid payloads independently.',
      outcome:
        'A reviewed regression demonstrates rejection of malformed payloads.',
    });
    expect((await exportPortfolio(f.student.id)).entries).toHaveLength(0);
    await reviewPortfolio(f.mentorActor, {
      id: p.id,
      version: 1,
      approve: true,
      feedback:
        'The public summary is accurate, supported and does not disclose confidential details.',
    });
    const report = await exportPortfolio(f.student.id);
    expect(report.entries).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain('https://');
    expect(JSON.stringify(report)).not.toContain('hours');
    await f.db.project.update({
      where: { id: f.projectId },
      data: { confidential: true },
    });
    expect((await exportPortfolio(f.student.id)).entries).toHaveLength(0);
  });
  it('protects private attachments and supports audited byte erasure without certifying removed evidence', async () => {
    const e = await evidence(),
      file = await projectUpload(
        f.studentActor,
        e.id,
        new File(['Private training artifact'], 'artifact.txt', {
          type: 'text/plain',
        }),
      );
    await expect(
      projectFile({ id: f.otherStudent.id, role: 'STUDENT' }, file.id),
    ).rejects.toMatchObject({ status: 404 });
    await approve(e.id);
    await expect(
      projectUpload(
        f.studentActor,
        e.id,
        new File(['Late mutation'], 'later.txt', { type: 'text/plain' }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      retire(f.studentActor, {
        kind: 'FILE',
        id: file.id,
        reason: 'Unauthorized deletion of approved evidence.',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await retire(f.adminActor, {
      kind: 'FILE',
      id: file.id,
      reason: 'Approved isolated test data retention request.',
    });
    expect(
      (await f.db.projectFile.findUniqueOrThrow({ where: { id: file.id } }))
        .data,
    ).toBeNull();
    await expect(projectFile(f.mentorActor, file.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('requires delivery gates for releases and never infers deployment from Done', async () => {
    await expect(
      release(f.mentorActor, {
        podId: f.podId,
        title: 'Isolated release',
        notes: 'Reviewed isolated synthetic training release.',
        status: 'READY',
        deploymentUrl: '',
      }),
    ).rejects.toMatchObject({ code: 'RELEASE_GATE' });
    const e = await evidence();
    await approve(e.id);
    await move('IN_REVIEW', false);
    await gates();
    await move('QA_TESTING');
    await gates();
    await move('DONE');
    await expect(
      release(f.mentorActor, {
        podId: f.podId,
        title: 'Isolated release',
        notes: 'Reviewed isolated synthetic training release.',
        status: 'DEPLOYED',
        deploymentUrl: '',
      }),
    ).rejects.toMatchObject({ code: 'DEPLOYMENT' });
    const r = await release(f.mentorActor, {
      podId: f.podId,
      title: 'Isolated readiness signoff',
      notes: 'Reviewed isolated synthetic training release.',
      status: 'READY',
      deploymentUrl: '',
    });
    expect(
      (await f.db.projectRelease.findUniqueOrThrow({ where: { id: r.id } }))
        .status,
    ).toBe('READY');
  });
  it('verifies GitHub identity server-side, rejects signatures and deduplicates signed deliveries', async () => {
    const repo = `test-${f.projectId}/hireflow`;
    await linkRepository(f.adminActor, {
      projectId: f.projectId,
      fullName: repo,
    });
    await f.db.account.create({
      data: {
        userId: f.student.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: '424242',
      },
    });
    const e = await evidence(
      'PULL_REQUEST',
      `https://github.com/${repo}/pull/1`,
    );
    let calls = 0;
    let providerSha = 'a'.repeat(40);
    const api: GitHubApi = {
      ready: () => true,
      get: async (path) => {
        calls++;
        return path.endsWith('per_page=100')
          ? [
              {
                user: { id: 99 },
                state: 'APPROVED',
                submitted_at: new Date().toISOString(),
              },
            ]
          : path.includes('/pulls/')
            ? {
                user: { id: 424242 },
                head: { sha: providerSha },
                merged: false,
                state: 'open',
                base: { repo: { full_name: repo } },
              }
            : { private: true };
      },
    };
    const raw = Buffer.from(
        JSON.stringify({
          repository: { full_name: repo },
          pull_request: { number: 1 },
        }),
      ),
      secret = 'isolated-github-webhook-secret',
      signature =
        'sha256=' + createHmac('sha256', secret).update(raw).digest('hex'),
      delivery = randomUUID();
    await expect(
      githubWebhook(
        raw,
        'sha256=' + '0'.repeat(64),
        delivery,
        'pull_request',
        secret,
        api,
      ),
    ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE' });
    await githubWebhook(raw, signature, delivery, 'pull_request', secret, api);
    const count = calls;
    expect(
      await githubWebhook(
        raw,
        signature,
        delivery,
        'pull_request',
        secret,
        api,
      ),
    ).toMatchObject({ duplicate: true });
    expect(calls).toBe(count);
    const row = await f.db.contributionEvidence.findUniqueOrThrow({
      where: { id: e.id },
    });
    expect(row.githubVerifiedAt).not.toBeNull();
    expect(row.status).toBe('SUBMITTED');
    expect(row.repositoryPublic).toBe(false);
    await expect(
      verifyEvidence(f.studentActor, e.id, {
        ready: () => true,
        get: async () => ({ private: true, user: { id: 11 } }),
      }),
    ).rejects.toBeTruthy();
    await approve(e.id);
    providerSha = 'b'.repeat(40);
    await verifyEvidence(f.mentorActor, e.id, api);
    expect(
      (
        await f.db.contributionEvidence.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).status,
    ).toBe('CHANGES_REQUESTED');
    expect(
      (
        await f.db.projectTicket.findUniqueOrThrow({
          where: { id: f.ticketId },
        })
      ).status,
    ).toBe('IN_REVIEW');
  });
  it('does not certify unsigned commit attribution and requires signed author/committer identity', async () => {
    const repo = `test-${f.projectId}/hireflow`;
    await linkRepository(f.adminActor, {
      projectId: f.projectId,
      fullName: repo,
    });
    await f.db.account.create({
      data: {
        userId: f.student.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: '424242',
      },
    });
    const e = await evidence(
      'COMMIT',
      `https://github.com/${repo}/commit/${'a'.repeat(40)}`,
    );
    let verified = false;
    const api: GitHubApi = {
      ready: () => true,
      get: async (path) =>
        path.includes('/commits/')
          ? {
              sha: 'a'.repeat(40),
              author: { id: 424242 },
              committer: { id: 424242 },
              commit: {
                verification: {
                  verified,
                  reason: verified ? 'valid' : 'unsigned',
                },
              },
            }
          : { private: true },
    };
    await expect(
      verifyEvidence(f.studentActor, e.id, api),
    ).rejects.toMatchObject({ code: 'GITHUB_SIGNATURE' });
    expect(
      (
        await f.db.contributionEvidence.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).githubVerifiedAt,
    ).toBeNull();
    verified = true;
    await verifyEvidence(f.studentActor, e.id, api);
    expect(
      (
        await f.db.contributionEvidence.findUniqueOrThrow({
          where: { id: e.id },
        })
      ).githubState,
    ).toBe('SIGNED_AUTHOR_AND_COMMITTER_MATCHED');
  });
  it('requires a retrospective and preserves sprint lifecycle', async () => {
    const sp = await f.db.projectSprint.findUniqueOrThrow({
      where: { id: f.sprintId },
    });
    const b = {
      id: sp.id,
      podId: f.podId,
      version: sp.version,
      name: sp.name,
      goal: sp.goal,
      startsAt: sp.startsAt.toISOString(),
      endsAt: sp.endsAt.toISOString(),
      status: 'COMPLETED',
      retrospective: '',
    };
    await expect(sprint(f.mentorActor, b)).rejects.toMatchObject({
      code: 'RETROSPECTIVE',
    });
    await sprint(f.mentorActor, {
      ...b,
      retrospective:
        'Delivered validation work; next sprint will improve edge-case coverage.',
    });
  });
});
