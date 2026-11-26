'use client';
import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  Code2,
  GitPullRequest,
  LayoutDashboard,
  Play,
  CheckCircle2,
} from 'lucide-react';
const panels = {
  roadmap: {
    label: 'Weekly roadmap',
    eyebrow: 'WEEK 04 · EXAMPLE ROADMAP',
    title: 'Connect the pieces.',
    items: [
      'Monday · Build a typed API endpoint',
      'Wednesday · Mentor-led code review',
      'Friday · Sprint demo & reflection',
    ],
  },
  assignments: {
    label: 'Assignments',
    eyebrow: 'YOUR PRACTICE · EXAMPLE TASKS',
    title: 'Make it work. Make it yours.',
    items: [
      'In progress · Implement a search filter',
      'Ready to review · API contract tests',
      'Next up · Document what you learned',
    ],
  },
  contributions: {
    label: 'Contributions',
    eyebrow: 'HIREFLOW · EXAMPLE CONTRIBUTIONS',
    title: 'See the impact of your work.',
    items: [
      'Merged · Accessible form labels',
      'In review · Opportunity search endpoint',
      'Planned · Add edge-case test coverage',
    ],
  },
} as const;
type Panel = keyof typeof panels;
export function LearningPreview() {
  const [panel, setPanel] = useState<Panel>('roadmap');
  const current = panels[panel];
  return (
    <div className="learning-window">
      <div className="learning-top">
        <span className="learning-wordmark">
          NEXORA <span>/ LEARN</span>
        </span>
        <span className="demo-label">Illustrative demo data</span>
      </div>
      <div className="learning-app">
        <aside className="learning-sidebar" aria-hidden="true">
          <span className="learn-active">
            <LayoutDashboard size={17} />
            My overview
          </span>
          <span>
            <BookOpen size={17} />
            My learning
          </span>
          <span>
            <Code2 size={17} />
            Projects
          </span>
          <span>
            <CalendarDays size={17} />
            Schedule
          </span>
          <div className="learning-sidebar-note">
            One focused step
            <br />
            at a time.
          </div>
        </aside>
        <div className="learning-main">
          <div className="learning-greeting">
            <div>
              <p className="eyebrow">YOUR SPACE TO GROW</p>
              <h3>Keep your momentum.</h3>
              <p>Every lesson. Every commit. A little closer.</p>
            </div>
            <div className="demo-avatar" aria-hidden="true">
              N
            </div>
          </div>
          <div className="learning-content">
            <div className="learning-course">
              <p className="eyebrow">FULL-STACK DEVELOPMENT · DEMO</p>
              <h4>From interface to API.</h4>
              <p>Module 04 · Building connected applications</p>
              <div className="demo-progress-label">
                <span>Illustrative learning progress</span>
                <strong>68%</strong>
              </div>
              <div
                className="demo-progress"
                role="progressbar"
                aria-label="Illustrative learning progress"
                aria-valuenow={68}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span />
              </div>
              <span className="demo-next">
                <Play size={13} />
                Next lesson: Working with typed APIs
              </span>
            </div>
            <div className="demo-stat">
              <GitPullRequest size={23} />
              <strong>06</strong>
              <span>Example project contributions</span>
              <small>
                <CheckCircle2 size={13} />
                Reviewed with a mentor
              </small>
            </div>
          </div>
          <div className="learning-tabs" aria-label="Learning preview sections">
            {(Object.keys(panels) as Panel[]).map((key) => (
              <button
                type="button"
                key={key}
                aria-pressed={panel === key}
                onClick={() => setPanel(key)}
              >
                {panels[key].label}
              </button>
            ))}
          </div>
          <div className="roadmap-panel" aria-live="polite">
            <div>
              <p className="eyebrow">{current.eyebrow}</p>
              <h4>{current.title}</h4>
            </div>
            <ul>
              {current.items.map((item, i) => (
                <li key={item}>
                  <span className={i === 0 ? 'roadmap-check' : 'roadmap-dot'}>
                    {i === 0 && <Check size={12} />}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="learning-disclosure">
        A preview of the planned learning experience. Progress, assignments, and
        contributions above are illustrative; live learning workflows arrive in
        a later phase.
      </p>
    </div>
  );
}
