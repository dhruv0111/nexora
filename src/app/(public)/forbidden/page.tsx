import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function Forbidden() {
  return (
    <main id="main" className="container state-page">
      <p className="eyebrow">403 · ACCESS RESTRICTED</p>
      <h1>This workspace needs a different role.</h1>
      <p>Your account does not have permission to view this workspace.</p>
      <Button asChild>
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </main>
  );
}
