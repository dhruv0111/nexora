import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { saveApplication } from '@/lib/admissions/service';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['STUDENT']);
    const data = await readJson(request);
    await limited(who.id, 'application', 20);
    return saveApplication(who.id, (await params).slug, data);
  });
}
