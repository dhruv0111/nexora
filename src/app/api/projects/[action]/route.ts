import { actor, endpoint, limited, readJson, readRaw } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { env } from '@/lib/env';
import { sameOrigin } from '@/lib/inquiry-policy';
import {
  createProject,
  saveProject,
  projectStaff,
  createPod,
  membership,
  sprint,
  saveTicket,
  transition,
  quality,
} from '@/lib/projects/service';
import {
  submitEvidence,
  reviewEvidence,
  comment,
  concern,
  release,
  portfolio,
  reviewPortfolio,
} from '@/lib/projects/evidence';
import {
  linkRepository,
  verifyEvidence,
  githubWebhook,
} from '@/lib/projects/github';
import { projectUpload, retire } from '@/lib/projects/files';
import { podAccess } from '@/lib/projects/policy';
import { getDb } from '@/lib/db';
import { fileLimit } from '@/lib/learning/files';
export const runtime = 'nodejs';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const { action } = await params;
    if (action === 'github-webhook')
      return githubWebhook(
        await readRaw(request, 262144),
        request.headers.get('x-hub-signature-256') ?? '',
        request.headers.get('x-github-delivery') ?? '',
        request.headers.get('x-github-event') ?? '',
      );
    const a = await actor(['STUDENT', 'MENTOR', 'ADMIN']);
    await limited(a.id, `projects:${action}`, action === 'upload' ? 6 : 30);
    if (action === 'upload') {
      ensure(
        sameOrigin(request, env.INQUIRY_ORIGIN ?? env.NEXTAUTH_URL),
        403,
        'ORIGIN',
        'Upload from Nexora.',
      );
      ensure(
        request.headers.get('content-type')?.startsWith('multipart/form-data;'),
        415,
        'MEDIA_TYPE',
        'Use an upload form.',
      );
      const raw = await readRaw(request, fileLimit + 16384),
        form = await new Response(new Uint8Array(raw), {
          headers: { 'content-type': request.headers.get('content-type')! },
        }).formData(),
        f = form.get('file'),
        e = form.get('evidenceId');
      ensure(
        f instanceof File && typeof e === 'string' && e.length <= 100,
        422,
        'UPLOAD',
        'Select an evidence record and permitted file.',
      );
      return projectUpload(a, e, f);
    }
    const b = await readJson(request, 131072);
    switch (action) {
      case 'create':
        return createProject(a, b);
      case 'project':
        return saveProject(a, b);
      case 'staff':
        return projectStaff(a, b);
      case 'pod':
        return createPod(a, b);
      case 'member':
        return membership(a, b);
      case 'sprint':
        return sprint(a, b);
      case 'ticket':
        return saveTicket(a, b);
      case 'move':
        return transition(a, b);
      case 'quality':
        return quality(a, b);
      case 'evidence':
        return submitEvidence(a, b);
      case 'review':
        return reviewEvidence(a, b);
      case 'comment':
        return comment(a, b);
      case 'concern':
        return concern(a, b);
      case 'release':
        return release(a, b);
      case 'portfolio':
        return portfolio(a, b);
      case 'portfolio-review':
        return reviewPortfolio(a, b);
      case 'repository':
        return linkRepository(a, b);
      case 'retire':
        return retire(a, b);
      case 'verify': {
        const { z } = await import('zod');
        const p = z
          .object({ id: z.string().min(1).max(100) })
          .strict()
          .parse(b);
        return verifyEvidence(a, p.id);
      }
      default:
        ensure(false, 404, 'ACTION', 'Action not found.');
    }
  });
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const a = await actor(['STUDENT', 'MENTOR', 'ADMIN']);
    await limited(a.id, 'projects:read', 60);
    const action = (await params).action,
      id = (new URL(request.url).searchParams.get('id') ?? '').slice(0, 100);
    if (action === 'pod') {
      const p = await podAccess(a, id);
      return { id: p.id, name: p.name };
    }
    if (action === 'ticket') {
      const t = await getDb().projectTicket.findUnique({ where: { id } });
      ensure(t, 404, 'TICKET', 'Ticket not found.');
      await podAccess(a, t.podId);
      return t;
    }
    ensure(false, 404, 'ACTION', 'Read action not found.');
  });
}
