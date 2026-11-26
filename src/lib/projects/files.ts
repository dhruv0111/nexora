import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { validateFile } from '@/lib/learning/files';
import { podAccess } from './policy';
export async function projectUpload(a: Actor, evidenceId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    meta = validateFile(file.name, file.type, bytes);
  return serial(async (tx) => {
    await lock(tx, `evidence:${evidenceId}`);
    const e = await tx.contributionEvidence.findUnique({
      where: { id: evidenceId },
      include: { ticket: true },
    });
    ensure(e, 404, 'EVIDENCE', 'Evidence not found.');
    await podAccess(a, e.ticket.podId, tx);
    ensure(
      e.userId === a.id && e.status === 'SUBMITTED',
      403,
      'OWNER',
      'Only your unreviewed contribution accepts attachments.',
    );
    ensure(
      (await tx.projectFile.count({
        where: { evidenceId: e.id, removedAt: null },
      })) < 3,
      422,
      'QUOTA',
      'At most three files per contribution.',
    );
    const f = await tx.projectFile.create({
      data: { evidenceId: e.id, ...meta, data: bytes },
    });
    await audit(tx, a.id, 'PROJECT_FILE_ADDED', 'ProjectFile', f.id, {
      sha256: f.sha256,
      size: f.size,
    });
    return { id: f.id };
  });
}
export async function projectFile(a: Actor, fileId: string) {
  const f = await getDb().projectFile.findFirst({
    where: { id: fileId, removedAt: null },
    include: { evidence: { include: { ticket: true } } },
  });
  ensure(f, 404, 'FILE', 'File not found.');
  await podAccess(a, f.evidence.ticket.podId);
  return f;
}
export async function retire(a: Actor, input: unknown) {
  const b = z
    .object({
      kind: z.enum(['FILE', 'PROJECT']),
      id: z.string().min(1).max(100),
      reason: z.string().trim().min(20).max(1000),
    })
    .strict()
    .parse(input);
  ensure(
    a.role === 'ADMIN',
    403,
    'ADMIN',
    'Administrator retention authority required.',
  );
  return serial(async (tx) => {
    if (b.kind === 'FILE') {
      const f = await tx.projectFile.findUnique({
        where: { id: b.id },
        include: { evidence: { include: { ticket: true } } },
      });
      ensure(f, 404, 'FILE', 'File not found.');
      await podAccess(a, f.evidence.ticket.podId, tx, true);
      await tx.projectFile.update({
        where: { id: f.id },
        data: { removedAt: new Date(), data: null },
      });
      await tx.contributionEvidence.update({
        where: { id: f.evidenceId },
        data: {
          status: 'CHANGES_REQUESTED',
          feedback: 'An attachment was retired; re-review is required.',
          version: { increment: 1 },
        },
      });
      await tx.projectTicket.update({
        where: { id: f.evidence.ticketId },
        data: {
          status: 'IN_REVIEW',
          codeReviewed: false,
          qaAccepted: false,
          dodAccepted: false,
          securityCleared: false,
          version: { increment: 1 },
        },
      });
      await tx.portfolioEntry.updateMany({
        where: { evidenceId: f.evidenceId },
        data: { status: 'DRAFT', approvedAt: null },
      });
    } else {
      await tx.project.update({
        where: { id: b.id },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
    }
    await audit(tx, a.id, 'PROJECT_RETENTION_ACTION', b.kind, b.id, {
      reason: b.reason,
    });
    return { saved: true };
  });
}
