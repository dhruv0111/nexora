import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <main id="main" className="container state-page">
      <p className="eyebrow">404 · OFF THE PATH</p>
      <h1>Let’s get you back on track.</h1>
      <p>This page could not be found.</p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
