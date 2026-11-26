import { learningFixture } from './learning-fixture';
import {
  createProject,
  createPod,
  membership,
  sprint,
  saveTicket,
} from '@/lib/projects/service';
export async function projectFixture() {
  const f = await learningFixture();
  const p = await createProject(f.adminActor, {
      title: 'Isolated HireFlow training product',
      brief:
        'Synthetic applicant data only. Separate HireFlow repository and runtime boundaries.',
      productKey: 'hireflow',
      courseId: '',
      technologies: ['TypeScript', 'PostgreSQL'],
      confidential: false,
      mentorId: f.mentor.id,
      status: 'PUBLISHED',
    }),
    pod = await createPod(f.mentorActor, {
      projectId: p.id,
      name: 'Isolated cross-functional pod',
    });
  await membership(f.mentorActor, {
    podId: pod.id,
    userId: f.student.id,
    enrollmentId: f.enrollmentId,
    supervisorId: f.mentor.id,
    responsibility: 'Implement and explain a validated application API.',
    version: 0,
    remove: false,
  });
  const startsAt = new Date(Date.now() - 86400000).toISOString(),
    endsAt = new Date(Date.now() + 7 * 86400000).toISOString(),
    sp = await sprint(f.mentorActor, {
      podId: pod.id,
      version: 0,
      name: 'Isolated first sprint',
      goal: 'Deliver a small API increment with independent quality checks.',
      startsAt,
      endsAt,
      status: 'PLANNED',
      retrospective: '',
    });
  await sprint(f.mentorActor, {
    id: sp.id,
    podId: pod.id,
    version: 1,
    name: 'Isolated first sprint',
    goal: 'Deliver a small API increment with independent quality checks.',
    startsAt,
    endsAt,
    status: 'ACTIVE',
    retrospective: '',
  });
  const ticket = await saveTicket(f.mentorActor, {
    podId: pod.id,
    version: 0,
    sprintId: sp.id,
    assigneeId: f.student.id,
    title: 'Validate application input',
    requirements:
      'Build a typed validation boundary and explain invalid request handling.',
    acceptance: ['Reject invalid requests with a helpful response'],
    definitionOfDone: ['Review implementation and regression tests'],
    priority: 'HIGH',
    kind: 'STORY',
    dueAt: endsAt,
    issueUrl: '',
  });
  async function cleanup() {
    const tickets = await f.db.projectTicket.findMany({
        where: { podId: pod.id },
        select: { id: true },
      }),
      ids = tickets.map((t) => t.id);
    await f.db.portfolioEntry.deleteMany({
      where: { evidence: { ticketId: { in: ids } } },
    });
    await f.db.projectFile.deleteMany({
      where: { evidence: { ticketId: { in: ids } } },
    });
    await f.db.contributionEvidence.deleteMany({
      where: { ticketId: { in: ids } },
    });
    await f.db.projectTicket.deleteMany({ where: { podId: pod.id } });
    await f.db.projectSprint.deleteMany({ where: { podId: pod.id } });
    await f.db.projectConcern.deleteMany({ where: { podId: pod.id } });
    await f.db.projectRelease.deleteMany({ where: { podId: pod.id } });
    await f.db.agilePod.delete({ where: { id: pod.id } });
    await f.db.projectWebhook.deleteMany({
      where: { repository: `test-${p.id}/hireflow` },
    });
    await f.db.projectRepository.deleteMany({ where: { projectId: p.id } });
    await f.db.project.delete({ where: { id: p.id } });
    await f.cleanup();
  }
  return {
    ...f,
    otherStudent: f.otherStudent,
    projectId: p.id,
    podId: pod.id,
    sprintId: sp.id,
    ticketId: ticket.id,
    studentActor: { id: f.student.id, role: 'STUDENT' as const },
    cleanup,
  };
}
