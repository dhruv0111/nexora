'use client';
import { useState } from 'react';
export function PasswordForm({ action }: { action: string }) {
  const [show, S] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState(''),
    [message, M] = useState('');
  const email = ['sign-in', 'register', 'forgot-password'].includes(action);
  return (
    <form
      className="learn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        B(true);
        E('');
        M('');
        try {
          const data = Object.fromEntries(new FormData(e.currentTarget));
          if (['reset-password', 'verify-email'].includes(action))
            data.token = location.hash.slice(1);
          const r = await fetch('/api/account/' + action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            }),
            j = await r.json();
          if (!r.ok) throw Error(j.error);
          if (j.redirect) location.assign(j.redirect);
          else M(j.message);
        } catch (err) {
          E(err instanceof Error ? err.message : 'Request failed.');
        } finally {
          B(false);
        }
      }}
    >
      {email && (
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
      )}
      {action === 'register' && (
        <label>
          Account type
          <select name="role">
            <option value="STUDENT">Student</option>
            <option value="EMPLOYER">Employer</option>
          </select>
        </label>
      )}
      {action === 'change-password' && (
        <label>
          Current password
          <input
            name="currentPassword"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
          />
        </label>
      )}
      {action !== 'forgot-password' && (
        <>
          <label>
            {['reset-password', 'change-password'].includes(action)
              ? 'New password'
              : 'Password'}
            <input
              name="password"
              required
              maxLength={128}
              type={show ? 'text' : 'password'}
              autoComplete={
                ['verify-email', 'sign-in'].includes(action)
                  ? 'current-password'
                  : 'new-password'
              }
            />
          </label>
          <button type="button" aria-pressed={show} onClick={() => S(!show)}>
            {show ? 'Hide password' : 'Show password'}
          </button>
        </>
      )}
      <button className="button button-primary" disabled={busy}>
        {busy
          ? 'Working…'
          : {
              register: 'Create account',
              'sign-in': 'Sign in with password',
              'forgot-password': 'Request recovery email',
              'reset-password': 'Reset password',
              'verify-email': 'Verify email',
              'change-password': 'Change password',
            }[action]}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
