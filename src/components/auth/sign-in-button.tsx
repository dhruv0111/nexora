'use client';
import { useState } from 'react';
import { safeReturnPath } from '@/lib/redirects';
import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function SignInButton({
  configured,
  callbackUrl,
}: {
  configured: boolean;
  callbackUrl?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <Button
        className="auth-button"
        disabled={!configured || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await signIn('github', {
              callbackUrl: safeReturnPath(callbackUrl),
            });
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
      >
        <LogIn size={18} />
        {busy ? 'Connecting…' : 'Continue with GitHub'}
      </Button>
      {error && <p role="alert">Unable to connect. Please try again.</p>}
    </>
  );
}
