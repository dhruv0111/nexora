import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { createCohort } from '@/lib/catalog/admin';
export async function POST(request: Request) {
  return endpoint(async () => {
    const who = await actor(['ADMIN']);
    const data = await readJson(request);
    await limited(who.id, 'admin-cohort');
    return createCohort(who.id, data);
  });
}
