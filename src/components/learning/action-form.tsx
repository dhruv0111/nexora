'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RubricInput, ScoreInput, QuestionsInput } from './structured-fields';
export type Field = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'datetime-local'
    | 'select'
    | 'checkbox'
    | 'url'
    | 'lines'
    | 'json'
    | 'rubric'
    | 'questions'
    | 'scores';
  value?: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  max?: number;
  min?: number;
};
export function ActionForm({
  action,
  values,
  fields,
  button = 'Save',
  success = 'Saved successfully.',
  namespace = 'learning',
}: {
  action: string;
  values?: Record<string, unknown>;
  fields: Field[];
  button?: string;
  success?: string;
  namespace?: 'learning' | 'projects' | 'career' | 'operations';
}) {
  const router = useRouter(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="learn-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setMessage('');
        setError('');
        try {
          const form = new FormData(event.currentTarget),
            body = { ...values };
          for (const f of fields) {
            const v = form.get(f.name);
            body[f.name] =
              f.type === 'checkbox'
                ? v === 'on'
                : f.type === 'lines'
                  ? String(v)
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean)
                  : f.type === 'number'
                    ? Number(v)
                    : ['json', 'rubric', 'questions', 'scores'].includes(
                          f.type ?? '',
                        )
                      ? JSON.parse(String(v))
                      : f.type === 'datetime-local'
                        ? new Date(String(v) + '+05:30').toISOString()
                        : String(v ?? '');
          }
          const res = await fetch(`/api/${namespace}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw Error(data.error ?? 'Unable to save.');
          setMessage(success);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to save.');
        } finally {
          setPending(false);
        }
      }}
    >
      {fields.map((f) =>
        ['rubric', 'questions', 'scores'].includes(f.type ?? '') ? (
          <fieldset key={f.name} className="learn-builder-field">
            <legend>{f.label}</legend>
            {f.type === 'rubric' ? (
              <RubricInput name={f.name} value={String(f.value)} />
            ) : f.type === 'questions' ? (
              <QuestionsInput name={f.name} value={String(f.value)} />
            ) : (
              <ScoreInput
                name={f.name}
                value={String(f.value)}
                options={f.options ?? []}
              />
            )}
          </fieldset>
        ) : (
          <label
            key={f.name}
            className={f.type === 'checkbox' ? 'learn-check' : ''}
          >
            <span>{f.label}</span>
            {f.type === 'textarea' ||
            f.type === 'json' ||
            f.type === 'lines' ? (
              <textarea
                name={f.name}
                defaultValue={String(f.value ?? '')}
                required={f.required}
                rows={f.type === 'json' ? 5 : 4}
                maxLength={f.type === 'json' ? 60000 : 50000}
              />
            ) : f.type === 'select' ? (
              <select
                name={f.name}
                defaultValue={String(f.value ?? '')}
                required={f.required}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                type={f.type ?? 'text'}
                defaultValue={
                  f.type === 'checkbox' ? undefined : String(f.value ?? '')
                }
                defaultChecked={
                  f.type === 'checkbox' ? Boolean(f.value) : undefined
                }
                required={f.required}
                min={f.min}
                max={f.max}
                maxLength={2000}
              />
            )}{' '}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ),
      )}
      <div>
        <button className="button button-primary" disabled={pending}>
          {pending ? 'Saving…' : button}
        </button>
      </div>
      {message && (
        <p role="status" className="learn-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="learn-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function UploadForm({
  submissionId,
  enrollmentId,
}: {
  submissionId: string;
  enrollmentId: string;
}) {
  const router = useRouter(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  return (
    <form
      className="learn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        setMessage('');
        const form = new FormData(e.currentTarget);
        form.set('submissionId', submissionId);
        form.set('enrollmentId', enrollmentId);
        try {
          const r = await fetch('/api/learning/upload', {
              method: 'POST',
              body: form,
            }),
            b = await r.json();
          if (!r.ok) throw Error(b.error);
          setMessage('File stored privately.');
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Upload failed.');
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Attach a resource
        <input type="file" name="file" accept=".txt,.pdf" required />
        <small>
          TXT or PDF, up to 2 MB each. Maximum three files. Downloads remain
          private.
        </small>
      </label>
      <button className="button button-secondary" disabled={pending}>
        {pending ? 'Uploading…' : 'Upload file'}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
