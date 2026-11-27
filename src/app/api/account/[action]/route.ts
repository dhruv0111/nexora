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
    if (action === 'change-password') {
      const session = await getServerSession(authOptions);
      ensure(session?.user, 401, 'SESSION', 'Sign in first.');
      await limited(session.user.id, 'change-password', 8);
      return change(session.user.id, b);
    }
    const key =
      b && typeof b === 'object'
        ? 'email' in b
          ? String(b.email).toLowerCase().trim().slice(0, 254)
          : 'token' in b
            ? String(b.token).slice(0, 64)
            : 'invalid'
        : 'invalid';
    await limited(key, 'account:' + action, action === 'sign-in' ? 12 : 8);
    if (action === 'register' || action === 'forgot-password')
      return requestLink(action, b);
    if (action === 'verify-email' || action === 'reset-password')
      return redeem(action, b);
    if (action === 'sign-in') {
      const secure = env.NEXTAUTH_URL!.startsWith('https://');
      ensure(
        secure ||
          ['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(env.NEXTAUTH_URL!).hostname,
          ),
        503,
        'HTTPS',
        'Use HTTPS for non-local authentication.',
      );
      const r = await login(b);
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
