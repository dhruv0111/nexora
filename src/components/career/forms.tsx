import { CareerForm, f, options, localDate, newDate } from './ui';
import type { Opportunity, CareerMock } from '@/generated/prisma/client';
export function JobForm({ job }: { job?: Opportunity }) {
  return (
    <CareerForm
      key={job?.version ?? 0}
      action="job"
      values={{ ...(job ? { id: job.id } : {}), version: job?.version ?? 0 }}
      fields={[
        f('title', 'Job title', job?.title),
        f(
          'description',
          'Role responsibilities and prerequisites',
          job?.description,
          'textarea',
        ),
        f(
          'skills',
          'Required skills (one per line)',
          job?.skills.join('\n'),
          'lines',
        ),
        options(
          'employmentType',
          'Employment type',
          ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
          job?.employmentType,
        ),
        f('location', 'Job location', job?.location),
        options(
          'workMode',
          'Work arrangement',
          ['ONSITE', 'HYBRID', 'REMOTE'],
          job?.workMode,
        ),
        f('eligibility', 'Work eligibility requirement', job?.eligibility),
        f(
          'minExperience',
          'Minimum professional experience in years',
          job?.minExperience ?? 0,
          'number',
        ),
        f(
          'compensationMin',
          'Minimum annual compensation (0 if undisclosed)',
          job?.compensationMin ?? 0,
          'number',
        ),
        f(
          'compensationMax',
          'Maximum annual compensation (0 if undisclosed)',
          job?.compensationMax ?? 0,
          'number',
        ),
        options(
          'currency',
          'Compensation currency',
          ['INR', 'USD', 'EUR', 'GBP'],
          job?.currency,
        ),
        f(
          'deadline',
          'Application deadline (IST)',
          job?.deadline ? localDate(job.deadline) : newDate(30),
          'datetime-local',
        ),
        options(
          'status',
          'Opening state',
          ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
          job?.status,
        ),
      ]}
      button={job ? 'Save opening' : 'Create draft opening'}
    />
  );
}
export function MockForm({
  mock,
  userId,
  mentorId,
  student = false,
}: {
  mock?: CareerMock;
  userId: string;
  mentorId: string;
  student?: boolean;
}) {
  return (
    <CareerForm
      action="mock"
      values={{
        ...(mock ? { id: mock.id } : {}),
        userId,
        mentorId,
        version: mock?.version ?? 0,
      }}
      fields={[
        options(
          'status',
          'Mock interview status',
          student
            ? mock
              ? ['CANCELLED']
              : ['REQUESTED']
            : ['CONFIRMED', 'CANCELLED', 'COMPLETED'],
          mock?.status,
        ),
        f(
          'startsAt',
          'Mock starts (IST)',
          mock ? localDate(mock.startsAt) : newDate(),
          'datetime-local',
        ),
        f(
          'endsAt',
          'Mock ends (IST)',
          mock
            ? localDate(mock.endsAt)
            : localDate(new Date(+new Date() + 86400000 + 3600000)),
          'datetime-local',
        ),
        f(
          'availability',
          'Candidate availability and focus areas',
          mock?.availability ?? '',
          'textarea',
          false,
        ),
        f(
          'feedback',
          'Mock interview feedback',
          mock?.feedback ?? '',
          'textarea',
          false,
        ),
        f(
          'score',
          'Mock score (-1 if not assessed)',
          mock?.score ?? -1,
          'number',
        ),
      ]}
      button={mock ? 'Update mock interview' : 'Request mock interview'}
    />
  );
}
