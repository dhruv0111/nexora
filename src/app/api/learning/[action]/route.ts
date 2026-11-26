import { actor, endpoint, limited, readJson, readRaw } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import { sameOrigin } from '@/lib/inquiry-policy';
import { env } from '@/lib/env';
import {
  recordProgress,
  editLesson,
  assignMentor,
} from '@/lib/learning/content';
import {
  saveAssignment,
  submitAssignment,
  gradeSubmission,
  saveQuiz,
  attemptQuiz,
} from '@/lib/learning/tasks';
import {
  scheduleClass,
  recordAttendance,
  announce,
  openTicket,
  replyTicket,
  readNotification,
} from '@/lib/learning/community';
import { uploadFile, fileLimit } from '@/lib/learning/files';
import type { Role } from '@/lib/roles';
export const runtime = 'nodejs';
const allowed: Record<string, Role[]> = {
  progress: ['STUDENT'],
  lesson: ['ADMIN'],
  'assign-mentor': ['ADMIN'],
  assignment: ['MENTOR', 'ADMIN'],
  submission: ['STUDENT'],
  grade: ['MENTOR', 'ADMIN'],
  quiz: ['MENTOR', 'ADMIN'],
  attempt: ['STUDENT'],
  class: ['MENTOR', 'ADMIN'],
  attendance: ['MENTOR', 'ADMIN'],
  announcement: ['MENTOR', 'ADMIN'],
  ticket: ['STUDENT'],
  reply: ['STUDENT', 'ADMIN'],
  notification: ['STUDENT', 'MENTOR', 'ADMIN'],
  upload: ['STUDENT'],
};
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const { action } = await params;
    ensure(allowed[action], 404, 'ACTION', 'Action not found.');
    const a = await actor(allowed[action]);
    await limited(a.id, `lms:${action}`, action === 'upload' ? 6 : 30);
    if (action === 'upload') {
      ensure(
        sameOrigin(request, env.INQUIRY_ORIGIN ?? env.NEXTAUTH_URL),
        403,
        'ORIGIN',
        'Upload from the Nexora website.',
      );
      ensure(
        request.headers.get('content-type')?.startsWith('multipart/form-data;'),
        415,
        'MEDIA_TYPE',
        'Use a file upload form.',
      );
      const raw = await readRaw(request, fileLimit + 16384);
      const form = await new Response(new Uint8Array(raw), {
        headers: { 'content-type': request.headers.get('content-type')! },
      }).formData();
      const file = form.get('file'),
        submissionId = form.get('submissionId'),
        enrollmentId = form.get('enrollmentId');
      ensure(
        file instanceof File &&
          typeof submissionId === 'string' &&
          submissionId.length <= 100 &&
          typeof enrollmentId === 'string' &&
          enrollmentId.length <= 100,
        422,
        'UPLOAD',
        'Select a file and a saved submission draft.',
      );
      return uploadFile(a.id, submissionId, enrollmentId, file);
    }
    const body = await readJson(request, 131072);
    switch (action) {
      case 'progress':
        return recordProgress(a.id, body);
      case 'lesson':
        return editLesson(a, body);
      case 'assign-mentor':
        return assignMentor(a, body);
      case 'assignment':
        return saveAssignment(a, body);
      case 'submission':
        return submitAssignment(a.id, body);
      case 'grade':
        return gradeSubmission(a, body);
      case 'quiz':
        return saveQuiz(a, body);
      case 'attempt':
        return attemptQuiz(a.id, body);
      case 'class':
        return scheduleClass(a, body);
      case 'attendance':
        return recordAttendance(a, body);
      case 'announcement':
        return announce(a, body);
      case 'ticket':
        return openTicket(a.id, body);
      case 'reply':
        return replyTicket(a, body);
      case 'notification':
        return readNotification(a.id, body);
    }
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    const action = (await params).action;
    ensure(
      ['lesson', 'course', 'cohort', 'assignment', 'ticket'].includes(action),
      404,
      'ACTION',
      'Read action not found.',
    );
    const a = await actor(
      action === 'cohort'
        ? ['MENTOR', 'ADMIN']
        : action === 'ticket'
          ? ['STUDENT', 'ADMIN']
          : ['STUDENT'],
    );
    await limited(a.id, `lms:read:${action}`, 60);
    const url = new URL(request.url),
      enrollmentId = (url.searchParams.get('enrollmentId') ?? '').slice(0, 100),
      id = (url.searchParams.get('id') ?? '').slice(0, 100);
    if (action === 'lesson') {
      const { lesson } = await import('@/lib/learning/content').then((m) =>
        m.lessonForStudent(a.id, enrollmentId, id),
      );
      return { id: lesson.id, title: lesson.title, content: lesson.content };
    }
    if (action === 'course') {
      const d = await import('@/lib/learning/read').then((m) =>
        m.courseLearning(a.id, enrollmentId),
      );
      return { summary: d.summary, nextLessonId: d.next?.id ?? null };
    }
    if (action === 'assignment')
      return import('@/lib/learning/tasks').then((m) =>
        m.assignmentForStudent(a.id, enrollmentId, id),
      );
    if (action === 'ticket')
      return import('@/lib/learning/community').then((m) =>
        m.ticketAccess(a, id),
      );
    return import('@/lib/learning/policy')
      .then((m) => m.cohortAccess(a, id))
      .then((c) => ({ id: c.id, name: c.name }));
  });
}
