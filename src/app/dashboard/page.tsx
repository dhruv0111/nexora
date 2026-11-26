export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { roles, dashboardPath } from '@/lib/roles';
export default async function Dashboard() {
  const session = await requireRole(roles);
  redirect(dashboardPath(session.user.role));
}
