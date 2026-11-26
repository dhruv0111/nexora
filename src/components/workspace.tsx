import Link from 'next/link';
import {
  BookOpen,
  FolderKanban,
  CalendarDays,
  Layers,
  Users,
  BriefcaseBusiness,
  GraduationCap,
  LayoutDashboard,
  Settings2,
} from 'lucide-react';
import { Brand } from './layout/brand';
import { Badge } from './ui/badge';
import type { Role } from '@/lib/roles';
const content: Record<
  Role,
  {
    title: string;
    description: string;
    metrics: string[];
    empty: string;
    detail: string;
  }
> = {
  STUDENT: {
    title: 'Your next chapter starts here.',
    description:
      'A little progress, every day. This is your space to learn and build.',
    metrics: ['Active courses', 'Projects built', 'Upcoming sessions'],
    empty: 'Your learning journey is ready for you.',
    detail:
      'Enrolled courses and your next lesson will appear here when learning opens.',
  },
  MENTOR: {
    title: 'Make room for great potential.',
    description: 'A focused space for your cohorts, sessions, and feedback.',
    metrics: ['Assigned cohorts', 'Reviews pending', 'Upcoming sessions'],
    empty: 'Your next cohort belongs here.',
    detail: 'Assigned cohorts and student project reviews will appear here.',
  },
  EMPLOYER: {
    title: 'Meet tomorrow’s problem solvers.',
    description:
      'Discover skills through real work and thoughtful conversations.',
    metrics: [
      'Published opportunities',
      'Applications',
      'Shortlisted candidates',
    ],
    empty: 'Build your talent pipeline.',
    detail:
      'Verified opportunities and candidate applications will appear here.',
  },
  ADMIN: {
    title: 'A clear view of what’s next.',
    description: 'Keep the learning experience running smoothly.',
    metrics: ['Published courses', 'Active cohorts', 'Applications to review'],
    empty: 'A strong foundation for every learner.',
    detail:
      'Operational insights will appear once programs and cohorts are configured.',
  },
};
export function Workspace({
  role,
  preview = false,
  children,
}: {
  role: Role;
  preview?: boolean;
  children?: React.ReactNode;
}) {
  const data = content[role];
  return (
    <div className={`workspace ${preview ? 'workspace-preview' : ''}`}>
      <aside className="workspace-sidebar">
        <Brand />
        <p className="sidebar-label">{role} WORKSPACE</p>
        <div className="workspace-nav">
          {!preview && role === 'ADMIN' && (
            <Link
              className="workspace-operational-link"
              href="/dashboard/admin/admissions"
            >
              Admissions & programs
            </Link>
          )}
          {!preview && role === 'ADMIN' && (
            <Link
              className="workspace-operational-link"
              href="/dashboard/admin/learning"
            >
              Learning operations
            </Link>
          )}
          {!preview && role === 'STUDENT' && (
            <Link className="workspace-operational-link" href="/applications">
              My applications
            </Link>
          )}
          {!preview && role === 'ADMIN' && (
            <Link className="workspace-operational-link" href="/career/admin">
              Placement administration
            </Link>
          )}
          {!preview && role === 'ADMIN' && (
            <Link className="workspace-operational-link" href="/operations">
              Executive operations
            </Link>
          )}
          <div className="selected">
            <LayoutDashboard size={18} />
            Overview
          </div>
          <div>
            <BookOpen size={18} />
            {role === 'STUDENT' ? 'My learning' : 'Programs'}
            <Badge>Soon</Badge>
          </div>
          <div>
            <FolderKanban size={18} />
            Projects<Badge>Soon</Badge>
          </div>
          <div>
            <CalendarDays size={18} />
            Schedule<Badge>Soon</Badge>
          </div>
          <div>
            <Users size={18} />
            Community<Badge>Soon</Badge>
          </div>
        </div>
        <div className="sidebar-bottom">
          <Settings2 size={17} />
          <span>Built for your focus.</span>
        </div>
      </aside>
      <div className="workspace-main">
        <div className="workspace-topbar">
          <span>
            Workspace <span className="muted">/ Overview</span>
          </span>
          <Badge>{preview ? 'Shell preview' : 'Phase 1'}</Badge>
        </div>
        <div className="workspace-body">
          {children ?? (
            <>
              <div className="workspace-welcome">
                <div>
                  <p className="eyebrow">A SPACE TO GROW</p>
                  <h2>{data.title}</h2>
                  <p>{data.description}</p>
                </div>
                <div className="workspace-avatar" aria-hidden="true">
                  <GraduationCap size={25} />
                </div>
              </div>
              <div className="metrics">
                {data.metrics.map((metric, i) => {
                  const Icon = [BookOpen, Layers, BriefcaseBusiness][i];
                  return (
                    <div className="metric" key={metric}>
                      <Icon size={18} />
                      <span>{metric}</span>
                      <strong>—</strong>
                      <small>Not connected yet</small>
                    </div>
                  );
                })}
              </div>
              <div className="workspace-empty">
                <div className="empty-icon">
                  <BookOpen size={25} />
                </div>
                <h3>{data.empty}</h3>
                <p>{data.detail}</p>
                <Badge>Ready for the next phase</Badge>
              </div>
              <div className="workspace-note">
                <span className="note-dot" />A calm space. A clear next step.
                Built around your progress.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
