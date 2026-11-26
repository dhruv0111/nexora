'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function CompanyUpload() {
  const router = useRouter(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="learn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        setMessage('');
        try {
          const r = await fetch('/api/career/upload', {
              method: 'POST',
              body: new FormData(e.currentTarget),
            }),
            b = await r.json();
          if (!r.ok) throw Error(b.error);
          setMessage('Document stored privately for administrative review.');
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Upload failed.');
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Company verification document
        <input type="file" name="file" accept=".pdf,.txt" required />
        <small>
          PDF or TXT · 2 MB maximum · five active documents. Only your company
          account and NEXORA administrators can download.
        </small>
      </label>
      <button className="button button-secondary" disabled={pending}>
        {pending ? 'Uploading…' : 'Upload verification document'}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
