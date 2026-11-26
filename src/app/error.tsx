'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logEvent } from '@/lib/logger';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logEvent('render_error', error.digest);
  }, [error]);
  return (
    <main id="main" className="container state-page">
      <h1>Something interrupted your session.</h1>
      <p>Your work may still be available. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
