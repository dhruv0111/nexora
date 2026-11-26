'use client';
import { useEffect } from 'react';
export function MarketingMotion() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cleanup: (() => void) | undefined;
    let disposed = false;
    // Enhancement runs after first paint; server-rendered content is always visible.
    const start = async () => {
      if (reduced.matches) return;
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (window.matchMedia('(min-width: 1024px)').matches)
          gsap.to('.cinema-image', {
            yPercent: 4,
            ease: 'none',
            scrollTrigger: {
              trigger: '.cinema-hero',
              start: 'top top',
              end: 'bottom top',
              scrub: 0.7,
            },
          });
        gsap.utils
          .toArray<HTMLElement>('[data-cinema-reveal]')
          .forEach((el) => {
            gsap.fromTo(
              el,
              { y: 18 },
              {
                y: 0,
                duration: 0.65,
                ease: 'power2.out',
                clearProps: 'transform',
                scrollTrigger: { trigger: el, start: 'top 92%', once: true },
              },
            );
          });
      });
      cleanup = () => mm.revert();
    };
    let started = false;
    const enhance = () => {
      if (started) return;
      started = true;
      void start().catch(() => {
        /* Server-rendered content remains available. */
      });
    };
    window.addEventListener('scroll', enhance, { once: true, passive: true });
    return () => {
      disposed = true;
      window.removeEventListener('scroll', enhance);
      cleanup?.();
    };
  }, []);
  return null;
}
