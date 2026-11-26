import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { editCourse } from '@/lib/catalog/admin';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['ADMIN']);
    const data = await readJson(request, 524288);
    await limited(who.id, 'admin-course');
    return editCourse(who.id, (await params).id, data);
  });
}
