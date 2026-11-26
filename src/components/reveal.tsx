'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '[data-reveal]',
          { y: 12 },
          {
            y: 0,
            duration: 0.65,
            stagger: 0.08,
            ease: 'power2.out',
          },
        );
      });
      return () => mm.revert();
    }, ref);
    return () => ctx.revert();
  }, []);
  return <div ref={ref}>{children}</div>;
}
