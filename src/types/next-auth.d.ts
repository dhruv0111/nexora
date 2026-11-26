import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/roles';
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      forceChange?: boolean;
      staffScope?: string | null;
      role: Role;
    } & DefaultSession['user'];
  }
}
