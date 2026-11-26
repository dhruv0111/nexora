import { z } from 'zod';
import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { serial, audit } from '@/lib/domain/transaction';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['ADMIN']);
    const b = z
      .object({ status: z.enum(['NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED']) })
      .strict()
      .parse(await readJson(request));
    await limited(who.id, 'triage');
    return serial(async (tx) => {
      const id = (await params).id;
      const row = await tx.inquiry.update({
        where: { id },
        data: { triageStatus: b.status, triagedAt: new Date() },
      });
      await audit(tx, who.id, 'INQUIRY_TRIAGED', 'Inquiry', id, {
        status: row.triageStatus,
      });
      return { id, status: row.triageStatus };
    });
  });
}
