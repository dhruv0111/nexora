import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { reviewApplication } from '@/lib/admissions/service';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['ADMIN']);
    const data = await readJson(request);
    await limited(who.id, 'admin-review');
    return reviewApplication(who.id, (await params).id, data);
  });
}
