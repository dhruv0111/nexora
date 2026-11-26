import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { projectsFor } from '@/lib/projects/read';
import { LearningShell, PageHeading, Empty } from '@/components/learning/shell';
import { ProjectForm } from '@/components/projects/forms';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await requireRole(['STUDENT', 'MENTOR', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role },
    projects = await projectsFor(a),
    db = getDb();
  const mentors =
    a.role === 'ADMIN'
      ? await db.user.findMany({
          where: { role: 'MENTOR' },
          select: { id: true, name: true },
          take: 100,
        })
      : [{ id: a.id, name: s.user.name }];
  const courses =
    a.role === 'STUDENT'
      ? []
      : await db.course.findMany({
          where:
            a.role === 'MENTOR'
              ? {
                  cohorts: {
                    some: { mentors: { some: { mentor: { userId: a.id } } } },
                  },
                }
              : {},
          select: { id: true, title: true },
          take: 40,
        });
  return (
    <LearningShell role={a.role} active="projects">
      <PageHeading
        eyebrow="BUILD TOGETHER. OWN YOUR CONTRIBUTION."
        title={
          a.role === 'STUDENT'
            ? 'Your project chapter.'
            : 'Project delivery workspace'
        }
      >
        Supervised technical work, clear responsibilities, and evidence you can
        explain.
      </PageHeading>
      <div className="project-banner">
        Project participation is supervised training. It is not paid employment,
        a formal internship, or a statutory apprenticeship. HireFlow is a
        separate product; this workspace tracks delivery, not applicant data.
      </div>
      <div className="learn-link-row">
        <Link href="/projects/portfolio">My contribution portfolio</Link>
        <Link href={`/dashboard/${a.role.toLowerCase()}`}>
          Learning dashboard
        </Link>
      </div>
      <div className="project-projects">
        {projects.map((p) => (
          <section className="learn-card" key={p.id}>
            <span className="learn-tag">
              {p.status} ·{' '}
              {p.confidential
                ? 'Private / confidential'
                : 'Portfolio review permitted'}
            </span>
            <h2>{p.title}</h2>
            <p>{p.brief}</p>
            <p className="learn-meta">
              {p.technologies.join(' · ')} · Supervised training
            </p>
            {p.pods.map((pod) => (
              <p key={pod.id}>
                <Link href={`/projects/${pod.id}`}>{pod.name}</Link>
              </p>
            ))}
            {a.role !== 'STUDENT' && (
              <>
                <details>
                  <summary>Edit or publish project</summary>
                  <p>
                    Publication requires an assigned mentor. Metadata changes
                    return portfolio entries to draft for re-review.
                  </p>
                  <ProjectForm
                    key={p.version}
                    action="project"
                    values={{ id: p.id, version: p.version }}
                    fields={[
                      {
                        name: 'title',
                        label: 'Edit project name',
                        value: p.title,
                        required: true,
                      },
                      {
                        name: 'brief',
                        label: 'Edit project brief',
                        type: 'textarea',
                        value: p.brief,
                        required: true,
                      },
                      {
                        name: 'technologies',
                        label: 'Edit project technologies (one per line)',
                        type: 'lines',
                        value: p.technologies.join('\n'),
                        required: true,
                      },
                      {
                        name: 'confidential',
                        label: 'Confidential project',
                        type: 'checkbox',
                        value: p.confidential,
                      },
                      {
                        name: 'status',
                        label: 'Project publication state',
                        type: 'select',
                        value: p.status,
                        options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'].map(
                          (value) => ({ value, label: value }),
                        ),
                      },
                      {
                        name: 'publicationNote',
                        label: 'Publication or change rationale',
                        type: 'textarea',
                        required: true,
                      },
                    ]}
                    button="Save project publication"
                  />
                </details>
                <details>
                  <summary>Create a pod</summary>
                  <ProjectForm
                    action="pod"
                    values={{ projectId: p.id }}
                    fields={[
                      { name: 'name', label: 'Pod name', required: true },
                    ]}
                    button="Create pod"
                  />
                </details>
                {a.role === 'ADMIN' && (
                  <>
                    <details>
                      <summary>
                        Repository permissions & project mentors
                      </summary>
                      <ProjectForm
                        action="repository"
                        values={{ projectId: p.id }}
                        fields={[
                          {
                            name: 'fullName',
                            label: 'Authorized GitHub repository (owner/name)',
                            required: true,
                          },
                        ]}
                        button="Authorize repository"
                      />
                      <ProjectForm
                        action="staff"
                        values={{ projectId: p.id }}
                        fields={[
                          {
                            name: 'userId',
                            label: 'Project mentor',
                            type: 'select',
                            options: mentors.map((m) => ({
                              value: m.id,
                              label: m.name ?? m.id,
                            })),
                          },
                          {
                            name: 'remove',
                            label: 'Remove project access',
                            type: 'checkbox',
                          },
                        ]}
                        button="Update project mentor"
                      />
                    </details>
                    <details>
                      <summary>Archive project access</summary>
                      <ProjectForm
                        action="retire"
                        values={{ kind: 'PROJECT', id: p.id }}
                        fields={[
                          {
                            name: 'reason',
                            label: 'Archive reason',
                            type: 'textarea',
                            required: true,
                          },
                        ]}
                        button="Archive project"
                      />
                    </details>
                  </>
                )}
              </>
            )}
          </section>
        ))}
      </div>
      {!projects.length && (
        <Empty title="No project workspaces yet.">
          Your assigned, authorized project pods will appear here.
        </Empty>
      )}
      {a.role !== 'STUDENT' && (
        <section className="learn-card">
          <h2>Create a supervised product project</h2>
          <p className="learn-meta">
            For HireFlow, use synthetic applicant data in its separate
            repository/application. Do not place candidate resumes or client
            secrets in this training workspace.
          </p>
          <ProjectForm
            action="create"
            fields={[
              {
                name: 'title',
                label: 'Project name',
                value: '',
                required: true,
              },
              {
                name: 'productKey',
                label: 'Product identifier',
                value: 'hireflow',
                required: true,
              },
              {
                name: 'brief',
                label: 'Project brief and training outcomes',
                type: 'textarea',
                required: true,
              },
              {
                name: 'technologies',
                label: 'Technologies (one per line)',
                type: 'lines',
                value: 'TypeScript\nPostgreSQL',
                required: true,
              },
              {
                name: 'courseId',
                label: 'Course scope',
                type: 'select',
                options: [
                  ...(a.role === 'ADMIN'
                    ? [{ value: '', label: 'Cross-functional project' }]
                    : []),
                  ...courses.map((c) => ({ value: c.id, label: c.title })),
                ],
              },
              {
                name: 'mentorId',
                label: 'Assigned lead mentor',
                type: 'select',
                options: mentors.map((m) => ({
                  value: m.id,
                  label: m.name ?? m.id,
                })),
              },
              {
                name: 'confidential',
                label: 'Confidential project (blocks portfolio exports)',
                type: 'checkbox',
                value: true,
              },
              {
                name: 'status',
                label: 'Publication status',
                type: 'select',
                options: [
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'PUBLISHED', label: 'Published' },
                ],
              },
            ]}
            button="Create project"
          />
        </section>
      )}
    </LearningShell>
  );
}
