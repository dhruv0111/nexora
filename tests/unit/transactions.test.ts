import { describe, it, expect, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { serial } from '@/lib/domain/transaction';
describe('bounded transaction recovery', () => {
  it.each([
    ['P2034', undefined],
    ['P2010', { code: '40001' }],
    ['P2010', { code: '40P01' }],
  ])('retries transient %s conflicts', async (code, meta) => {
    const failure = new Prisma.PrismaClientKnownRequestError(
      'Isolated transaction conflict',
      { code, clientVersion: 'test', meta },
    );
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('committed');
    const result = await serial(async () => 'committed', {
      $transaction: transaction,
    } as unknown as PrismaClient);
    expect(result).toBe('committed');
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it('recovers pg adapter commit conflicts without matching arbitrary error text', async () => {
    const failure = Object.assign(new Error('Isolated driver conflict'), {
      cause: { kind: 'TransactionWriteConflict', originalCode: '40001' },
    });
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('committed');
    expect(
      await serial(async () => 'committed', {
        $transaction: transaction,
      } as unknown as PrismaClient),
    ).toBe('committed');
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it('does not retry invalid data or database syntax errors', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError(
      'Isolated invalid query',
      { code: 'P2010', clientVersion: 'test', meta: { code: '42601' } },
    );
    const transaction = vi.fn().mockRejectedValue(failure);
    await expect(
      serial(async () => null, {
        $transaction: transaction,
      } as unknown as PrismaClient),
    ).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
