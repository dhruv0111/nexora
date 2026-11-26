export const site = {
  name: 'Nexora',
  description: 'Learn with purpose. Build what comes next.',
  phase: 'Phase 1 · Foundation',
} as const;
export const courses = [
  {
    slug: 'qa-sdet',
    name: 'QA / SDET',
    category: 'QUALITY ENGINEERING',
    description:
      'Build confidence in every release. Explore quality engineering and test automation.',
    tags: ['Automation', 'API testing', 'CI/CD'],
    icon: 'shield',
    accent: 'violet',
  },
  {
    slug: 'full-stack',
    name: 'Full-Stack Development',
    category: 'SOFTWARE DEVELOPMENT',
    description:
      'Connect beautiful interfaces to powerful systems. Build across the entire stack.',
    tags: ['React', 'Node.js', 'Databases'],
    icon: 'code',
    accent: 'coral',
  },
  {
    slug: 'ai-engineering',
    name: 'AI Engineering',
    category: 'APPLIED ARTIFICIAL INTELLIGENCE',
    description:
      'Turn intelligent ideas into real applications. Learn to build, evaluate, and deploy.',
    tags: ['Python', 'LLMs', 'MLOps'],
    icon: 'cpu',
    accent: 'pink',
  },
  {
    slug: 'data-analytics',
    name: 'Data Analytics',
    category: 'DATA & INSIGHTS',
    description:
      'Find the story behind the numbers. Transform raw data into clear decisions.',
    tags: ['SQL', 'Python', 'Visualization'],
    icon: 'chart',
    accent: 'blue',
  },
] as const;
export type CoursePreview = (typeof courses)[number];
