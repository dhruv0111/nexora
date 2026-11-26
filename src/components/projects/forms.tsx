'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm, type Field } from '@/components/learning/action-form';
export function ProjectForm(props: {
  action: string;
  values?: Record<string, unknown>;
  fields: Field[];
  button?: string;
}) {
  return <ActionForm {...props} namespace="projects" />;
}
export function EvidenceUpload({ evidenceId }: { evidenceId: string }) {
  const router = useRouter(),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="learn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = new FormData(e.currentTarget);
        form.set('evidenceId', evidenceId);
        try {
          const r = await fetch('/api/projects/upload', {
              method: 'POST',
              body: form,
            }),
            b = await r.json();
          if (!r.ok) throw Error(b.error);
          setStatus('Private attachment saved.');
          router.refresh();
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'Upload unavailable.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Private contribution attachment
        <input name="file" type="file" accept=".pdf,.txt" required />
        <small>
          PDF/TXT, up to 2 MB. Three attachments per contribution; shared only
          with this pod.
        </small>
      </label>
      <button className="button button-secondary" disabled={busy}>
        {busy ? 'Uploading…' : 'Attach evidence file'}
      </button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
