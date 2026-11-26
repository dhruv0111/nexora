import 'server-only';
import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { cohortAccess, studentAccess } from './policy';
export const fileLimit = 2 * 1024 * 1024;
export function validateFile(name: string, mime: string, bytes: Uint8Array) {
  ensure(
    bytes.length > 0 && bytes.length <= fileLimit,
    422,
    'FILE_SIZE',
    'Files must be between 1 byte and 2 MB.',
  );
  ensure(
    /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,100}\.(txt|pdf)$/i.test(name),
    422,
    'FILE_NAME',
    'Use a simple .txt or .pdf filename.',
  );
  if (name.toLowerCase().endsWith('.txt')) {
    ensure(
      mime === 'text/plain' && !bytes.includes(0),
      422,
      'FILE_TYPE',
      'A plain UTF-8 text file is required.',
    );
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      ensure(false, 422, 'FILE_TYPE', 'Invalid UTF-8 text.');
    }
  } else
    ensure(
      mime === 'application/pdf' &&
        Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-' &&
        Buffer.from(bytes.subarray(Math.max(0, bytes.length - 1024))).includes(
          Buffer.from('%%EOF'),
        ),
      422,
      'FILE_TYPE',
      'A valid PDF header and trailer are required.',
    );
  return {
    name,
    mime,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
export async function uploadFile(
  userId: string,
  submissionId: string,
  enrollmentId: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    meta = validateFile(file.name, file.type, bytes);
  return serial(async (tx) => {
    const e = await studentAccess(userId, enrollmentId, tx);
    const s = await tx.submission.findFirst({
      where: {
        id: submissionId,
        userId,
        assignment: { cohortId: e.cohortId, status: 'PUBLISHED' },
      },
      include: { assignment: true },
    });
    ensure(s, 404, 'SUBMISSION', 'Submission not found.');
    await lock(tx, `submission:${userId}:${s.assignmentId}`);
    const current = await tx.submission.findUniqueOrThrow({
      where: { id: s.id },
    });
    ensure(
      current.state === 'DRAFT' &&
        s.assignment.dueAt &&
        s.assignment.dueAt > new Date(),
      409,
      'FILE_LOCKED',
      'Files can be added only to drafts before the deadline.',
    );
    const count = await tx.learningFile.count({
      where: { submissionId: s.id },
    });
    ensure(
      count < 3,
      422,
      'FILE_QUOTA',
      'A submission supports at most three files.',
    );
    const f = await tx.learningFile.create({
      data: { submissionId: s.id, ...meta, data: bytes },
    });
    await audit(tx, userId, 'SUBMISSION_FILE_ADDED', 'LearningFile', f.id, {
      submissionId: s.id,
      size: meta.size,
      sha256: meta.sha256,
    });
    return { id: f.id, name: f.name };
  });
}
export async function downloadFile(actor: Actor, id: string) {
  const f = await getDb().learningFile.findUnique({
    where: { id },
    include: { submission: { include: { assignment: true } } },
  });
  ensure(f, 404, 'FILE', 'File not found.');
  if (actor.role === 'STUDENT') {
    ensure(f.submission.userId === actor.id, 404, 'FILE', 'File not found.');
    const e = await getDb().enrollment.findUnique({
      where: {
        userId_cohortId: {
          userId: actor.id,
          cohortId: f.submission.assignment.cohortId,
        },
      },
    });
    ensure(e, 403, 'LEARNING_ACCESS', 'Enrollment required.');
    await studentAccess(actor.id, e.id);
  } else await cohortAccess(actor, f.submission.assignment.cohortId);
  return f;
}
