import Link from 'next/link';
import {
  Braces,
  Component,
  Contrast,
  Layers3,
  Sparkles,
  ShieldCheck,
  Zap,
  Check,
  MousePointer2,
  Command,
} from 'lucide-react';
import { Container, Section } from './layout/container';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CourseCard } from './course-card';
import { courses } from '@/config/site';
import {
  TokenCopy,
  WorkspaceShowcase,
  FormDemo,
  StateExamples,
} from './showcase-interactions';
import { Reveal } from './reveal';
const colors = [
  ['Midnight', '#080816', 'background'],
  ['Deep space', '#151329', 'surface'],
  ['Electric violet', '#A855F7', 'primary'],
  ['Sunset coral', '#FF647C', 'secondary'],
  ['Warm glow', '#FF965C', 'highlight'],
  ['Starlight', '#F8F7FF', 'foreground'],
];
function SectionHeading({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function StyleGuide() {
  return (
    <main id="main">
      <Reveal>
        <Container>
          <div className="intro-toolbar">
            <span className="foundation-label">
              <span />
              NEXORA DESIGN SYSTEM
            </span>
            <Badge>Foundation / v0.1</Badge>
          </div>
          <section className="guide-hero" aria-labelledby="hero-title">
            <div className="hero-copy" data-reveal>
              <p className="eyebrow">
                <Sparkles size={14} /> PURPOSE IN EVERY PIXEL
              </p>
              <h1 id="hero-title">
                A bold beginning.
                <br />
                <span className="gradient-text">A brighter future.</span>
              </h1>
              <p>
                The foundation for what comes next. One design language.
                <br className="desktop-break" /> Four career paths. Endless
                potential.
              </p>
              <div className="hero-actions">
                <Button asChild>
                  <Link href="#components">
                    <Component size={17} />
                    Explore the system
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="#workspace">Preview workspace</Link>
                </Button>
              </div>
              <div className="hero-meta">
                <span>
                  <Contrast size={14} />
                  Accessible by design
                </span>
                <span>
                  <Zap size={14} />
                  Built for performance
                </span>
              </div>
            </div>
            <div
              className="brand-canvas"
              aria-label="Original abstract Nexora prism illustration"
              role="img"
              data-reveal
            >
              <div className="canvas-grid" />
              <div className="canvas-halo" />
              <div className="prism prism-back" />
              <div className="prism prism-front" />
              <div className="canvas-tag tag-code">
                <Braces size={17} /> Build something real
              </div>
              <div className="canvas-tag tag-spark">
                <Sparkles size={16} /> YOUR NEXT CHAPTER
              </div>
              <span className="canvas-coordinate">N / 01 — THE FOUNDATION</span>
              <span className="canvas-star star-a">+</span>
              <span className="canvas-star star-b">+</span>
            </div>
          </section>
          <nav className="section-nav" aria-label="Design system sections">
            <a href="#principles">
              <Layers3 size={16} />
              Principles
            </a>
            <a href="#palette">
              <Contrast size={16} />
              Color & type
            </a>
            <a href="#components">
              <Component size={16} />
              Components
            </a>
            <a href="#programs">
              <Braces size={16} />
              Course cards
            </a>
            <a href="#workspace">
              <Command size={16} />
              Workspaces
            </a>
          </nav>
        </Container>
        <Section id="principles" className="principles-section">
          <Container>
            <div className="principles-grid">
              <div>
                <span className="principle-icon">
                  <Sparkles size={20} />
                </span>
                <h2>Inspire the next move.</h2>
                <p>
                  Expressive visuals for a career worth getting excited about.
                </p>
              </div>
              <div>
                <span className="principle-icon">
                  <Layers3 size={20} />
                </span>
                <h2>Create space for focus.</h2>
                <p>Quiet, intuitive workspaces that put learning first.</p>
              </div>
              <div>
                <span className="principle-icon">
                  <ShieldCheck size={20} />
                </span>
                <h2>Build with intention.</h2>
                <p>
                  Accessible foundations. Honest promises. Thoughtful details.
                </p>
              </div>
            </div>
          </Container>
        </Section>
        <Section id="palette">
          <Container>
            <SectionHeading
              label="THE VISUAL LANGUAGE"
              title="A little electric. Entirely intentional."
              description="Midnight foundations meet the energy of a new beginning."
            >
              <TokenCopy />
            </SectionHeading>
            <div className="palette-grid">
              {colors.map(([name, hex, token]) => (
                <div className="swatch" key={name}>
                  <div
                    className="swatch-color"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="swatch-detail">
                    <strong>{name}</strong>
                    <code>{hex}</code>
                    <span>--{token}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="type-grid">
              <div className="type-display">
                <p className="eyebrow">TYPE WITH CONFIDENCE</p>
                <p className="type-sample">
                  Made to
                  <br />
                  <span className="gradient-text">move you.</span>
                </p>
                <div className="type-caption">
                  System sans · Bold expression · Effortless reading
                </div>
              </div>
              <div className="type-scale">
                <div>
                  <span>Display</span>
                  <strong className="sample-display">Build your future.</strong>
                </div>
                <div>
                  <span>Heading</span>
                  <strong className="sample-heading">Your next chapter</strong>
                </div>
                <div>
                  <span>Body</span>
                  <p>
                    Real learning starts with curiosity. Make room for what you
                    could become.
                  </p>
                </div>
                <div>
                  <span>Label</span>
                  <p className="sample-label">SMALL DETAILS. BIG DIFFERENCE.</p>
                </div>
              </div>
            </div>
          </Container>
        </Section>
        <Section id="components" className="border-section">
          <Container>
            <SectionHeading
              label="THE BUILDING BLOCKS"
              title="Consistent in every interaction."
              description="Familiar patterns, clear feedback, and just the right amount of personality."
            />
            <div className="component-grid">
              <div className="component-panel">
                <div className="panel-title">
                  <h3>Actions & intent</h3>
                  <MousePointer2 size={17} />
                </div>
                <div className="button-demo">
                  <Button asChild>
                    <Link href="/programs">Explore programs</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="#workspace">View workspace</Link>
                  </Button>
                  <Button disabled>Coming soon</Button>
                </div>
                <div className="panel-divider" />
                <h3 className="small-heading">A clear status, at a glance</h3>
                <div className="badge-demo">
                  <Badge className="badge-violet">In progress</Badge>
                  <Badge className="badge-green">
                    <Check size={12} />
                    Completed
                  </Badge>
                  <Badge>Upcoming</Badge>
                  <Badge className="badge-coral">Needs attention</Badge>
                </div>
              </div>
              <div className="component-panel">
                <div className="panel-title">
                  <h3>Thoughtful form fields</h3>
                  <Braces size={17} />
                </div>
                <FormDemo />
              </div>
            </div>
            <StateExamples />
          </Container>
        </Section>
        <Section id="programs">
          <Container>
            <SectionHeading
              label="FOUR PATHS. ONE SHARED AMBITION."
              title="Built for different kinds of brilliant."
              description="A flexible course card system. Each track has a character of its own."
            >
              <Badge>Program previews</Badge>
            </SectionHeading>
            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard key={course.slug} course={course} />
              ))}
            </div>
          </Container>
        </Section>
        <Section id="workspace" className="border-section">
          <Container>
            <SectionHeading
              label="LESS NOISE. MORE MOMENTUM."
              title="Big ambitions. A focused workspace."
              description="The same foundation, with a calmer rhythm for the work that matters."
            >
              <Badge>Interactive shell previews</Badge>
            </SectionHeading>
            <WorkspaceShowcase />
            <p className="preview-caption">
              <ShieldCheck size={14} />
              Public component previews contain no account data. Live workspaces
              require sign-in and the appropriate role.
            </p>
          </Container>
        </Section>
        <Section className="foundation-bottom">
          <Container>
            <div className="foundation-banner">
              <div>
                <p className="eyebrow">THE FOUNDATION IS JUST THE BEGINNING</p>
                <h2>Ready for what comes next.</h2>
                <p>
                  A shared system for learning, building, and moving forward.
                </p>
              </div>
              <Badge>
                <Layers3 size={14} />
                Phase 1 · Foundation
              </Badge>
            </div>
          </Container>
        </Section>
      </Reveal>
    </main>
  );
}
