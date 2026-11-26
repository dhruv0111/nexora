import Link from 'next/link';
import { Brand } from '@/components/layout/brand';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ActionForm, type Field } from '@/components/learning/action-form';
import type { Role } from '@/lib/roles';
export function CareerShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="career-shell">
      <aside className="career-sidebar">
        <Brand />
        <p className="learn-kicker">YOUR NEXT CHAPTER</p>
        <nav aria-label="Career navigation">
          <Link href="/dashboard">Learning workspace</Link>
          <Link href="/career">Career center</Link>
          {role === 'STUDENT' && (
            <Link href="/career/profile">Profile & sharing</Link>
          )}
          <Link href="/career/jobs">Job opportunities</Link>
          {['STUDENT', 'EMPLOYER'].includes(role) && (
            <Link href="/career/employer">Employer workspace</Link>
          )}
          {['ADMIN', 'MENTOR'].includes(role) && (
            <Link href="/career/admin">Placement administration</Link>
          )}
        </nav>
        <SignOutButton />
      </aside>
      <div className="career-workspace">
        <header className="career-topbar">
          <span>Secure learning platform · Career connections</span>
          <span>Asia/Kolkata · IST</span>
        </header>
        <div className="career-content">{children}</div>
      </div>
    </main>
  );
}
export function CareerForm(
  props: Omit<React.ComponentProps<typeof ActionForm>, 'namespace'>,
) {
  return <ActionForm {...props} namespace="career" />;
}
export const f = (
  name: string,
  label: string,
  value?: string | number | boolean,
  type: Field['type'] = 'text',
  required = true,
): Field => ({ name, label, value, type, required });
export const options = (
  name: string,
  label: string,
  values: string[],
  value?: string,
): Field => ({
  name,
  label,
  type: 'select',
  value,
  options: values.map((v) => ({ value: v, label: v.replaceAll('_', ' ') })),
  required: true,
});
export function Pager({
  page,
  base,
  extra = '',
}: {
  page: number;
  base: string;
  extra?: string;
}) {
  return (
    <nav className="career-pagination" aria-label="Pagination">
      {page > 1 && (
        <Link href={`${base}?page=${page - 1}${extra}`}>Previous page</Link>
      )}
      <span>Page {page} · up to 20 records</span>
      <Link href={`${base}?page=${page + 1}${extra}`}>Next page</Link>
    </nav>
  );
}
export function Status({ children }: { children: React.ReactNode }) {
  return <span className="learn-tag">{children}</span>;
}
export function localDate(v: Date | string) {
  return new Date(+new Date(v) + 330 * 60000).toISOString().slice(0, 16);
}
export const newDate = (days = 1) =>
  localDate(new Date(Date.now() + days * 86400000));
export const emptyOptions = (rows: { id: string; name: string | null }[]) =>
  rows.map((r) => ({ value: r.id, label: r.name ?? r.id }));
