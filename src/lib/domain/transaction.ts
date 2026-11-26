import 'server-only';
import { type Prisma, type PrismaClient } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
export type Tx = Prisma.TransactionClient;
// Prisma's pg adapter can surface a commit conflict as a DriverAdapterError
// instead of a PrismaClientKnownRequestError. Match only known retryable codes.
export function isTransactionConflict(error: unknown, depth = 0): boolean {
  if (depth > 4 || typeof error !== 'object' || error === null) return false;
  const value = error as Record<string, unknown>;
  if (
    value.code === 'P2034' ||
    value.code === '40001' ||
    value.code === '40P01' ||
    value.originalCode === '40001' ||
    value.originalCode === '40P01' ||
    value.kind === 'TransactionWriteConflict'
  )
    return true;
  return ['cause', 'meta', 'driverAdapterError'].some((key) =>
    isTransactionConflict(value[key], depth + 1),
  );
}
export async function serial<T>(
  work: (tx: Tx) => Promise<T>,
  db: PrismaClient = getDb(),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (attempt < 4 && isTransactionConflict(error)) {
        await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }
}
export async function lock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata },
  });
}
