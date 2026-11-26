import '@/styles/learning.css';
import { PasswordForm } from '@/components/auth/password-form';
import Link from 'next/link';
export default function Register() {
  return (
    <main id="main" className="container auth-page">
      <section className="auth-card">
        <h1>Create your account</h1>
        <p>
          Use a unique password of at least 14 characters. Verify your email
          before signing in.
        </p>
        <PasswordForm action="register" />
        <Link href="/sign-in">Already registered? Sign in</Link>
      </section>
    </main>
  );
}
