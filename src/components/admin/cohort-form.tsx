'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function CohortForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="admin-cohort-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setError('');
        try {
          const r = await fetch('/api/admin/cohorts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: f.get('courseId'),
              name: f.get('name'),
              startsAt: new Date(String(f.get('startsAt'))).toISOString(),
              endsAt: new Date(String(f.get('endsAt'))).toISOString(),
              capacity: Number(f.get('capacity')),
              status: f.get('status'),
              admissionsOpen: f.get('admissionsOpen') === 'on',
              mentorIds: [],
            }),
          });
          const result = await r.json();
          if (!r.ok)
            setError(
              [result.error, ...Object.values(result.fields ?? {}).flat()].join(
                ' ',
              ),
            );
          else {
            form.reset();
            router.refresh();
          }
        } catch {
          setError('Check the dates and connection, then retry.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Program
        <select name="courseId" className="input">
          {courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cohort name
        <Input name="name" required minLength={3} />
      </label>
      <label>
        Start (your local time)
        <Input name="startsAt" type="datetime-local" required />
      </label>
      <label>
        End (your local time)
        <Input name="endsAt" type="datetime-local" required />
      </label>
      <label>
        Capacity
        <Input name="capacity" type="number" min={1} max={10000} required />
      </label>
      <label>
        Status
        <select name="status" className="input">
          <option>DRAFT</option>
          <option>PUBLISHED</option>
        </select>
      </label>
      <label className="admin-mentor-option">
        <input name="admissionsOpen" type="checkbox" />
        Open admissions
      </label>
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create cohort'}
      </Button>
    </form>
  );
}
