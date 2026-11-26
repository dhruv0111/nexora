import '@/styles/learning.css';
import { PasswordForm } from '@/components/auth/password-form';
import Link from 'next/link';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { SignInButton } from '@/components/auth/sign-in-button';
import { env, authConfigured } from '@/lib/env';
export const metadata = { title: 'Sign in' };
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  return (
    <main id="main" className="container auth-page">
      <div className="auth-intro">
        <p className="eyebrow">
          <Sparkles size={15} />
          YOUR NEXT CHAPTER
        </p>
        <h1>
          Good to have
          <br />
          you <span className="gradient-text">back.</span>
        </h1>
        <p>Your space to learn, build, and make meaningful progress.</p>
        <span className="auth-note">
          <ShieldCheck size={17} />
          Secure access. A focused experience.
        </span>
      </div>
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">NEXORA WORKSPACE</p>
        <h2 id="sign-in-title">Keep your momentum.</h2>
        <p>Sign in to access your workspace.</p>
        {error && (
          <div role="alert" className="notice">
            We couldn’t sign you in. Check your account and try again.
          </div>
        )}
        <PasswordForm action="sign-in" />
        <Link href="/account/forgot-password">Forgot password?</Link>
        {env.GITHUB_ID && (
          <SignInButton configured={authConfigured} callbackUrl={callbackUrl} />
        )}
        {!authConfigured && (
          <div className="notice">
            Sign-in is not available yet. Authentication credentials and a
            database must be configured by the operator.
          </div>
        )}
        <p className="auth-fineprint">
          Employer accounts require separate company verification to recruit.
        </p>
        <Link className="text-link" href="/register">
          New to Nexora?
        </Link>
      </section>
    </main>
  );
}
