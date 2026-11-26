import '@/styles/learning.css';
import { requireRole } from '@/lib/auth';
import { StaffDashboard } from '@/components/learning/dashboards';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await requireRole(['ADMIN']);
  return <StaffDashboard actor={{ id: s.user.id, role: 'ADMIN' }} />;
}
