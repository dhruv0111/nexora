import { actor, limited, json } from '@/lib/domain/http';
import { DomainError } from '@/lib/domain/errors';
import { projectFile } from '@/lib/projects/files';
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await actor(['STUDENT', 'MENTOR', 'ADMIN']);
    await limited(a.id, 'projects:download', 60);
    const f = await projectFile(a, (await params).id);
    return new Response(new Uint8Array(f.data!), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${f.name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return json(
      { error: e instanceof DomainError ? e.message : 'File unavailable.' },
      e instanceof DomainError ? e.status : 503,
    );
  }
}
