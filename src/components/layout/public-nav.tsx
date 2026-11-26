'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from './brand';
import { Button } from '@/components/ui/button';
import {
  Menu,
  ChevronDown,
  Code2,
  ShieldCheck,
  Cpu,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import { courses } from '@/config/site';
const icons = [ShieldCheck, Code2, Cpu, ChartNoAxesColumnIncreasing];
export function PublicNav() {
  const header = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        header.current?.querySelectorAll('details[open]').forEach((el) => {
          el.removeAttribute('open');
          (el.querySelector('summary') as HTMLElement)?.focus();
        });
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node))
        header.current
          ?.querySelectorAll('details[open]')
          .forEach((el) => el.removeAttribute('open'));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outside);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  const close = () =>
    header.current
      ?.querySelectorAll('details[open]')
      .forEach((el) => el.removeAttribute('open'));
  return (
    <header
      ref={header}
      className={`public-header cinema-nav ${scrolled ? 'is-scrolled' : ''}`}
    >
      <div className="container nav-inner">
        <div className="brand-lockup">
          <Brand />
          <span className="brand-descriptor">
            TECH CAREER
            <br />
            TRANSITION ACADEMY
          </span>
        </div>
        <nav className="desktop-nav" aria-label="Main navigation">
          <details className="program-dropdown">
            <summary>
              Programs
              <ChevronDown size={14} />
            </summary>
            <div className="program-menu">
              {courses.map((course, i) => {
                const Icon = icons[i];
                return (
                  <Link
                    onClick={close}
                    key={course.slug}
                    href={`/programs/${course.slug}`}
                  >
                    <Icon size={20} />
                    <span>
                      {course.name}
                      <small>Explore your path</small>
                    </span>
                  </Link>
                );
              })}
              <Link className="all-programs" href="/#programs" onClick={close}>
                Compare all programs
              </Link>
            </div>
          </details>
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#projects">Real Projects</Link>
          <Link href="/#career-support">Career Support</Link>
        </nav>
        <div className="nav-actions">
          <Button asChild variant="ghost" className="desktop-signin">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link
              href="/#programs"
              data-track="cta_click"
              data-location="navigation"
            >
              <span className="desktop-cta">Explore Programs</span>
              <span className="mobile-cta">Programs</span>
            </Link>
          </Button>
          <details className="mobile-menu">
            <summary aria-label="Open navigation">
              <Menu size={22} />
            </summary>
            <nav aria-label="Mobile navigation" onClick={close}>
              <Link href="/#programs">Programs</Link>
              <Link href="/#how-it-works">How It Works</Link>
              <Link href="/#projects">Real Projects</Link>
              <Link href="/#career-support">Career Support</Link>
              <Link href="/sign-in">Sign in</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
