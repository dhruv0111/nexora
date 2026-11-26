import { actor, limited, json } from '@/lib/domain/http';
import { DomainError } from '@/lib/domain/errors';
import { downloadFile } from '@/lib/learning/files';
export const runtime = 'nodejs';
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await actor(['STUDENT', 'MENTOR', 'ADMIN']);
    await limited(a.id, 'lms:download', 60);
    const f = await downloadFile(a, (await params).id);
    return new Response(new Uint8Array(f.data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${f.name.replaceAll('"', '')}"`,
        'Content-Length': String(f.size),
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
