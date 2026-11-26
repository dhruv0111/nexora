import { projectFixture } from './project-fixture';
import {
  registerEmployer,
  employerReview,
  saveJob,
  moderateJob,
} from '@/lib/career/hiring';
import { saveProfile, reviewReadiness } from '@/lib/career/profile';
export const profileBody = {
  version: 0,
  displayName: 'Isolated Career Learner',
  headline: 'QA engineer building reliable systems',
  summary:
    'A synthetic career profile used only to verify privacy and hiring workflows.',
  education: 'Synthetic qualification',
  background: 'No professional employment claimed from training.',
  experienceYears: 0,
  skills: ['TypeScript', 'Testing'],
  preferredRoles: ['QA Engineer'],
  locations: ['Bengaluru'],
  workModes: ['REMOTE' as const],
  eligibility: 'India',
  visibility: 'EMPLOYERS' as const,
  shareContact: false,
  seeking: false,
  consent: true,
};
export async function careerFixture() {
  const f = await projectFixture(),
    db = f.db;
  const recruiter = await db.user.create({
      data: {
        id: `${f.course.id}recruiter`,
        role: 'EMPLOYER',
        name: 'Isolated Recruiter',
      },
    }),
    outsider = await db.user.create({
      data: {
        id: `${f.course.id}outsider`,
        role: 'EMPLOYER',
        name: 'Other Isolated Recruiter',
      },
    });
  const employerActor = { id: recruiter.id, role: 'EMPLOYER' as const },
    outsiderActor = { id: outsider.id, role: 'EMPLOYER' as const };
  async function register(actor: typeof employerActor, name: string) {
    const e = await registerEmployer(actor, {
      companyName: name,
      website: 'https://isolated.example',
      businessEmail: 'recruiter@isolated.example',
      recruiterName: 'Isolated Recruiter',
      industry: 'Software testing',
      location: 'Bengaluru',
      requirements:
        'Synthetic administrative company review; no real partnership or employer.',
      confirmEmployer: true,
    });
    await employerReview(actor, {
      employerId: e.id,
      version: 1,
      status: 'PENDING_REVIEW',
      note: 'Synthetic submission of domain and recruiter authority evidence.',
    });
    await employerReview(f.adminActor, {
      employerId: e.id,
      version: 2,
      status: 'VERIFIED',
      note: 'Isolated administrative review fixture, not verification of a real company.',
    });
    return e.id;
  }
  const employerId = await register(employerActor, 'Isolated employer'),
    otherEmployerId = await register(
      outsiderActor,
      'Unrelated isolated employer',
    );
  await saveProfile(f.studentActor, profileBody);
  await reviewReadiness(f.adminActor, {
    userId: f.student.id,
    version: 0,
    ready: true,
    communication: 8,
    preparation: 8,
    overrideScore: -1,
    reason:
      'Reviewed synthetic technical and career evidence in this isolated fixture.',
  });
  const jobBody = {
    version: 0,
    title: 'Isolated QA engineer',
    description:
      'Build reliable API tests against synthetic application data and review evidence.',
    skills: ['TypeScript', 'Testing'],
    employmentType: 'FULL_TIME' as const,
    location: 'Bengaluru',
    workMode: 'REMOTE' as const,
    eligibility: 'India',
    minExperience: 0,
    compensationMin: 0,
    compensationMax: 0,
    currency: 'INR' as const,
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    status: 'DRAFT' as const,
  };
  const j = await saveJob(employerActor, jobBody);
  await moderateJob(f.adminActor, {
    id: j.id,
    version: 1,
    decision: 'APPROVED',
    note: 'Reviewed isolated role requirements and employer legitimacy in fixture.',
  });
  await saveJob(employerActor, {
    ...jobBody,
    id: j.id,
    version: 2,
    status: 'PUBLISHED',
  });
  async function cleanup() {
    const userIds = [
        f.student.id,
        f.otherStudent.id,
        recruiter.id,
        outsider.id,
      ],
      apps = await db.hiringApplication.findMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            {
              opportunity: {
                employerId: { in: [employerId, otherEmployerId] },
              },
            },
          ],
        },
        select: { id: true },
      }),
      ids = apps.map((p) => p.id);
    await db.hiringOutcome.deleteMany({
      where: { applicationId: { in: ids } },
    });
    await db.hiringInterview.deleteMany({
      where: { applicationId: { in: ids } },
    });
    await db.hiringHistory.deleteMany({
      where: { applicationId: { in: ids } },
    });
    await db.hiringApplication.deleteMany({ where: { id: { in: ids } } });
    await db.careerConsent.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerDocument.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerResume.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerMock.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerRequest.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerReadiness.deleteMany({ where: { userId: { in: userIds } } });
    await db.careerProfile.deleteMany({ where: { userId: { in: userIds } } });
    const contracts = await db.recruitmentContract.findMany({
      where: { employerId: { in: [employerId, otherEmployerId] } },
      select: { id: true },
    });
    await db.recruitmentInvoice.deleteMany({
      where: { contractId: { in: contracts.map((c) => c.id) } },
    });
    await db.recruitmentContract.deleteMany({
      where: { employerId: { in: [employerId, otherEmployerId] } },
    });
    await db.opportunity.deleteMany({
      where: { employerId: { in: [employerId, otherEmployerId] } },
    });
    await db.employer.deleteMany({
      where: { id: { in: [employerId, otherEmployerId] } },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [recruiter.id, outsider.id] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [recruiter.id, outsider.id] } },
    });
    await f.cleanup();
  }
  return {
    ...f,
    employerActor,
    outsiderActor,
    employerId,
    otherEmployerId,
    jobId: j.id,
    jobBody,
    cleanup,
  };
}
