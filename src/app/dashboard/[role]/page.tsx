import '@/styles/learning.css';
import {
  StudentDashboard,
  StaffDashboard,
} from '@/components/learning/dashboards';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { roles, type Role } from '@/lib/roles';
import { Workspace } from '@/components/workspace';
import { SignOutButton } from '@/components/auth/sign-out-button';
export const dynamic = 'force-dynamic';
export default async function Dashboard({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: raw } = await params;
  const role = raw.toUpperCase() as Role;
  if (!roles.includes(role)) notFound();
  const session = await requireRole([role]);
  if (role === 'EMPLOYER') redirect('/career/employer');
  if (role === 'STUDENT')
    return (
      <StudentDashboard userId={session.user.id} name={session.user.name} />
    );
  if (role === 'MENTOR')
    return <StaffDashboard actor={{ id: session.user.id, role }} />;
  return (
    <main id="main" className="dashboard-page">
      <div className="dashboard-controls">
        <span>Secure learning platform</span>
        <SignOutButton />
      </div>
      <Workspace role={role} />
    </main>
  );
}
