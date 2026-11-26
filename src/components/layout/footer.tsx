import Link from 'next/link';
import { Brand } from './brand';
import { courses } from '@/config/site';
export function Footer() {
  return (
    <footer className="footer cinema-footer">
      <div className="container footer-columns">
        <div className="footer-brand">
          <Brand />
          <p>
            A new direction. Real skills.
            <br />A future you help build.
          </p>
          <span>Tech career transition academy</span>
        </div>
        <div>
          <h2>Find your path</h2>
          {courses.map((course) => (
            <Link href={`/programs/${course.slug}`} key={course.slug}>
              {course.name}
            </Link>
          ))}
        </div>
        <div>
          <h2>Get to know Nexora</h2>
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#projects">Real Projects</Link>
          <Link href="/#career-support">Career Support</Link>
          <Link href="/interest?intent=career_call">Contact the team</Link>
        </div>
        <div>
          <h2>The details</h2>
          <Link href="/policies/privacy">Privacy Policy</Link>
          <Link href="/policies/terms">Terms</Link>
          <Link href="/policies/refund">Refund Policy</Link>
          <Link href="/style-guide">Design system</Link>
        </div>
      </div>
      <div className="container placement-note">
        <strong>Real preparation. Honest possibilities.</strong>
        <p>
          Supervised learning projects are not formal employment or internships.
          Placement assistance and employer introductions, where available, do
          not guarantee interviews, jobs, or salaries.
        </p>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Nexora. Build what comes next.</span>
        <span>Made for your next chapter.</span>
      </div>
    </footer>
  );
}
