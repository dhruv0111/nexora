import { actor, endpoint, limited } from '@/lib/domain/http';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['STUDENT']);
    await limited(who.id, 'application-read', 60);
    const record = await getDb().application.findFirst({
      where: { id: (await params).id, userId: who.id, courseId: { not: null } },
      select: {
        id: true,
        status: true,
        version: true,
        details: true,
        assessmentStatus: true,
        reviewNote: true,
        submittedAt: true,
        course: { select: { title: true, slug: true } },
        enrollment: { select: { id: true, status: true } },
      },
    });
    ensure(record, 404, 'APPLICATION', 'Application not found.');
    return record;
  });
}
