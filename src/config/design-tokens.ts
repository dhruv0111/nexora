// Mirrors the CSS custom properties in app/globals.css for typed tooling.
export const designTokens = {
  colors: {
    background: '#080816',
    surface: '#151329',
    primary: '#A855F7',
    secondary: '#FF647C',
    highlight: '#FF965C',
    foreground: '#F8F7FF',
  },
  typography: {
    display: { min: '2.25rem', max: '4rem', lineHeight: 1.08 },
    heading: { min: '1.75rem', max: '2.0625rem', lineHeight: 1.25 },
    body: { size: '1rem', lineHeight: 1.7 },
    label: { size: '.875rem', lineHeight: 1.5 },
  },
  spacing: {
    1: '.25rem',
    2: '.5rem',
    3: '.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
    24: '6rem',
  },
  radii: { sm: '.5rem', md: '.875rem', lg: '1.25rem' },
  shadows: { card: '0 12px 36px #00000024', glow: '0 4px 28px #a855f724' },
  motion: {
    fast: 160,
    base: 240,
    reveal: 650,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;
