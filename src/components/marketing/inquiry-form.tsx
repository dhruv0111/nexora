'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LockKeyhole, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { courses } from '@/config/site';
import { inquirySchema, type InquiryInput } from '@/lib/inquiry-validation';
import { emitMarketingEvent } from '@/lib/analytics';
export function InquiryForm({
  program = 'undecided',
  intent = 'program_interest',
}: {
  program?: string;
  intent?: string;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [receipt, setReceipt] = useState('');
  const [purpose, setPurpose] = useState(
    intent === 'career_call' ? 'career_call' : 'program_interest',
  );
  const firstError = useRef<HTMLDivElement>(null);
  async function refreshChallenge() {
    try {
      const response = await fetch('/api/inquiries/challenge', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return false;
      }
      setToken(data.token);
      return true;
    } catch {
      setError('Unable to connect. Please check your connection and retry.');
      return false;
    }
  }
  useEffect(() => {
    let active = true;
    void fetch('/api/inquiries/challenge', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok) setToken(data.token);
        else setError(data.error);
      })
      .catch(() => {
        if (active)
          setError(
            'Unable to connect. Please check your connection and retry.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const candidate = {
      name: data.get('name'),
      email: data.get('email'),
      program: data.get('program'),
      intent: purpose,
      message: data.get('message'),
      consent: data.get('consent') === 'on',
      website: data.get('website'),
    };
    const result = inquirySchema.safeParse(candidate);
    if (!result.success) {
      setFields(result.error.flatten().fieldErrors);
      setError('Check the fields below.');
      firstError.current?.focus();
      return;
    }
    setFields({});
    setError('');
    setBusy(true);
    try {
      if (!token) {
        if (await refreshChallenge())
          setError('Form check refreshed. Please submit again in a moment.');
        return;
      }
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result.data, token }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Unable to save. Please retry.');
        setFields(body.fields ?? {});
        if (response.status === 400 && !body.fields) await refreshChallenge();
        firstError.current?.focus();
        return;
      }
      setReceipt(body.receipt);
      emitMarketingEvent({
        name: 'inquiry_submitted',
        location: 'inquiry_form',
        program: result.data.program,
        intent: result.data.intent,
      });
    } catch {
      setError(
        'Connection interrupted. Your details are still here. Please retry.',
      );
      firstError.current?.focus();
    } finally {
      setBusy(false);
    }
  }
  function fieldError(name: keyof InquiryInput) {
    return fields[name]?.[0];
  }
  if (receipt)
    return (
      <div
        className="inquiry-success"
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
      >
        <CheckCircle2 size={38} />
        <p className="eyebrow">YOUR NEXT CHAPTER IS IN MOTION</p>
        <h3>Inquiry received.</h3>
        <p>
          Your request is saved for the Nexora team to review. No enrollment,
          payment, or appointment has been confirmed.
        </p>
        <p className="receipt">Reference: {receipt}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setReceipt('');
            setToken('');
            void refreshChallenge();
          }}
        >
          Submit another inquiry
        </Button>
      </div>
    );
  return (
    <form
      className="inquiry-form"
      onSubmit={submit}
      noValidate
      aria-label="Program inquiry"
    >
      <div className="inquiry-purpose">
        <button
          type="button"
          aria-pressed={purpose === 'program_interest'}
          onClick={() => setPurpose('program_interest')}
        >
          Explore a program
        </button>
        <button
          type="button"
          aria-pressed={purpose === 'career_call'}
          onClick={() => setPurpose('career_call')}
        >
          Request a free call
        </button>
      </div>
      {purpose === 'career_call' && (
        <p className="inquiry-call-note">
          Request a conversation. The team will confirm availability and a time;
          this form does not book an appointment.
        </p>
      )}
      <div
        className="form-error"
        ref={firstError}
        role={error ? 'alert' : undefined}
        tabIndex={-1}
      >
        {error && (
          <>
            <p>{error}</p>
            {!token && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  void refreshChallenge();
                }}
              >
                Retry connection
              </button>
            )}
          </>
        )}
      </div>
      <div className="inquiry-fields">
        <div>
          <label htmlFor="inquiry-name">Your name</label>
          <Input
            id="inquiry-name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            placeholder="What should we call you?"
            aria-invalid={!!fieldError('name')}
            aria-describedby={fieldError('name') ? 'name-error' : undefined}
          />
          {fieldError('name') && (
            <p className="field-error" id="name-error">
              {fieldError('name')}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="inquiry-email">Email address</label>
          <Input
            id="inquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            aria-invalid={!!fieldError('email')}
            aria-describedby={fieldError('email') ? 'email-error' : undefined}
          />
          {fieldError('email') && (
            <p className="field-error" id="email-error">
              {fieldError('email')}
            </p>
          )}
        </div>
      </div>
      <label htmlFor="inquiry-program">Which path interests you?</label>
      <select
        id="inquiry-program"
        name="program"
        className="input"
        defaultValue={
          courses.some((c) => c.slug === program) ? program : 'undecided'
        }
      >
        {courses.map((course) => (
          <option key={course.slug} value={course.slug}>
            {course.name}
          </option>
        ))}
        <option value="undecided">Not sure yet — help me choose</option>
      </select>
      <label htmlFor="inquiry-message">
        Anything you’d like us to know? <span>(optional)</span>
      </label>
      <textarea
        id="inquiry-message"
        name="message"
        className="input"
        rows={3}
        maxLength={1000}
        placeholder="Your background, your goals, or a question…"
      />
      <div className="inquiry-trap" aria-hidden="true">
        <label htmlFor="inquiry-website">Leave this blank</label>
        <input
          id="inquiry-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <label className="inquiry-consent">
        <input
          type="checkbox"
          name="consent"
          required
          aria-invalid={!!fieldError('consent')}
          aria-describedby={
            fieldError('consent')
              ? 'consent-notice consent-error'
              : 'consent-notice'
          }
        />
        <span>
          I agree to Nexora storing my inquiry and contacting me about this
          request.{' '}
          <Link href="/policies/privacy" target="_blank" rel="noopener">
            Read the inquiry data notice (opens in a new tab).
          </Link>
        </span>
      </label>
      {fieldError('consent') && (
        <p className="field-error" id="consent-error">
          {fieldError('consent')}
        </p>
      )}
      <p id="consent-notice" className="inquiry-data-note">
        Name, email, program choice, and any message are saved with your
        consent. Please don’t include sensitive information.
      </p>
      <Button type="submit" disabled={busy} className="inquiry-submit">
        {busy ? (
          <>
            <LoaderCircle size={17} className="loading-icon" />
            Saving your request…
          </>
        ) : purpose === 'career_call' ? (
          'Request a Free Career Call'
        ) : (
          'Send My Inquiry'
        )}
      </Button>
      <p className="form-security">
        <LockKeyhole size={13} />
        No payment. No enrollment obligation.
      </p>
      <noscript>
        JavaScript is required to validate and securely submit this inquiry.
      </noscript>
    </form>
  );
}
