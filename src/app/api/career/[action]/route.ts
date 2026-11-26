import { actor, endpoint, limited, readJson, readRaw } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { sameOrigin } from '@/lib/inquiry-policy';
import { env } from '@/lib/env';
import {
  saveProfile,
  consent,
  createResume,
  reviewReadiness,
  candidate,
  resumeRead,
  publicProfile,
} from '@/lib/career/profile';
import {
  registerEmployer,
  updateCompany,
  employerReview,
  saveJob,
  moderateJob,
  applyJob,
  moveApplication,
  outcome,
} from '@/lib/career/hiring';
import { interview, mockInterview, support } from '@/lib/career/interviews';
import {
  documentUpload,
  documentRead,
  retire,
  retention,
  contract,
  invoice,
  recommend,
} from '@/lib/career/operations';
import { applicationRead, placementReport } from '@/lib/career/read';
export const runtime = 'nodejs';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const { action } = await params,
      a = await actor(['STUDENT', 'EMPLOYER', 'MENTOR', 'ADMIN']);
    await limited(a.id, `career:${action}`, action === 'upload' ? 5 : 30);
    if (action === 'upload') {
      ensure(
        sameOrigin(request, env.INQUIRY_ORIGIN ?? env.NEXTAUTH_URL),
        403,
        'ORIGIN',
        'Use the Nexora upload form.',
      );
      const type = request.headers.get('content-type') ?? '';
      ensure(
        type.startsWith('multipart/form-data;'),
        415,
        'MEDIA_TYPE',
        'Use multipart form data.',
      );
      const bytes = await readRaw(request, 2 * 1024 * 1024 + 16384),
        form = await new Response(new Uint8Array(bytes), {
          headers: { 'content-type': type },
        }).formData(),
        f = form.get('file');
      ensure(f instanceof File, 422, 'UPLOAD', 'Select a file.');
      return documentUpload(a, f);
    }
    const b = await readJson(request, 65536);
    switch (action) {
      case 'profile':
        return saveProfile(a, b);
      case 'consent':
        return consent(a, b);
      case 'resume':
        return createResume(a);
      case 'readiness':
        return reviewReadiness(a, b);
      case 'register':
        return registerEmployer(a, b);
      case 'company-profile':
        return updateCompany(a, b);
      case 'employer-review':
        return employerReview(a, b);
      case 'job':
        return saveJob(a, b);
      case 'moderation':
        return moderateJob(a, b);
      case 'apply':
        return applyJob(a, b);
      case 'transition':
        return moveApplication(a, b);
      case 'outcome':
        return outcome(a, b);
      case 'interview':
        return interview(a, b);
      case 'mock':
        return mockInterview(a, b);
      case 'support':
        return support(a, b);
      case 'retire':
        return retire(a, b);
      case 'retention':
        return retention(a, b);
      case 'contract':
        return contract(a, b);
      case 'invoice':
        return invoice(a, b);
      case 'recommend':
        return recommend(a, b);
      default:
        ensure(false, 404, 'ACTION', 'Action not found.');
    }
  });
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params,
    q = new URL(request.url).searchParams;
  // Only the deliberately minimal public DTO may bypass authentication.
  if (action === 'public')
    return endpoint(() => publicProfile(q.get('id') ?? ''));
  let download: Awaited<ReturnType<typeof resumeRead>> | null = null,
    document: Awaited<ReturnType<typeof documentRead>> | null = null;
  const response = await endpoint(async () => {
    const a = await actor(['STUDENT', 'EMPLOYER', 'MENTOR', 'ADMIN']);
    await limited(a.id, `career-read:${action}`, 60);
    switch (action) {
      case 'candidate':
        return candidate(a, q.get('id') ?? '');
      case 'application':
        return applicationRead(a, q.get('id') ?? '');
      case 'report':
        return placementReport(
          a,
          new Date(q.get('from') ?? ''),
          new Date(q.get('to') ?? ''),
        );
      case 'resume':
        download = await resumeRead(a, q.get('id') ?? '');
        return { ok: true };
      case 'document':
        document = await documentRead(a, q.get('id') ?? '');
        return { ok: true };
      default:
        ensure(false, 404, 'ACTION', 'Resource not found.');
    }
  });
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Content-Disposition': 'attachment; filename="career-document.txt"',
    'Content-Type': 'application/octet-stream',
  };
  if (download) {
    const r = download as Awaited<ReturnType<typeof resumeRead>>;
    return new Response(r.content, {
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="resume-v${r.version}.txt"`,
      },
    });
  }
  if (document) {
    const d = document as Awaited<ReturnType<typeof documentRead>>;
    return new Response(new Uint8Array(d.bytes!), {
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="${d.name}"`,
      },
    });
  }
  return response;
}
