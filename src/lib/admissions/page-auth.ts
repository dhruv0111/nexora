import 'server-only';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { authConfigured } from '@/lib/env';
import { safeReturnPath } from '@/lib/redirects';
export async function applicantPage(next: string) {
  if (!authConfigured)
    redirect(
      `/sign-in?reason=configuration&callbackUrl=${encodeURIComponent(safeReturnPath(next))}`,
    );
  const session = await getServerSession(authOptions);
  if (!session?.user)
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(safeReturnPath(next))}`,
    );
  if (session.user.role !== 'STUDENT') redirect('/forbidden');
  return session.user;
}
