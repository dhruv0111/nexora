import { actor, endpoint, limited } from '@/lib/domain/http';
import { exportPortfolio } from '@/lib/projects/evidence';
export async function GET() {
  return endpoint(async () => {
    const a = await actor(['STUDENT']);
    await limited(a.id, 'projects:export', 10);
    return exportPortfolio(a.id);
  });
}
