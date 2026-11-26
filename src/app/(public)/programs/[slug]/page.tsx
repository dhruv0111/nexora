import '@/styles/courses.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  MonitorPlay,
  ShieldCheck,
  Check,
  BookOpen,
  ChevronDown,
  GraduationCap,
} from 'lucide-react';
import { Container } from '@/components/layout/container';
import { CourseArtwork } from '@/components/courses/artwork';
import { courseBySlug, money } from '@/lib/catalog/read';
export const dynamic = 'force-dynamic';
export default async function Course({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const course = await courseBySlug((await params).slug);
  if (!course) notFound();
  return (
    <main id="main" className="course-detail">
      <Container>
        <nav className="course-breadcrumb" aria-label="Breadcrumb">
          <Link href="/programs">All programs</Link>
          <span>/</span>
          <span>{course.title}</span>
        </nav>
        <section className="course-hero">
          <div>
            <p className="eyebrow">A NEW DIRECTION. A SOLID FOUNDATION.</p>
            <div className="course-hero-flags">
              <span>
                {course.verified
                  ? 'Approved curriculum'
                  : 'Illustrative curriculum · approval pending'}
              </span>
              <span>
                {course.assessmentRequired
                  ? 'Prerequisite assessment required'
                  : 'Beginner pathway'}
              </span>
            </div>
            <h1>
              {course.title}
              <span className="gradient-text">Build a new perspective.</span>
            </h1>
            <p>{course.description}</p>
            <div className="course-hero-facts">
              <span>
                <CalendarDays size={17} />
                {course.durationWeeks} weeks
                {!course.verified ? ' · proposed' : ''}
              </span>
              <span>
                <MonitorPlay size={17} />
                {course.deliveryFormat}
              </span>
              <span>
                <GraduationCap size={17} />
                Supervised project learning
              </span>
            </div>
            <div className="course-hero-actions">
              <Link
                className="button button-primary"
                href={`/apply/${course.slug}`}
              >
                Start Application
              </Link>
              <Link
                className="button button-secondary"
                href={`/interest?program=${course.slug}`}
              >
                Ask a question
              </Link>
            </div>
          </div>
          <CourseArtwork track={course.track} large />
        </section>
        <div className="course-content-layout">
          <div className="course-main-content">
            {!course.verified && (
              <div className="catalog-notice">
                This is a planning preview, not an approved course offer.
                Curriculum, prerequisites, fees, and dates remain subject to
                review. An application does not enroll you or create a payment
                obligation.
              </div>
            )}
            <nav className="syllabus-nav" aria-label="Course sections">
              <a href="#overview">Overview</a>
              <a href="#curriculum">Curriculum</a>
              <a href="#projects">Projects</a>
              <a href="#cohorts">Cohorts & fees</a>
              <a href="#course-faq">FAQs</a>
            </nav>
            <section id="overview" className="course-section">
              <p className="eyebrow">A PATH WITH YOU IN MIND</p>
              <h2>Who this program is for.</h2>
              <ul className="course-check-list">
                {course.audience.map((t) => (
                  <li key={t}>
                    <Check size={16} />
                    {t}
                  </li>
                ))}
              </ul>
              <h3>What to bring.</h3>
              <ul className="course-check-list">
                {course.prerequisites.map((t) => (
                  <li key={t}>
                    <ShieldCheck size={16} />
                    {t}
                  </li>
                ))}
              </ul>
              {course.assessmentRequired && (
                <div className="assessment-notice">
                  <strong>
                    AI Engineering has additional entry requirements.
                  </strong>
                  <p>
                    Be ready to work with Python, basic algebra, and APIs. The
                    application includes three technical readiness questions. A
                    human reviewer must pass the prerequisite assessment before
                    admissions can approve you. These requirements remain draft
                    until their source is approved.
                  </p>
                </div>
              )}
              <h3>Skills you’ll work toward.</h3>
              <ul className="course-check-list">
                {course.skills.map((t) => (
                  <li key={t}>
                    <Check size={16} />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="course-tools">
                {course.technologies.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </section>
            <section id="curriculum" className="course-section">
              <div className="course-section-heading">
                <div>
                  <p className="eyebrow">
                    FOUNDATIONS FIRST. CONTRIBUTIONS NEXT.
                  </p>
                  <h2>A structured {course.durationWeeks}-week journey.</h2>
                </div>
                <span>
                  {course.verified
                    ? `Content v${course.contentVersion}`
                    : 'Illustrative 24-week outline'}
                </span>
              </div>
              <div className="curriculum-list">
                {course.modules.map((module, i) => (
                  <details key={module.startWeek} open={i === 0}>
                    <summary>
                      <span className="module-icon">
                        <BookOpen size={19} />
                      </span>
                      <span>
                        <small>
                          WEEKS {module.startWeek}–
                          {module.startWeek + module.weeklyTopics.length - 1}
                        </small>
                        <strong>{module.title}</strong>
                      </span>
                      <ChevronDown size={18} />
                    </summary>
                    <div className="curriculum-body">
                      <p>{module.summary}</p>
                      <ol>
                        {module.weeklyTopics.map((topic, j) => (
                          <li key={topic}>
                            <span>Week {module.startWeek + j}</span>
                            <p>{topic}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                ))}
              </div>
            </section>
            <section id="projects" className="course-section">
              <p className="eyebrow">LEARNING THAT BECOMES SOMETHING</p>
              <h2>Build with a team. Explain your work.</h2>
              <p>
                HireFlow is the proposed supervised product-learning project.
                Developers build application features, QA engineers verify
                flows, AI engineers evaluate intelligent features, and analysts
                investigate outcomes.
              </p>
              <div className="course-support-grid">
                <div>
                  <h3>Mentor guidance</h3>
                  <p>
                    Structured reviews, feedback on your decisions, and time to
                    work through difficult problems. Mentor assignments are
                    confirmed with the cohort.
                  </p>
                </div>
                <div>
                  <h3>Career preparation</h3>
                  <p>
                    Portfolio reviews, technical interview practice, and honest
                    resume/application guidance. No jobs, salaries, or
                    internships are guaranteed.
                  </p>
                </div>
              </div>
              <div className="catalog-notice">
                Supervised projects are educational experiences. They are not
                formal internships, employment, or fabricated professional work
                experience.
              </div>
              {course.instructors.length > 0 && (
                <div>
                  <h3>Course instructors</h3>
                  {course.instructors.map((i) => (
                    <div key={i.name} className="instructor-line">
                      <GraduationCap size={20} />
                      <span>
                        {i.name}
                        <small>{i.expertise.join(' · ')}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section id="cohorts" className="course-section">
              <p className="eyebrow">THE DETAILS BEFORE YOU DECIDE</p>
              <h2>Cohorts, fees, and commitments.</h2>
              {course.cohorts.length ? (
                course.cohorts.map((c) => (
                  <article className="cohort-line" key={c.id}>
                    <h3>{c.name}</h3>
                    <p>
                      {c.startsAt
                        ? new Date(c.startsAt).toLocaleDateString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'long',
                          })
                        : 'Start date unannounced'}{' '}
                      ·{' '}
                      {c.admissionsOpen
                        ? 'Applications open'
                        : 'Admissions closed'}
                    </p>
                    <p>
                      {c.capacity === null
                        ? 'Capacity not confirmed'
                        : `${Math.max(0, c.capacity - c.occupied)} seats currently available`}
                    </p>
                  </article>
                ))
              ) : (
                <p>
                  No approved cohort schedule is published yet. Ask admissions
                  for confirmed dates and weekly availability before making a
                  commitment.
                </p>
              )}
              <dl className="course-fee-list">
                <div>
                  <dt>Approved program fee</dt>
                  <dd>
                    {course.priceApproved
                      ? money(course.priceMinor, course.currency)
                      : 'Awaiting approval'}
                  </dd>
                </div>
                <div>
                  <dt>Payment options</dt>
                  <dd>
                    One-time sandbox checkout only when configured and eligible.
                    Installments and financing are disabled.
                  </dd>
                </div>
                <div>
                  <dt>Enrollment and refund terms</dt>
                  <dd>
                    {course.termsApproved
                      ? `Approved version ${course.termsVersion}`
                      : 'Awaiting approved legal content. Payment is blocked.'}
                  </dd>
                </div>
              </dl>
              {course.termsApproved && (
                <details className="terms-disclosure">
                  <summary>Read enrollment and refund terms</summary>
                  <h3>Enrollment terms · {course.termsVersion}</h3>
                  <p>{course.enrollmentTerms}</p>
                  <h3>Refund disclosure</h3>
                  <p>{course.refundPolicy}</p>
                </details>
              )}
            </section>
            <section id="course-faq" className="course-section">
              <h2>A few important answers.</h2>
              {[
                [
                  'Does applying reserve a place?',
                  'No. Admissions approval, an available published cohort, approved fees and terms, and verified payment are separate requirements.',
                ],
                [
                  'Is this a guaranteed internship or job?',
                  'No. The program describes supervised educational projects and career preparation, not employment or a placement guarantee.',
                ],
                [
                  'Can I pay now?',
                  'Checkout remains disabled without approved fees, enrollment/refund terms, admissions acceptance, and genuine Razorpay test configuration. Production payment activation is a later approval step.',
                ],
              ].map(([q, a]) => (
                <details className="course-faq" key={q}>
                  <summary>
                    {q}
                    <ChevronDown size={16} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </section>
          </div>
          <aside className="course-enroll-panel">
            <span className="eyebrow">YOUR NEXT CHAPTER</span>
            <h2>
              Make an informed
              <br />
              next move.
            </h2>
            <p className="course-fee">
              {course.priceApproved
                ? money(course.priceMinor, course.currency)
                : 'Fee awaiting approval'}
            </p>
            <span className="course-panel-status">
              {course.verified
                ? 'Approved course content'
                : 'Planning preview · not yet an approved offer'}
            </span>
            <Link
              className="button button-primary"
              href={`/apply/${course.slug}`}
            >
              Start Application
            </Link>
            <Link
              className="button button-secondary"
              href={`/interest?program=${course.slug}`}
            >
              Talk to admissions
            </Link>
            <ul>
              <li>
                <Check size={14} />
                Save and resume your application.
              </li>
              <li>
                <Check size={14} />
                Admission is reviewed by a person.
              </li>
              <li>
                <Check size={14} />
                Review fees and terms before payment.
              </li>
            </ul>
            <p className="course-panel-note">
              <ShieldCheck size={15} />
              No automatic enrollment or payment obligation.
            </p>
          </aside>
        </div>
      </Container>
    </main>
  );
}
