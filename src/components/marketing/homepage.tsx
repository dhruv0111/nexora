import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  Code2,
  Rocket,
  ShieldCheck,
  GitPullRequest,
  Route,
  FolderCode,
  MessagesSquare,
  BriefcaseBusiness,
  FileCheck2,
  Check,
  CircleCheck,
  ChartNoAxesColumnIncreasing,
  Cpu,
  ChevronDown,
  CalendarDays,
  Layers3,
} from 'lucide-react';
import { Container } from '@/components/layout/container';
import { marketingCourses, faqs } from '@/config/marketing';
import { CtaLink } from './cta-link';
import { ProgramCard } from './program-card';
import { ProjectShowcase } from './project-showcase';
import { LearningPreview } from './learning-preview';
import { InquiryForm } from './inquiry-form';
import { MarketingMotion } from './motion';
const benefits = [
  [
    BookOpen,
    'Live expert-led training',
    'Ask questions, work through problems, and learn with a mentor in the room.',
  ],
  [
    Route,
    'A roadmap with a purpose',
    'Build foundations first, then connect them through progressively deeper work.',
  ],
  [
    Code2,
    'Real project contributions',
    'Work on supervised product tasks with shared standards and clear feedback.',
  ],
  [
    GitPullRequest,
    'Mentor code reviews',
    'Understand the why behind the feedback, not just what needs changing.',
  ],
  [
    FolderCode,
    'A portfolio you can explain',
    'Show your decisions, your contributions, and how you approach a problem.',
  ],
  [
    MessagesSquare,
    'Support for the next step',
    'Practice interviews and learn to tell the story of what you can do.',
  ],
] as const;
const disciplines = [
  [Code2, 'Developers', 'Build the application.'],
  [ShieldCheck, 'QA engineers', 'Verify every flow.'],
  [Cpu, 'AI engineers', 'Add intelligent features.'],
  [ChartNoAxesColumnIncreasing, 'Data analysts', 'Measure what matters.'],
] as const;
export function Homepage() {
  return (
    <main id="main" className="marketing">
      <MarketingMotion />
      <section className="cinema-hero" aria-labelledby="cinema-title">
        <div className="cinema-image">
          <Image
            src="/images/nexora-hero.webp"
            alt=""
            fill
            sizes="100vw"
            preload
            fetchPriority="high"
            quality={85}
            decoding="sync"
            className="hero-art"
          />
        </div>
        <div className="hero-shade" />
        <div className="hero-atmosphere" aria-hidden="true" />
        <Container>
          <div className="cinema-copy">
            <p className="cinema-eyebrow">
              <span />
              LIVE TRAINING. REAL PROJECTS. NEW POSSIBILITIES.
            </p>
            <h1 id="cinema-title" className="cinema-headline">
              <span className="headline-line">DON’T JUST</span>
              <span className="headline-line">LEARN TECH.</span>
              <span className="headline-line headline-gradient">
                BUILD YOUR
              </span>
              <span className="headline-line headline-gradient">FUTURE.</span>
            </h1>
            <p className="cinema-subtitle">
              Learn industry-ready skills, contribute to supervised real-world
              projects, and prepare for your next career opportunity.
            </p>
            <div className="cinema-actions">
              <CtaLink location="hero" />
              <CtaLink
                secondary
                href="/interest?intent=career_call"
                location="hero_call"
              >
                <CalendarDays size={17} />
                Book a Free Career Call
              </CtaLink>
            </div>
            <p className="hero-reassurance">
              <ShieldCheck size={14} />
              Built for career-switchers. Grounded in real learning.
            </p>
          </div>
          <div className="hero-scene-caption">
            <span>LEARN SOMETHING REAL.</span>
            <strong>Become someone new.</strong>
          </div>
        </Container>
        <div className="hero-bottom-line" />
      </section>
      <section id="programs" className="career-paths marketing-section">
        <Container>
          <div className="marketing-section-top">
            <div>
              <p className="eyebrow">FOUR PATHS. ONE BOLD NEXT STEP.</p>
              <h2>
                Find your kind of <span className="gradient-text">future.</span>
              </h2>
            </div>
            <p>
              Start with curiosity.
              <br />
              Build toward a career in tech.
            </p>
          </div>
          <div className="path-grid">
            {marketingCourses.map((course) => (
              <ProgramCard course={course} key={course.slug} />
            ))}
          </div>
          <p className="program-disclosure">
            Program previews. Final schedules, entry requirements, and fees are
            confirmed before enrollment.
          </p>
        </Container>
      </section>
      <section id="how-it-works" className="journey-section marketing-section">
        <Container>
          <div className="centered-heading">
            <p className="eyebrow">
              KNOWLEDGE IS THE START. DOING CHANGES EVERYTHING.
            </p>
            <h2>
              From “what if” to{' '}
              <span className="gradient-text">what’s next.</span>
            </h2>
            <p>
              A connected path from learning the fundamentals to showing what
              you can do.
            </p>
          </div>
          <div className="journey-track">
            {[
              [
                BookOpen,
                'LEARN',
                'Build your foundation.',
                'Live, mentor-led technical training. A structured roadmap. Space to ask, practice, and understand.',
              ],
              [
                Code2,
                'BUILD',
                'Put your skills to work.',
                'Contribute to supervised software products. Collaborate across disciplines. Learn through thoughtful reviews.',
              ],
              [
                Rocket,
                'LAUNCH',
                'Take the next step.',
                'Prepare your portfolio, practice technical interviews, and get guidance for your job search.',
              ],
            ].map(([Icon, label, title, description]) => {
              const I = Icon as typeof BookOpen;
              return (
                <article
                  className="journey-step"
                  data-cinema-reveal
                  key={String(label)}
                >
                  <span className="journey-icon">
                    <I size={29} strokeWidth={1.5} />
                  </span>
                  <p className="eyebrow">{String(label)}</p>
                  <h3>{String(title)}</h3>
                  <p>{String(description)}</p>
                </article>
              );
            })}
          </div>
          <p className="journey-note">
            <CircleCheck size={14} />
            Learn with support. Build with purpose. Progress at every step.
          </p>
        </Container>
      </section>
      <section id="projects" className="projects-section marketing-section">
        <Container>
          <div className="marketing-section-top">
            <div>
              <p className="eyebrow">LESS TUTORIAL. MORE TEAMWORK.</p>
              <h2>
                One real product.
                <br />
                <span className="gradient-text">
                  Four ways to make an impact.
                </span>
              </h2>
            </div>
            <div>
              <p>
                Meet <strong>HireFlow.</strong> A collaborative learning project
                <br className="desktop-break" /> where different skills build
                something together.
              </p>
              <span className="section-pill">
                <Layers3 size={13} />
                Supervised learning · Portfolio project
              </span>
            </div>
          </div>
          <ProjectShowcase />
          <div className="discipline-strip">
            {disciplines.map(([Icon, title, text]) => (
              <div key={title}>
                <Icon size={23} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="project-disclosure">
            <ShieldCheck size={14} />
            HireFlow is a supervised educational project, not a formal
            internship, employment, or a claim of professional work experience.
          </p>
        </Container>
      </section>
      <section id="why-nexora" className="why-section marketing-section">
        <Container>
          <div className="centered-heading">
            <p className="eyebrow">BUILT AROUND HOW PEOPLE ACTUALLY GROW</p>
            <h2>
              More than lessons.
              <br />
              <span className="gradient-text">A better way forward.</span>
            </h2>
          </div>
          <div className="benefit-grid">
            {benefits.map(([Icon, title, text]) => (
              <article key={title} className="benefit-card" data-cinema-reveal>
                <span>
                  <Icon size={24} strokeWidth={1.5} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <section
        id="course-discovery"
        className="discovery-section marketing-section"
      >
        <Container>
          <div className="marketing-section-top">
            <div>
              <p className="eyebrow">A DIRECTION THAT FITS YOU</p>
              <h2>
                Your curiosity.
                <br />
                <span className="gradient-text">Your starting point.</span>
              </h2>
            </div>
            <p>
              Compare the paths. Ask the questions.
              <br />
              Make an informed next move.
            </p>
          </div>
          <div className="course-comparison">
            {marketingCourses.map((course) => (
              <article className="discovery-row" key={course.slug}>
                <div>
                  <p className="eyebrow">{course.category}</p>
                  <h3>{course.name}</h3>
                </div>
                <dl>
                  <div>
                    <dt>Duration</dt>
                    <dd>To be confirmed</dd>
                  </div>
                  <div>
                    <dt>Suggested starting point</dt>
                    <dd>{course.startingPoint}</dd>
                  </div>
                </dl>
                <div className="discovery-tech">
                  {course.technologies.map((tech) => (
                    <span key={tech}>{tech}</span>
                  ))}
                </div>
                <Link
                  href={`/programs/${course.slug}`}
                  className="button button-secondary"
                  data-track="cta_click"
                  data-location={`discovery_${course.slug}`}
                >
                  Explore Course
                </Link>
              </article>
            ))}
          </div>
          <p className="program-disclosure">
            No published pricing yet. Request verified curriculum, cohort dates,
            and fees before you decide.
          </p>
        </Container>
      </section>
      <section
        id="learning-experience"
        className="learning-section marketing-section"
      >
        <Container>
          <div className="centered-heading">
            <p className="eyebrow">BIG AMBITIONS. A CLEAR NEXT STEP.</p>
            <h2>
              A little less noise.
              <br />
              <span className="gradient-text">A lot more momentum.</span>
            </h2>
            <p>
              A focused learning space that brings your roadmap, practice, and
              progress together.
            </p>
          </div>
          <LearningPreview />
        </Container>
      </section>
      <section id="career-support" className="career-section marketing-section">
        <Container>
          <div className="career-layout">
            <div className="career-copy">
              <p className="eyebrow">YOUR WORK DESERVES TO BE SEEN</p>
              <h2>
                Build the skills.
                <br />
                <span className="gradient-text">Own your story.</span>
              </h2>
              <p>
                Learning is one part of the transition. We help you prepare to
                show your work and approach your next opportunity with clarity.
              </p>
              <CtaLink
                secondary
                href="/interest?intent=career_call"
                location="career_support"
              >
                Let’s talk about your next step
              </CtaLink>
              <div className="honest-promise">
                <ShieldCheck size={19} />
                <p>
                  <strong>Preparation, not promises.</strong> No guaranteed
                  placements, salaries, or internships. Employer introductions
                  depend on available opportunities and suitability.
                </p>
              </div>
            </div>
            <div className="career-support-list">
              {[
                [
                  FileCheck2,
                  'Resume & LinkedIn preparation',
                  'Translate your learning and project work into a clear, honest profile.',
                ],
                [
                  MessagesSquare,
                  'Technical mock interviews',
                  'Practice explaining your thinking, solving problems, and receiving feedback.',
                ],
                [
                  FolderCode,
                  'Portfolio reviews',
                  'Tell the story behind your contributions and the decisions you made.',
                ],
                [
                  BriefcaseBusiness,
                  'Employer introductions',
                  'Guidance and introductions where appropriate opportunities are available.',
                ],
                [
                  Route,
                  'Application tracking',
                  'Build an organized, consistent approach to your search.',
                ],
              ].map(([Icon, title, copy]) => {
                const I = Icon as typeof BookOpen;
                return (
                  <div key={String(title)}>
                    <span>
                      <I size={21} />
                    </span>
                    <div>
                      <h3>{String(title)}</h3>
                      <p>{String(copy)}</p>
                    </div>
                    <Check size={15} />
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>
      <section id="faq" className="faq-section marketing-section">
        <Container>
          <div className="faq-layout">
            <div>
              <p className="eyebrow">GOOD QUESTIONS. STRAIGHT ANSWERS.</p>
              <h2>
                Let’s clear
                <br />
                <span className="gradient-text">things up.</span>
              </h2>
              <p>
                Choosing a new direction is a big decision.
                <br />
                You deserve the details.
              </p>
              <Link href="/interest?intent=career_call" className="faq-contact">
                Still have a question? Talk to us.
              </Link>
            </div>
            <div className="faq-list">
              {faqs.map(([question, answer]) => (
                <details key={question} className="faq-item">
                  <summary>
                    {question}
                    <ChevronDown size={18} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>
      <section className="closing-section">
        <Container>
          <div className="closing-orbit" aria-hidden="true" />
          <p className="eyebrow">
            YOUR FUTURE ISN’T A TEMPLATE. NEITHER IS YOUR JOURNEY.
          </p>
          <h2>
            YOUR NEXT CHAPTER
            <br />
            <span className="gradient-text">STARTS HERE.</span>
          </h2>
          <p>You bring the ambition. Let’s find your way forward.</p>
          <div className="cinema-actions">
            <CtaLink location="closing" />
            <CtaLink
              secondary
              href="/interest?intent=career_call"
              location="closing_call"
            >
              <CalendarDays size={17} />
              Book a Free Career Call
            </CtaLink>
          </div>
        </Container>
      </section>
      <section id="inquiry" className="inquiry-section marketing-section">
        <Container>
          <div className="inquiry-layout">
            <div>
              <p className="eyebrow">
                ONE CONVERSATION CAN CHANGE YOUR DIRECTION
              </p>
              <h2>
                Tell us where
                <br />
                you want to <span className="gradient-text">go.</span>
              </h2>
              <p>
                Explore a program or request a free career conversation. Share
                your goals and let the team review the right next step with you.
              </p>
              <ul className="inquiry-points">
                <li>
                  <Check size={16} />
                  Find a path that fits your starting point.
                </li>
                <li>
                  <Check size={16} />
                  Ask about curriculum, timelines, and fees.
                </li>
                <li>
                  <Check size={16} />
                  Decide with clarity, without pressure.
                </li>
              </ul>
            </div>
            <div className="inquiry-card">
              <InquiryForm />
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
