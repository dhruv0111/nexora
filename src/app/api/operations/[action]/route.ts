import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { endpoint, limited, readJson } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { mutate, finance, period } from '@/lib/operations/service';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const s = await getServerSession(authOptions);
    ensure(s?.user, 401, 'SESSION', 'Sign in first.');
    await limited(s.user.id, 'operations', 40);
    return mutate(s.user.id, (await params).action, await readJson(req));
  });
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const s = await getServerSession(authOptions);
    ensure(s?.user, 401, 'SESSION', 'Sign in first.');
    ensure(
      (await params).action === 'finance',
      404,
      'ACTION',
      'Unknown export.',
    );
    await limited(s.user.id, 'finance-export', 10);
    const f = period(Object.fromEntries(new URL(req.url).searchParams));
    return finance(s.user.id, f.from, f.to, f.cohort);
  });
}
