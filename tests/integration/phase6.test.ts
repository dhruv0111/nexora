import { randomUUID } from 'node:crypto';
import { transition } from '@/lib/projects/service';
import {
  submitEvidence,
  reviewEvidence,
  portfolio,
  reviewPortfolio,
} from '@/lib/projects/evidence';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { careerFixture, profileBody } from './career-fixture';
import {
  saveProfile,
  consent,
  candidate,
  createResume,
  resumeRead,
  publicProfile,
  reviewReadiness,
} from '@/lib/career/profile';
import {
  applyJob,
  moveApplication,
  employerReview,
  saveJob,
  outcome,
  registerEmployer,
  updateCompany,
} from '@/lib/career/hiring';
import { company, applicationAccess } from '@/lib/career/policy';
import {
  candidates,
  placementReport,
  applicationRead,
} from '@/lib/career/read';
import { interview, mockInterview } from '@/lib/career/interviews';
import {
  documentUpload,
  documentRead,
  retire,
  contract,
  invoice,
} from '@/lib/career/operations';
let f: Awaited<ReturnType<typeof careerFixture>>;
beforeEach(async () => {
  f = await careerFixture();
});
afterEach(async () => {
  await f?.cleanup();
});
async function apply() {
  return applyJob(f.studentActor, {
    opportunityId: f.jobId,
    statement:
      'I can explain my actual training projects and test implementation.',
    submit: true,
    shareConsent: true,
  });
}
async function stage(id: string, status: string) {
  const p = await f.db.hiringApplication.findUniqueOrThrow({ where: { id } });
  return moveApplication(f.employerActor, {
    id,
    version: p.version,
    status,
    note: 'Reviewed candidate evidence for this explicit pipeline transition.',
  });
}
it('registers and administratively reviews employers; unverified and suspended accounts stay restricted', async () => {
  const e = await f.db.employer.findUniqueOrThrow({
    where: { id: f.employerId },
  });
  await employerReview(f.adminActor, {
    employerId: e.id,
    version: e.version,
    status: 'SUSPENDED',
    note: 'Synthetic suspension after reviewing a company verification concern.',
  });
  await expect(company(f.employerActor)).rejects.toMatchObject({ status: 403 });
  expect(
    (await f.db.opportunity.findUniqueOrThrow({ where: { id: f.jobId } }))
      .status,
  ).toBe('DRAFT');
  await expect(
    employerReview(f.employerActor, {
      employerId: e.id,
      version: e.version + 1,
      status: 'VERIFIED',
      note: 'Attempting self-verification must be rejected.',
    }),
  ).rejects.toMatchObject({ status: 403 });
});
it('requires actual company and email domain agreement and preserves existing learner accounts', async () => {
  await expect(
    registerEmployer(
      f.otherStudent
        ? { id: f.otherStudent.id, role: 'STUDENT' }
        : f.studentActor,
      {
        companyName: 'No real company',
        website: 'https://official.example',
        businessEmail: 'x@different.example',
        recruiterName: 'Example Recruiter',
        industry: 'Technology',
        location: 'India',
        requirements: 'A deliberately invalid isolated domain registration.',
        confirmEmployer: true,
      },
    ),
  ).rejects.toMatchObject({ status: 422 });
  await expect(
    registerEmployer(f.studentActor, {
      companyName: 'No real company',
      website: 'https://official.example',
      businessEmail: 'x@official.example',
      recruiterName: 'Example Recruiter',
      industry: 'Technology',
      location: 'India',
      requirements: 'A student account must not lose its enrollment role.',
      confirmEmployer: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it('requires moderation and prevents duplicate jobs and stale publication edits', async () => {
  await expect(
    saveJob(f.employerActor, { ...f.jobBody, status: 'PUBLISHED' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    saveJob(f.employerActor, { ...f.jobBody }),
  ).rejects.toMatchObject({ code: 'P2002' });
  await expect(
    saveJob(f.outsiderActor, { ...f.jobBody, id: f.jobId, version: 3 }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    saveJob(f.employerActor, { ...f.jobBody, id: f.jobId, version: 2 }),
  ).rejects.toMatchObject({ status: 409 });
  await saveJob(f.employerActor, {
    ...f.jobBody,
    id: f.jobId,
    version: 3,
    title: 'Changed role needs fresh review',
  });
  expect(
    (await f.db.opportunity.findUniqueOrThrow({ where: { id: f.jobId } }))
      .moderation,
  ).toBe('PENDING');
});
it('requires consent, paid eligibility and readiness, and rejects duplicate applications', async () => {
  await expect(
    applyJob(f.studentActor, {
      opportunityId: f.jobId,
      statement: 'A synthetic application with consent deliberately denied.',
      submit: true,
      shareConsent: false,
    }),
  ).rejects.toMatchObject({ status: 422 });
  const p = await apply();
  await expect(apply()).rejects.toMatchObject({ status: 409 });
  expect((await candidate(f.employerActor, f.student.id)).email).toBeNull();
  await f.db.payment.updateMany({
    where: { enrollmentId: f.enrollmentId },
    data: { status: 'REFUNDED' },
  });
  await expect(candidate(f.employerActor, f.student.id)).rejects.toMatchObject({
    status: 403,
  });
  expect(
    (await f.db.hiringApplication.findUniqueOrThrow({ where: { id: p.id } }))
      .status,
  ).toBe('APPLIED');
});
it('enforces tenant isolation, candidate ownership and valid application transitions', async () => {
  const p = await apply();
  await expect(applicationAccess(f.outsiderActor, p.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    applicationAccess({ id: f.otherStudent.id, role: 'STUDENT' }, p.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(stage(p.id, 'OFFERED')).rejects.toMatchObject({ status: 409 });
  await expect(
    moveApplication(f.studentActor, {
      id: p.id,
      version: 1,
      status: 'SCREENING',
      note: 'A student must never shortlist their own application.',
    }),
  ).rejects.toMatchObject({ status: 403 });
  await stage(p.id, 'SCREENING');
  await stage(p.id, 'SHORTLISTED');
  expect((await applicationRead(f.studentActor, p.id)).history).toHaveLength(3);
});
it('withdrawal blocks candidate, resume and company-directory access even with global directory opt-in', async () => {
  await saveProfile(f.studentActor, {
    ...profileBody,
    version: 1,
    seeking: true,
  });
  const app = await apply(),
    r = await createResume(f.studentActor);
  expect(
    (await candidates(f.employerActor, {})).rows.map((p) => p.userId),
  ).toContain(f.student.id);
  await consent(f.studentActor, { employerId: f.employerId, grant: false });
  await expect(candidate(f.employerActor, f.student.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(resumeRead(f.employerActor, r.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await candidates(f.employerActor, {})).rows.map((p) => p.userId),
  ).not.toContain(f.student.id);
  expect(
    (await applicationRead(f.employerActor, app.id)).application.statement,
  ).toBeNull();
  await expect(stage(app.id, 'SCREENING')).rejects.toMatchObject({
    status: 404,
  });
});
it('private visibility revokes all grants; public DTO omits contact, education and raw evidence', async () => {
  await apply();
  await saveProfile(f.studentActor, {
    ...profileBody,
    version: 1,
    visibility: 'PUBLIC',
    shareContact: true,
  });
  const p = await publicProfile(f.student.id);
  expect(p).not.toHaveProperty('email');
  expect(p).not.toHaveProperty('education');
  await saveProfile(f.studentActor, {
    ...profileBody,
    version: 2,
    visibility: 'PRIVATE',
    consent: false,
  });
  await expect(publicProfile(f.student.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(candidate(f.employerActor, f.student.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (
      await f.db.careerConsent.findUniqueOrThrow({
        where: {
          userId_employerId: { userId: f.student.id, employerId: f.employerId },
        },
      })
    ).revokedAt,
  ).not.toBeNull();
});
it('shares only the latest active immutable resume, with explicit retirement', async () => {
  await apply();
  const old = await createResume(f.studentActor),
    latest = await createResume(f.studentActor);
  await expect(resumeRead(f.employerActor, old.id)).rejects.toMatchObject({
    status: 404,
  });
  expect((await resumeRead(f.employerActor, latest.id)).content).toContain(
    'training is not employment',
  );
  await expect(resumeRead(f.outsiderActor, latest.id)).rejects.toMatchObject({
    status: 404,
  });
  await retire(f.studentActor, {
    id: latest.id,
    kind: 'RESUME',
    reason: 'The student deliberately retires this outdated resume version.',
  });
  expect(
    (await f.db.careerResume.findUniqueOrThrow({ where: { id: latest.id } }))
      .content,
  ).toBeNull();
  await expect(resumeRead(f.employerActor, old.id)).rejects.toMatchObject({
    status: 404,
  });
  expect((await candidate(f.employerActor, f.student.id)).resume).toBeNull();
});
it('requests, confirms and reschedules interviews; internal feedback never reaches students', async () => {
  const app = await apply();
  await stage(app.id, 'SCREENING');
  await stage(app.id, 'SHORTLISTED');
  const b = {
    applicationId: app.id,
    version: 0,
    action: 'REQUEST',
    round: 'Technical discussion',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    timezone: 'Asia/Kolkata',
    availability: 'Mornings work best.',
    meetingUrl: 'https://meeting.example/isolated',
    feedback: '',
    privateFeedback: '',
  };
  const i = await interview(f.employerActor, b);
  await expect(interview(f.outsiderActor, b)).rejects.toMatchObject({
    status: 404,
  });
  await interview(f.studentActor, {
    ...b,
    id: i.id,
    version: 1,
    action: 'CONFIRM',
    privateFeedback: 'Candidate must not set recruiter notes.',
  });
  expect(
    (await f.db.hiringInterview.findUniqueOrThrow({ where: { id: i.id } }))
      .privateFeedback,
  ).toBe('');
  await interview(f.employerActor, {
    ...b,
    id: i.id,
    version: 2,
    action: 'RESCHEDULE',
    startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
  });
  expect(
    (await applicationRead(f.studentActor, app.id)).interviews[0],
  ).not.toHaveProperty('privateFeedback');
  await expect(
    interview(f.employerActor, {
      ...b,
      id: i.id,
      version: 2,
      action: 'CANCEL',
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it('keeps offers and confirmed joining separate with audited admin verification', async () => {
  const app = await apply();
  for (const s of ['SCREENING', 'SHORTLISTED', 'INTERVIEW'])
    await stage(app.id, s);
  const b = {
    applicationId: app.id,
    version: 0,
    action: 'RECORD_OFFER',
    reference:
      'Synthetic written offer evidence locator for this isolated test.',
    date: new Date(Date.now() - 3600000).toISOString(),
    note: 'Isolated administrative evidence review, not an actual employment offer.',
  };
  await outcome(f.employerActor, b);
  await expect(
    outcome(f.employerActor, { ...b, version: 1, action: 'VERIFY_JOINING' }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    outcome(f.adminActor, { ...b, version: 1, action: 'VERIFY_JOINING' }),
  ).rejects.toMatchObject({ status: 409 });
  await outcome(f.adminActor, { ...b, version: 1, action: 'VERIFY_OFFER' });
  let o = await f.db.hiringOutcome.findUniqueOrThrow({
    where: { applicationId: app.id },
  });
  expect(o.offerVerifiedAt).not.toBeNull();
  expect(o.joiningVerifiedAt).toBeNull();
  await outcome(f.adminActor, {
    ...b,
    version: 2,
    action: 'VERIFY_JOINING',
    date: new Date().toISOString(),
  });
  o = await f.db.hiringOutcome.findUniqueOrThrow({
    where: { applicationId: app.id },
  });
  expect(o.joiningVerifiedAt).not.toBeNull();
  expect(
    (await f.db.hiringApplication.findUniqueOrThrow({ where: { id: app.id } }))
      .status,
  ).toBe('HIRED');
  const report = await placementReport(
      f.adminActor,
      new Date(Date.now() - 86400000),
      new Date(Date.now() + 86400000),
    ),
    row = report.rows.find((r) => r.cohortId === f.cohort.id)!;
  expect(row).toMatchObject({
    enrollments: 1,
    denominator: 1,
    offers: 1,
    starts: 1,
    conversionPercent: 100,
  });
});
it('uses zero-safe, period-specific placement denominators and rejects non-admin reports', async () => {
  const report = await placementReport(
    f.adminActor,
    new Date('2000-01-01'),
    new Date('2000-02-01'),
  );
  expect(report.rows).toEqual([]);
  await expect(
    placementReport(
      f.employerActor,
      new Date('2000-01-01'),
      new Date('2000-02-01'),
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    placementReport(
      f.adminActor,
      new Date('2000-01-01'),
      new Date('2002-01-01'),
    ),
  ).rejects.toMatchObject({ status: 422 });
});
it('limits readiness and mock-interview decisions to assigned staff and keeps mock records separate', async () => {
  await expect(
    reviewReadiness(f.otherActor, {
      userId: f.student.id,
      version: 1,
      ready: true,
      communication: 10,
      preparation: 10,
      overrideScore: 100,
      reason: 'Unassigned mentor must never override this readiness decision.',
    }),
  ).rejects.toMatchObject({ status: 404 });
  const b = {
    userId: f.student.id,
    mentorId: f.mentor.id,
    version: 0,
    status: 'REQUESTED',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    availability: 'Synthetic mock practice availability.',
    feedback: '',
    score: -1,
  };
  const m = await mockInterview(f.studentActor, b);
  await mockInterview(f.mentorActor, {
    ...b,
    id: m.id,
    version: 1,
    status: 'CONFIRMED',
  });
  await expect(
    mockInterview(f.studentActor, {
      ...b,
      id: m.id,
      version: 2,
      status: 'COMPLETED',
      score: 100,
      feedback: 'Self-awarded assessment must never persist.',
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(
    await f.db.hiringInterview.count({
      where: { application: { userId: f.student.id } },
    }),
  ).toBe(0);
});
it('restricts company documents, erases retired bytes and keeps employer billing disabled', async () => {
  const d = await documentUpload(
    f.employerActor,
    new File(['Synthetic verification document.'], 'verification.txt', {
      type: 'text/plain',
    }),
  );
  await expect(documentRead(f.outsiderActor, d.id)).rejects.toMatchObject({
    status: 404,
  });
  expect((await documentRead(f.adminActor, d.id)).bytes).not.toBeNull();
  await retire(f.employerActor, {
    id: d.id,
    kind: 'DOCUMENT',
    reason: 'Retire the isolated company document and erase its contents.',
  });
  expect(
    (await f.db.careerDocument.findUniqueOrThrow({ where: { id: d.id } }))
      .bytes,
  ).toBeNull();
  const c = await contract(f.adminActor, {
    employerId: f.employerId,
    reference: 'Isolated agreement',
    feeType: 'PERCENTAGE',
    feeValue: 1000,
    currency: 'INR',
    replacementDays: 30,
    refundDays: 15,
  });
  const i = await invoice(f.adminActor, {
    contractId: c.id,
    reference: `test-${c.id}`,
    amountMinor: 1000,
    currency: 'INR',
  });
  expect(
    (await f.db.recruitmentInvoice.findUniqueOrThrow({ where: { id: i.id } }))
      .status,
  ).toBe('DRAFT');
  await expect(
    f.db.recruitmentContract.update({
      where: { id: c.id },
      data: { status: 'ACTIVE' },
    }),
  ).rejects.toThrow();
});

it('shares only separately approved nonconfidential portfolio descriptions and never private source links', async () => {
  await apply();
  await transition(f.mentorActor, {
    ticketId: f.ticketId,
    version: 1,
    status: 'READY',
  });
  await transition(f.studentActor, {
    ticketId: f.ticketId,
    version: 2,
    status: 'IN_PROGRESS',
  });
  const e = await submitEvidence(f.studentActor, {
    ticketId: f.ticketId,
    kind: 'ARTIFACT',
    summary: 'Implemented and tested the synthetic validation boundary.',
    url: 'https://private.example/secret-source',
    requestKey: randomUUID(),
  });
  await reviewEvidence(f.mentorActor, {
    id: e.id,
    version: 1,
    status: 'APPROVED',
    feedback:
      'Inspected the linked isolated artifact and its regression evidence.',
    evaluation: 4,
  });
  const p = await portfolio(f.studentActor, {
    evidenceId: e.id,
    version: 0,
    description:
      'A reviewed training contribution with a validated input boundary.',
    challenges:
      'Separated validation failures and normal application execution.',
    outcome: 'Regression demonstrates rejection of invalid synthetic inputs.',
  });
  expect(
    (await candidate(f.employerActor, f.student.id)).portfolio,
  ).toHaveLength(0);
  await reviewPortfolio(f.mentorActor, {
    id: p.id,
    version: 1,
    approve: true,
    feedback:
      'The description is supported, nonconfidential and suitable for sharing.',
  });
  const shared = await candidate(f.employerActor, f.student.id);
  expect(shared.portfolio).toHaveLength(1);
  expect(JSON.stringify(shared)).not.toContain('private.example');
  expect(JSON.stringify(shared)).not.toContain(e.id);
  await f.db.project.update({
    where: { id: f.projectId },
    data: { confidential: true },
  });
  expect(
    (await candidate(f.employerActor, f.student.id)).portfolio,
  ).toHaveLength(0);
});

it('company identity changes require renewed verification and remove published openings', async () => {
  const e = await f.db.employer.findUniqueOrThrow({
    where: { id: f.employerId },
  });
  await updateCompany(f.employerActor, {
    version: e.version,
    companyName: 'Updated isolated company',
    website: 'https://isolated.example',
    businessEmail: 'recruiter@isolated.example',
    recruiterName: 'Changed isolated recruiter',
    industry: 'Software',
    location: 'Pune',
    requirements:
      'Updated synthetic company authority and hiring requirements.',
  });
  await expect(company(f.employerActor)).rejects.toMatchObject({ status: 403 });
  expect(
    (await f.db.opportunity.findUniqueOrThrow({ where: { id: f.jobId } }))
      .status,
  ).toBe('DRAFT');
});
it('zero paid denominator remains null and readiness decisions block ineligible applications', async () => {
  await reviewReadiness(f.adminActor, {
    userId: f.student.id,
    version: 1,
    ready: false,
    communication: 5,
    preparation: 5,
    overrideScore: -1,
    reason: 'Further technical preparation is needed before applying.',
  });
  await expect(apply()).rejects.toMatchObject({ status: 403 });
  await f.db.payment.updateMany({
    where: { enrollmentId: f.enrollmentId },
    data: { status: 'REFUNDED' },
  });
  const report = await placementReport(
      f.adminActor,
      new Date(Date.now() - 86400000),
      new Date(Date.now() + 86400000),
    ),
    row = report.rows.find((r) => r.cohortId === f.cohort.id)!;
  expect(row).toMatchObject({ denominator: 0, conversionPercent: null });
});
it('concurrent applications create one record, and expired jobs reject new submissions', async () => {
  const results = await Promise.allSettled([apply(), apply()]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await f.db.hiringApplication.count({
      where: { userId: f.student.id, opportunityId: f.jobId },
    }),
  ).toBe(1);
  const p = await f.db.hiringApplication.findFirstOrThrow({
    where: { userId: f.student.id },
  });
  await f.db.hiringHistory.deleteMany({ where: { applicationId: p.id } });
  await f.db.hiringApplication.delete({ where: { id: p.id } });
  await f.db.opportunity.update({
    where: { id: f.jobId },
    data: { deadline: new Date(Date.now() - 86400000) },
  });
  await expect(apply()).rejects.toMatchObject({ status: 409 });
});

it('withdrawal cancels pending interviews without erasing their schedule history', async () => {
  const app = await apply();
  await stage(app.id, 'SCREENING');
  await stage(app.id, 'SHORTLISTED');
  const i = await interview(f.employerActor, {
    applicationId: app.id,
    version: 0,
    action: 'REQUEST',
    round: 'Synthetic technical round',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    timezone: 'Asia/Kolkata',
    availability: '',
    meetingUrl: '',
    feedback: '',
    privateFeedback: '',
  });
  await moveApplication(f.studentActor, {
    id: app.id,
    version: 3,
    status: 'WITHDRAWN',
    note: 'Candidate withdraws and cancels their pending interview.',
  });
  const saved = await f.db.hiringInterview.findUniqueOrThrow({
    where: { id: i.id },
  });
  expect(saved.status).toBe('CANCELLED');
  expect(saved.startsAt).toBeInstanceOf(Date);
});
