import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { env, authConfigured } from '@/lib/env';
import { endpoint, limited, readJson } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { change, login, redeem, requestLink } from '@/lib/accounts/service';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    ensure(authConfigured, 503, 'CONFIG', 'Authentication is not configured.');
    const { action } = await params;
    const b = await readJson(req, 4096);
    await limited('all', 'account-global', 120);
    const key =
      typeof b === 'object' && b && 'email' in b
        ? String(b.email).toLowerCase().slice(0, 254)
        : 'token';
    await limited(key, 'account:' + action, action === 'sign-in' ? 12 : 8);
    if (action === 'register' || action === 'forgot-password')
      return requestLink(action, b);
    if (action === 'verify-email' || action === 'reset-password')
      return redeem(action, b);
    if (action === 'change-password') {
      const s = await getServerSession(authOptions);
      ensure(s?.user, 401, 'SESSION', 'Sign in first.');
      return change(s.user.id, b);
    }
    if (action === 'sign-in') {
      const r = await login(b),
        secure = env.NEXTAUTH_URL!.startsWith('https://');
      ensure(
        secure ||
          ['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(env.NEXTAUTH_URL!).hostname,
          ),
        503,
        'HTTPS',
        'Use HTTPS for non-local authentication.',
      );
      (await cookies()).set(
        (secure ? '__Secure-' : '') + 'next-auth.session-token',
        r.sessionToken,
        {
          secure,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          expires: r.expires,
        },
      );
      return { redirect: r.redirect };
    }
    ensure(false, 404, 'ACTION', 'Unknown action.');
  });
}
