'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { z } from 'zod';
import type { courseEditSchema } from '@/lib/catalog/admin';
type Edit = z.input<typeof courseEditSchema>;
export function AdminCourseEditor({
  id,
  initial,
  mentors,
}: {
  id: string;
  initial: Edit;
  mentors: { id: string; name: string }[];
}) {
  const [data, setData] = useState(initial),
    [amount, setAmount] = useState(
      initial.priceMinor === null ? '' : (initial.priceMinor / 100).toFixed(2),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  function update<K extends keyof Edit>(key: K, value: Edit[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }
  return (
    <form
      className="admin-course-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) {
          setError('Enter the fee in rupees, with at most two decimal places.');
          return;
        }
        const parts = amount.split('.');
        const priceMinor = amount
          ? Number(parts[0]) * 100 + Number((parts[1] ?? '').padEnd(2, '0'))
          : null;
        setBusy(true);
        try {
          const r = await fetch(`/api/admin/courses/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, priceMinor }),
          });
          const result = await r.json();
          if (!r.ok) {
            setError(
              [result.error, ...Object.values(result.fields ?? {}).flat()].join(
                ' ',
              ),
            );
            return;
          }
          setData((d) => ({
            ...d,
            version: result.version,
            approveContent: false,
            approvePrice: false,
            approveTerms: false,
          }));
          router.refresh();
        } catch {
          setError('Unable to save. Existing course data was not replaced.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="admin-edit-grid">
        <label>
          Title
          <Input
            value={data.title}
            onChange={(e) => update('title', e.target.value)}
            required
          />
        </label>
        <label>
          Publication status
          <select
            className="input"
            value={data.status}
            onChange={(e) => update('status', e.target.value as Edit['status'])}
          >
            <option>DRAFT</option>
            <option>PUBLISHED</option>
            <option>ARCHIVED</option>
          </select>
        </label>
        <label className="admin-edit-wide">
          Summary
          <textarea
            className="input"
            rows={2}
            value={data.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
        {(['audience', 'prerequisites', 'skills', 'technologies'] as const).map(
          (key) => (
            <label key={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}{' '}
              <span>(one per line)</span>
              <textarea
                className="input"
                rows={4}
                value={data[key].join('\n')}
                onChange={(e) => update(key, e.target.value.split('\n'))}
              />
            </label>
          ),
        )}
        <label>
          Delivery format
          <Input
            value={data.deliveryFormat}
            onChange={(e) => update('deliveryFormat', e.target.value)}
          />
        </label>
        <label>
          Approved source reference
          <Input
            value={data.contentSource}
            onChange={(e) => update('contentSource', e.target.value)}
            placeholder="Source document, revision, or approved record"
          />
        </label>
      </div>
      <div className="admin-checkboxes">
        <label>
          <input
            type="checkbox"
            checked={data.previewVisible}
            onChange={(e) => update('previewVisible', e.target.checked)}
          />
          Show a visibly labeled draft preview
        </label>
        <label>
          <input
            type="checkbox"
            checked={data.assessmentRequired}
            onChange={(e) => update('assessmentRequired', e.target.checked)}
          />
          Require a reviewed prerequisite assessment
        </label>
        <label>
          <input
            type="checkbox"
            checked={data.approveContent}
            onChange={(e) => update('approveContent', e.target.checked)}
          />
          I confirm the curriculum and prerequisites are approved against the
          source above
        </label>
      </div>
      <h3>24-week curriculum</h3>
      <p className="admin-help">
        Six modules, four weekly topics each. Unapproved changes remain draft.
      </p>
      {data.modules.map((module, index) => (
        <details className="admin-module-editor" key={module.startWeek}>
          <summary>
            Weeks {module.startWeek}–{module.startWeek + 3} · {module.title}
          </summary>
          <label>
            Module title
            <Input
              value={module.title}
              onChange={(e) =>
                update(
                  'modules',
                  data.modules.map((m, i) =>
                    i === index ? { ...m, title: e.target.value } : m,
                  ),
                )
              }
            />
          </label>
          <label>
            Learning purpose
            <textarea
              className="input"
              rows={2}
              value={module.summary}
              onChange={(e) =>
                update(
                  'modules',
                  data.modules.map((m, i) =>
                    i === index ? { ...m, summary: e.target.value } : m,
                  ),
                )
              }
            />
          </label>
          <label>
            Four weekly topics <span>(one per line)</span>
            <textarea
              className="input"
              rows={4}
              value={module.weeklyTopics.join('\n')}
              onChange={(e) =>
                update(
                  'modules',
                  data.modules.map((m, i) =>
                    i === index
                      ? { ...m, weeklyTopics: e.target.value.split('\n') }
                      : m,
                  ),
                )
              }
            />
          </label>
        </details>
      ))}
      <h3>Fees and legal approval</h3>
      <div className="admin-edit-grid">
        <label>
          Total fee (INR)
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Leave empty until approved"
          />
        </label>
        <label>
          Enrollment terms version
          <Input
            value={data.termsVersion}
            onChange={(e) => update('termsVersion', e.target.value)}
          />
        </label>
        <label className="admin-edit-wide">
          Enrollment terms
          <textarea
            className="input"
            rows={5}
            value={data.enrollmentTerms}
            onChange={(e) => update('enrollmentTerms', e.target.value)}
          />
        </label>
        <label className="admin-edit-wide">
          Refund disclosure
          <textarea
            className="input"
            rows={4}
            value={data.refundPolicy}
            onChange={(e) => update('refundPolicy', e.target.value)}
          />
        </label>
      </div>
      <div className="admin-checkboxes">
        <label>
          <input
            type="checkbox"
            checked={data.approvePrice}
            onChange={(e) => update('approvePrice', e.target.checked)}
          />
          This total fee has been approved
        </label>
        <label>
          <input
            type="checkbox"
            checked={data.approveTerms}
            onChange={(e) => update('approveTerms', e.target.checked)}
          />
          The enrollment terms and refund disclosure are approved
        </label>
      </div>
      <h3>Course instructors</h3>
      {mentors.length ? (
        mentors.map((m) => (
          <label className="admin-mentor-option" key={m.id}>
            <input
              type="checkbox"
              checked={data.mentorIds.includes(m.id)}
              onChange={(e) =>
                update(
                  'mentorIds',
                  e.target.checked
                    ? [...data.mentorIds, m.id]
                    : data.mentorIds.filter((id) => id !== m.id),
                )
              }
            />
            {m.name}
          </label>
        ))
      ) : (
        <p className="admin-help">
          No mentor-role profiles are configured. No instructor identity will be
          invented.
        </p>
      )}
      {error && (
        <div className="workflow-error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save course revision'}
      </Button>
      <p className="admin-help">
        Version {data.version} · Changes are audited. Publishing and approvals
        require your admin session.
      </p>
    </form>
  );
}
