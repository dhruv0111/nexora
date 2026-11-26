import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { authConfigured } from '@/lib/env';
const handler = NextAuth(authOptions);
async function guarded(...args: Parameters<typeof handler>) {
  if (!authConfigured)
    return Response.json(
      { error: 'Authentication is not configured' },
      { status: 503 },
    );
  return handler(...args);
}
export { guarded as GET, guarded as POST };
