import 'server-only';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { pageNumber } from '@/lib/learning/policy';
import {
  role,
  company,
  paid,
  applicationAccess,
  consentAccess,
} from './policy';
import { readiness } from './profile';
export function matchReasons(
  p: {
    skills: string[];
    locations: string[];
    workModes: string[];
    eligibility: string;
    experienceYears: number;
  },
  j: {
    skills: string[];
    location: string;
    workMode: string;
    eligibility: string;
    minExperience: number;
  },
  facts: {
    graduated: boolean;
    assessments: number;
    portfolios: number;
    approvedTechnologies?: string[];
  },
) {
  const skills = j.skills.filter((s) =>
    p.skills.some((v) => v.toLowerCase() === s.toLowerCase()),
  );
  const reviewed = j.skills.filter((s) =>
    facts.approvedTechnologies?.some(
      (t) => t.toLowerCase() === s.toLowerCase(),
    ),
  );
  return [
    ...(reviewed.length
      ? [`Mentor-reviewed training technologies match: ${reviewed.join(', ')}`]
      : []),
    ...(skills.length
      ? [`Self-reported skills overlap: ${skills.join(', ')}`]
      : ['No self-reported skill overlap yet']),
    p.workModes.includes(j.workMode)
      ? 'Preferred work mode matches'
      : 'Work mode needs your review',
    p.locations.some((l) => l.toLowerCase() === j.location.toLowerCase())
      ? 'Preferred location matches'
      : 'Review location requirements',
    p.experienceYears >= j.minExperience
      ? 'Self-reported experience meets the listed minimum'
      : 'Review the experience prerequisite',
    p.eligibility.toLowerCase() === j.eligibility.toLowerCase()
      ? 'Self-reported work eligibility matches'
      : 'Confirm work eligibility directly',
    ...(facts.graduated ? ['Completed enrollment recorded'] : []),
    ...(facts.assessments
      ? [`${facts.assessments} passed technical assessments recorded`]
      : []),
    ...(facts.portfolios
      ? [`${facts.portfolios} publication-approved training portfolios`]
      : []),
  ];
}
export async function jobs(a: Actor, q: Record<string, string | undefined>) {
  await role(a, ['STUDENT', 'EMPLOYER', 'ADMIN', 'MENTOR']);
  const page = pageNumber(q.page),
    where = {
      status: 'PUBLISHED' as const,
      moderation: 'APPROVED',
      deadline: { gt: new Date() },
      employer: { verificationStatus: 'VERIFIED', verifiedAt: { not: null } },
      ...(q.q
        ? {
            title: {
              contains: q.q.slice(0, 100),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(['REMOTE', 'HYBRID', 'ONSITE'].includes(q.mode ?? '')
        ? { workMode: q.mode }
        : {}),
    };
  return {
    page,
    rows: await getDb().opportunity.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        skills: true,
        location: true,
        workMode: true,
        employmentType: true,
        minExperience: true,
        eligibility: true,
        compensationMin: true,
        compensationMax: true,
        currency: true,
        deadline: true,
        employer: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
    }),
  };
}
export async function jobRead(a: Actor, id: string) {
  await role(a, ['STUDENT', 'EMPLOYER', 'ADMIN', 'MENTOR']);
  const j = await getDb().opportunity.findUnique({
    where: { id },
    include: {
      employer: {
        select: {
          companyName: true,
          userId: true,
          verificationStatus: true,
          verifiedAt: true,
        },
      },
    },
  });
  ensure(j, 404, 'JOB', 'Opening not found.');
  if (
    a.role !== 'ADMIN' &&
    !(a.role === 'EMPLOYER' && j.employer.userId === a.id)
  )
    ensure(
      j.status === 'PUBLISHED' &&
        j.moderation === 'APPROVED' &&
        j.deadline &&
        j.deadline > new Date() &&
        j.employer.verificationStatus === 'VERIFIED' &&
        j.employer.verifiedAt,
      404,
      'JOB',
      'Opening not found.',
    );
  return j;
}
export async function careerHome(a: Actor) {
  await role(a, ['STUDENT', 'ADMIN', 'MENTOR']);
  const db = getDb();
  if (a.role !== 'STUDENT') return null;
  const [
    profile,
    applications,
    mocks,
    requests,
    notifications,
    score,
    mentors,
  ] = await Promise.all([
    db.careerProfile.findUnique({ where: { userId: a.id } }),
    db.hiringApplication.findMany({
      where: { userId: a.id },
      include: {
        opportunity: {
          select: { title: true, employer: { select: { companyName: true } } },
        },
        outcome: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    db.careerMock.findMany({
      where: { userId: a.id },
      orderBy: { startsAt: 'desc' },
      take: 20,
    }),
    db.careerRequest.findMany({
      where: { userId: a.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.learningNotification.findMany({
      where: { userId: a.id, href: { startsWith: '/career' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    readiness(a.id),
    db.user.findMany({
      where: {
        role: 'MENTOR',
        mentor: {
          cohorts: {
            some: {
              cohort: { enrollments: { some: { userId: a.id, ...paid } } },
            },
          },
        },
      },
      select: { id: true, name: true },
      take: 50,
    }),
  ]);
  return {
    profile,
    applications,
    mocks,
    requests,
    notifications,
    score,
    mentors,
  };
}
export async function applicationRead(a: Actor, id: string) {
  const p = await applicationAccess(a, id),
    db = getDb();
  let profile = null;
  try {
    profile = await consentAccess(a, p.userId);
  } catch {
    /* Recruiters retain operational status without candidate data after withdrawal. */
  }
  const [history, interviews, outcome] = await Promise.all([
    db.hiringHistory.findMany({
      where: { applicationId: p.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        ...(a.role === 'STUDENT' ? {} : { note: true }),
      },
    }),
    db.hiringInterview.findMany({
      where: { applicationId: p.id },
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: {
        id: true,
        round: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        availability: true,
        meetingUrl: true,
        status: true,
        feedback: true,
        version: true,
        ...(a.role === 'STUDENT' ? {} : { privateFeedback: true }),
      },
    }),
    db.hiringOutcome.findUnique({
      where: { applicationId: p.id },
      select: {
        version: true,
        offeredAt: true,
        offerVerifiedAt: true,
        joinedAt: true,
        joiningVerifiedAt: true,
      },
    }),
  ]);
  return {
    application: {
      id: p.id,
      userId: p.userId,
      status: p.status,
      version: p.version,
      title: p.opportunity.title,
      companyName: p.opportunity.employer.companyName,
      statement: profile || a.role === 'STUDENT' ? p.statement : null,
    },
    sharing: !!profile,
    history,
    interviews:
      !profile && a.role === 'EMPLOYER'
        ? interviews.map((i) => ({
            ...i,
            availability: '',
            privateFeedback: '',
            feedback: '',
            meetingUrl: '',
          }))
        : interviews,
    outcome,
  };
}
export async function candidates(
  a: Actor,
  q: Record<string, string | undefined>,
) {
  const e = await company(a),
    page = pageNumber(q.page);
  const rows = await getDb().careerProfile.findMany({
    where: {
      visibility: { in: ['EMPLOYERS', 'PUBLIC'] },
      consentedAt: { not: null },
      AND: [
        {
          OR: [
            { seeking: true },
            {
              user: {
                careerConsents: { some: { employerId: e.id, revokedAt: null } },
              },
            },
          ],
        },
        {
          user: {
            careerConsents: {
              none: { employerId: e.id, revokedAt: { not: null } },
            },
          },
        },
      ],
      user: {
        role: 'STUDENT',
        careerReadiness: { ready: true },
        enrollments: { some: paid },
      },
      ...(q.q ? { skills: { has: q.q.slice(0, 100) } } : {}),
      ...(q.experience
        ? {
            experienceYears: {
              gte: Math.max(0, Math.min(60, Number(q.experience) || 0)),
            },
          }
        : {}),
    },
    select: {
      userId: true,
      displayName: true,
      headline: true,
      skills: true,
      experienceYears: true,
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * 20,
    take: 20,
  });
  return { page, rows };
}
export async function employerHome(
  a: Actor,
  q: Record<string, string | undefined> = {},
) {
  const e = await company(a, undefined, false),
    page = pageNumber(q.page),
    db = getDb();
  return {
    company: e,
    jobs: await db.opportunity.findMany({
      where: { employerId: e.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
    }),
    applications:
      e.verificationStatus === 'VERIFIED'
        ? await db.hiringApplication.findMany({
            where: {
              opportunity: { employerId: e.id },
              status: { not: 'DRAFT' },
            },
            select: {
              id: true,
              status: true,
              opportunity: { select: { title: true } },
            },
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * 20,
            take: 20,
          })
        : [],
    analytics:
      e.verificationStatus === 'VERIFIED'
        ? await db.hiringApplication.groupBy({
            by: ['status'],
            where: {
              opportunity: { employerId: e.id },
              status: { not: 'DRAFT' },
            },
            _count: true,
          })
        : [],
    page,
  };
}
export async function administration(
  a: Actor,
  q: Record<string, string | undefined>,
) {
  await role(a, ['ADMIN', 'MENTOR']);
  const db = getDb(),
    page = pageNumber(q.page);
  const studentWhere = {
    role: 'STUDENT' as const,
    ...(a.role === 'MENTOR'
      ? {
          enrollments: {
            some: {
              cohort: { mentors: { some: { mentor: { userId: a.id } } } },
            },
          },
        }
      : {}),
  };
  const [students, mocks] = await Promise.all([
    db.user.findMany({
      where: studentWhere,
      select: { id: true, name: true, careerReadiness: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
    }),
    db.careerMock.findMany({
      where: a.role === 'MENTOR' ? { mentorId: a.id, user: studentWhere } : {},
      orderBy: { startsAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
    }),
  ]);
  return {
    page,
    students,
    mocks,
    employers:
      a.role === 'ADMIN'
        ? await db.employer.findMany({
            orderBy: { registeredAt: 'desc' },
            skip: (page - 1) * 20,
            take: 20,
          })
        : [],
    jobs:
      a.role === 'ADMIN'
        ? await db.opportunity.findMany({
            include: { employer: { select: { companyName: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * 20,
            take: 20,
          })
        : [],
    applications:
      a.role === 'ADMIN'
        ? await db.hiringApplication.findMany({
            select: {
              id: true,
              status: true,
              userId: true,
              opportunity: { select: { title: true } },
            },
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * 20,
            take: 20,
          })
        : [],
    requests:
      a.role === 'ADMIN'
        ? await db.careerRequest.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * 20,
            take: 20,
          })
        : [],
    contracts:
      a.role === 'ADMIN'
        ? await db.recruitmentContract.findMany({
            include: { invoices: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : [],
  };
}
export async function placementReport(a: Actor, from: Date, to: Date) {
  await role(a, ['ADMIN']);
  ensure(
    Number.isFinite(+from) &&
      Number.isFinite(+to) &&
      to > from &&
      +to - +from <= 366 * 86400000,
    422,
    'PERIOD',
    'Choose a reporting period of up to 366 days.',
  );
  const rows = await getDb().$queryRaw<
    {
      cohortId: string;
      cohort: string;
      track: string;
      enrollments: number;
      graduates: number;
      seekers: number;
      offers: number;
      starts: number;
      denominator: number;
    }[]
  >`
 WITH base AS (SELECT e.id,e."userId",e."cohortId",e.status,EXISTS(SELECT 1 FROM "Payment" p WHERE p."enrollmentId"=e.id AND p.status='SUCCEEDED' AND p."verifiedAt" IS NOT NULL AND p."providerRef" IS NOT NULL AND p."refundedMinor"=0) paid FROM "Enrollment" e WHERE e."createdAt">=${from} AND e."createdAt"<${to})
 SELECT h.id "cohortId",h.name cohort,c.track::text track,count(*)::int enrollments,
 count(*) FILTER(WHERE b.status='COMPLETED' AND b.paid)::int graduates,
 count(DISTINCT b."userId") FILTER(WHERE b.paid AND b.status IN ('ACTIVE','COMPLETED') AND EXISTS(SELECT 1 FROM "CareerProfile" cp JOIN "CareerReadiness" cr ON cr."userId"=cp."userId" WHERE cp."userId"=b."userId" AND cp.seeking AND cp.visibility<>'PRIVATE' AND cp."consentedAt" IS NOT NULL AND cr.ready))::int seekers,
 count(DISTINCT b."userId") FILTER(WHERE b.paid AND EXISTS(SELECT 1 FROM "HiringApplication" a JOIN "HiringOutcome" o ON o."applicationId"=a.id WHERE a."userId"=b."userId" AND o."offerVerifiedAt" IS NOT NULL AND o."offeredAt">=${from} AND o."offeredAt"<${to}))::int offers,
 count(DISTINCT b."userId") FILTER(WHERE b.paid AND EXISTS(SELECT 1 FROM "HiringApplication" a JOIN "HiringOutcome" o ON o."applicationId"=a.id WHERE a."userId"=b."userId" AND o."joiningVerifiedAt" IS NOT NULL AND o."joinedAt">=${from} AND o."joinedAt"<${to}))::int starts,
 count(DISTINCT b."userId") FILTER(WHERE b.paid)::int denominator
 FROM base b JOIN "Cohort" h ON h.id=b."cohortId" JOIN "Course" c ON c.id=h."courseId" GROUP BY h.id,h.name,c.track ORDER BY h.name LIMIT 200`;
  const [invitations, verifiedCompanies] = await Promise.all([
    getDb().hiringInterview.count({
      where: { createdAt: { gte: from, lt: to } },
    }),
    getDb().employer.count({
      where: {
        verificationStatus: 'VERIFIED',
        verifiedAt: { gte: from, lt: to },
      },
    }),
  ]);
  return {
    from: from.toISOString(),
    toExclusive: to.toISOString(),
    asOf: new Date().toISOString(),
    invitations,
    verifiedCompanies,
    definition:
      'Cohort/track rows use enrollments created in [from,to). Graduation is current COMPLETED plus verified unrefunded payment. Seekers require paid active/completed enrollment, reviewed readiness and current directory consent. Offers/starts count distinct paid learners from that enrollment population with separately verified actual event dates in [from,to). Conversion numerator = confirmed starts; denominator = distinct verified paid learners enrolled in period, including later-cancelled enrollments. Null percentage means zero denominator. Rows may overlap learners across cohorts and must not be summed into a global rate. Invitations count recorded invitations created in period, including later cancellations. Verified companies count currently VERIFIED companies whose latest verification date falls in period. No salary statistic is inferred.',
    rows: rows.map((r) => ({
      ...r,
      conversionPercent: r.denominator
        ? Math.round((r.starts / r.denominator) * 10000) / 100
        : null,
    })),
  };
}
