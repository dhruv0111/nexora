'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
export function AdminAction({
  url,
  body,
  label,
  disabled = false,
}: {
  url: string;
  body: Record<string, unknown>;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="admin-inline-action">
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const data = await r.json();
            if (!r.ok) setError(data.error);
            else router.refresh();
          } catch {
            setError('Unable to connect. Please retry.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Working…' : label}
      </Button>
      {error && (
        <p role="alert" className="workflow-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function AdmissionsReview({
  id,
  version,
  status,
  assessmentStatus,
}: {
  id: string;
  version: number;
  status: string;
  assessmentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="admin-review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        try {
          const r = await fetch(`/api/admin/applications/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              version,
              status: f.get('status'),
              assessmentStatus: f.get('assessmentStatus'),
              note: f.get('note'),
            }),
          });
          const data = await r.json();
          if (!r.ok) setError(data.error);
          else router.refresh();
        } catch {
          setError('Unable to save review.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Next status
        <select
          name="status"
          className="input"
          defaultValue={status === 'ACCEPTED' ? 'ACCEPTED' : 'IN_REVIEW'}
        >
          {[
            'IN_REVIEW',
            'ASSESSMENT',
            'ACCEPTED',
            'REJECTED',
            'WAITLISTED',
          ].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prerequisite review
        <select
          name="assessmentStatus"
          className="input"
          defaultValue={assessmentStatus}
        >
          {['PENDING', 'PASSED', 'NEEDS_REVIEW'].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-review-note">
        Feedback visible to the applicant
        <textarea
          className="input"
          name="note"
          required
          minLength={5}
          maxLength={2000}
          rows={2}
        />
      </label>
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? 'Saving…' : 'Save admissions review'}
      </Button>
    </form>
  );
}
