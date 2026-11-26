import 'server-only';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import drafts from '../../../prisma/draft-courses.json';
export type CourseModule = {
  startWeek: number;
  title: string;
  summary: string;
  weeklyTopics: string[];
};
export type CourseView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  track: string;
  status: string;
  verified: boolean;
  offline: boolean;
  durationWeeks: number;
  deliveryFormat: string;
  audience: string[];
  prerequisites: string[];
  skills: string[];
  technologies: string[];
  assessmentRequired: boolean;
  contentVersion: number;
  priceVersion: number;
  priceMinor: number | null;
  currency: string;
  priceApproved: boolean;
  termsApproved: boolean;
  termsVersion: string | null;
  enrollmentTerms: string | null;
  refundPolicy: string | null;
  modules: CourseModule[];
  instructors: { name: string; expertise: string[] }[];
  cohorts: {
    id: string;
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    capacity: number | null;
    occupied: number;
    admissionsOpen: boolean;
  }[];
};
export function draftCatalog(): CourseView[] {
  return drafts.map((d) => ({
    ...d,
    id: `preview-${d.slug}`,
    status: 'DRAFT',
    verified: false,
    offline: true,
    contentVersion: 1,
    priceVersion: 1,
    priceMinor: null,
    currency: 'INR',
    priceApproved: false,
    termsApproved: false,
    termsVersion: null,
    enrollmentTerms: null,
    refundPolicy: null,
    instructors: [],
    cohorts: [],
  }));
}
export async function catalog(): Promise<CourseView[]> {
  if (!env.DATABASE_URL) return draftCatalog();
  try {
    const rows = await getDb().course.findMany({
      where: {
        OR: [
          { status: 'PUBLISHED' },
          { status: 'DRAFT', previewVisible: true },
        ],
      },
      include: {
        modules: { orderBy: { startWeek: 'asc' } },
        instructors: {
          include: {
            mentor: { include: { user: { select: { name: true } } } },
          },
        },
        cohorts: {
          where: { status: 'PUBLISHED' },
          orderBy: { startsAt: 'asc' },
          take: 10,
          include: {
            _count: {
              select: {
                enrollments: {
                  where: {
                    OR: [
                      { status: 'ACTIVE' },
                      { status: 'PENDING', reservedUntil: { gt: new Date() } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
    return rows.map((row) => ({
      ...row,
      priceMinor: row.priceApprovedAt ? row.priceMinor : null,
      enrollmentTerms: row.termsApprovedAt ? row.enrollmentTerms : null,
      refundPolicy: row.termsApprovedAt ? row.refundPolicy : null,
      offline: false,
      verified: row.status === 'PUBLISHED' && !!row.contentApprovedAt,
      priceApproved: !!row.priceApprovedAt && row.priceMinor !== null,
      termsApproved: !!row.termsApprovedAt,
      instructors: row.instructors.map((i) => ({
        name: i.mentor.user.name ?? 'Instructor details pending',
        expertise: i.mentor.expertise,
      })),
      cohorts: row.cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        startsAt: c.startsAt?.toISOString() ?? null,
        endsAt: c.endsAt?.toISOString() ?? null,
        capacity: c.capacity,
        occupied: c._count.enrollments,
        admissionsOpen: c.admissionsOpen,
      })),
    }));
  } catch {
    console.error(JSON.stringify({ event: 'catalog_unavailable' }));
    return draftCatalog();
  }
}
export async function courseBySlug(slug: string) {
  return (await catalog()).find((c) => c.slug === slug);
}
export function money(amountMinor: number | null, currency = 'INR') {
  return amountMinor === null
    ? 'Fee awaiting approval'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amountMinor / 100);
}
