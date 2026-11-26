import '@/styles/learning.css';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PasswordForm } from '@/components/auth/password-form';
import { SignOutButton } from '@/components/auth/sign-out-button';
import Link from 'next/link';
export default async function Page({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const { action } = await params;
  if (
    ![
      'security',
      'forgot-password',
      'reset-password',
      'change-password',
      'verify-email',
    ].includes(action)
  )
    notFound();
  if (
    ['security', 'change-password'].includes(action) &&
    !(await getServerSession(authOptions))?.user
  )
    redirect('/sign-in');
  return (
    <main id="main" className="container auth-page">
      <section className="auth-card">
        <h1>{action.replaceAll('-', ' ')}</h1>
        {action === 'security' ? (
          <>
            <Link href="/account/change-password">
              Change password and revoke sessions
            </Link>
            <SignOutButton />
          </>
        ) : (
          <>
            <p>
              {action === 'verify-email'
                ? 'Confirm the password you chose at registration.'
                : action === 'forgot-password'
                  ? 'Enter your account email to request a single-use recovery link.'
                  : 'Choose a new password of at least 14 characters. This signs you out on all devices.'}
            </p>
            <PasswordForm action={action} />
          </>
        )}
      </section>
    </main>
  );
}
