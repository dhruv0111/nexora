import Link from 'next/link';
import { Brand } from '@/components/layout/brand';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  LifeBuoy,
  LayoutDashboard,
  Bell,
  GraduationCap,
} from 'lucide-react';
import type { Role } from '@/lib/roles';
const links = [
  ['Overview', '', LayoutDashboard],
  ['My learning', 'courses', BookOpen],
  ['Live classes', 'classes', CalendarDays],
  ['Assignments', 'assignments', ClipboardList],
  ['Assessments', 'assessments', GraduationCap],
  ['Updates', 'announcements', Bell],
  ['Learning history', 'history', BookOpen],
  ['Support', 'support', LifeBuoy],
] as const;
export function LearningShell({
  role,
  active = '',
  children,
}: {
  role: Role;
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="learning-platform">
      <aside className="learn-sidebar">
        <Brand />
        <p className="learn-kicker">
          {role === 'STUDENT'
            ? 'YOUR NEXT CHAPTER'
            : role === 'MENTOR'
              ? 'MENTOR WORKSPACE'
              : 'LEARNING OPERATIONS'}
        </p>
        <nav aria-label="Learning navigation">
          {role === 'STUDENT' ? (
            links.map(([label, key, Icon]) => (
              <Link
                key={key}
                aria-current={active === key ? 'page' : undefined}
                href={key ? `/learning/${key}` : '/dashboard/student'}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))
          ) : (
            <>
              <Link href={`/dashboard/${role.toLowerCase()}`}>
                Workspace overview
              </Link>
              <Link
                href={
                  role === 'ADMIN'
                    ? '/dashboard/admin/learning'
                    : '/learning/cohorts'
                }
              >
                Cohorts & learning
              </Link>
              {role === 'ADMIN' && (
                <>
                  <Link href="/dashboard/admin/admissions">
                    Admissions & programs
                  </Link>
                  <Link href="/learning/support">Student support</Link>
                </>
              )}
            </>
          )}
          <Link
            href="/projects"
            aria-current={active === 'projects' ? 'page' : undefined}
          >
            Project workspace
          </Link>
          <Link href="/account/security">Account security</Link>
          <Link href="/career">Career center</Link>
          {role === 'STUDENT' && (
            <Link href="/applications">My applications</Link>
          )}
        </nav>
        <div className="learn-sidebar-bottom">
          <span>
            Learn with intention.
            <br />
            Build with purpose.
          </span>
          <SignOutButton />
        </div>
      </aside>
      <div className="learn-workspace">
        <header className="learn-topbar">
          <span>Secure learning platform</span>
          <span>Asia/Kolkata · IST</span>
          <details className="learn-mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Mobile learning navigation">
              {role === 'STUDENT' ? (
                links.map(([label, key]) => (
                  <Link
                    key={key}
                    href={key ? `/learning/${key}` : '/dashboard/student'}
                  >
                    {label}
                  </Link>
                ))
              ) : (
                <>
                  <Link href={`/dashboard/${role.toLowerCase()}`}>
                    Overview
                  </Link>
                  <Link
                    href={
                      role === 'ADMIN'
                        ? '/dashboard/admin/learning'
                        : '/learning/cohorts'
                    }
                  >
                    Cohorts & learning
                  </Link>
                  {role === 'ADMIN' && (
                    <>
                      <Link href="/dashboard/admin/admissions">Admissions</Link>
                      <Link href="/learning/support">Support</Link>
                    </>
                  )}
                </>
              )}
              <Link
                href="/projects"
                aria-current={active === 'projects' ? 'page' : undefined}
              >
                Project workspace
              </Link>
              <Link href="/account/security">Account security</Link>
              <Link href="/career">Career center</Link>
              <SignOutButton />
            </nav>
          </details>
        </header>
        <div className="learn-content">{children}</div>
      </div>
    </main>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="learn-empty">
      <BookOpen size={25} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="learn-progress">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <progress max={100} value={value} aria-label={label} />
    </div>
  );
}
export function PageHeading({
  eyebrow = 'A LITTLE PROGRESS. EVERY DAY.',
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="learn-heading">
      <p className="learn-kicker">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
