import { courses } from './site';
export const programDetails = {
  'qa-sdet': {
    prerequisite: 'Beginner pathway',
    startingPoint: 'Basic computer literacy recommended',
    technologies: ['Playwright', 'API testing', 'TypeScript'],
    outcome: 'Engineer quality. Ship with confidence.',
  },
  'full-stack': {
    prerequisite: 'Beginner pathway',
    startingPoint: 'Basic computer literacy recommended',
    technologies: ['React', 'Node.js', 'PostgreSQL'],
    outcome: 'Build the interface. Power the experience.',
  },
  'ai-engineering': {
    prerequisite: 'Python foundations recommended',
    startingPoint: 'Comfort with Python fundamentals recommended',
    technologies: ['Python', 'LLMs', 'Evaluation'],
    outcome: 'Turn intelligent ideas into useful products.',
  },
  'data-analytics': {
    prerequisite: 'Beginner pathway',
    startingPoint: 'Comfort with spreadsheets recommended',
    technologies: ['SQL', 'Python', 'Dashboards'],
    outcome: 'Find the signal. Make better decisions.',
  },
} as const;
export const marketingCourses = courses.map((course) => ({
  ...course,
  ...programDetails[course.slug],
}));
export const faqs = [
  [
    'Can nontechnical graduates join?',
    'The beginner pathways are designed with career-switchers in mind. Your starting point matters: AI Engineering recommends Python foundations. Ask us to review your background before choosing a track. Final entry requirements will be shared before enrollment.',
  ],
  [
    'How are classes delivered?',
    'The learning model is live, mentor-led technical training with structured practice and reviews. Cohort schedules, delivery arrangements, and session recordings will be confirmed before you enroll.',
  ],
  [
    'What projects will students work on?',
    'HireFlow is a supervised collaborative learning project: developers build features, QA engineers test them, AI engineers explore intelligent capabilities, and analysts measure outcomes. It is a portfolio learning experience, not formal employment.',
  ],
  [
    'Is an internship guaranteed?',
    'No. Supervised learning projects are not formal internships or employment. Any future internship opportunity would have its own selection process and separate written terms.',
  ],
  [
    'Do you guarantee job placement?',
    'No. Nexora offers interview preparation and placement assistance. Jobs, salaries, employer introductions, and hiring outcomes are never guaranteed. Your progress, applications, and employers’ decisions all matter.',
  ],
  [
    'How do payments work?',
    'This website does not currently accept payments. Verified fees, payment options, enrollment terms, and refund conditions must be provided in writing before you decide to enroll. An inquiry creates no payment obligation.',
  ],
  [
    'What support is available after graduation?',
    'The career-support plan includes resume and LinkedIn preparation, mock interviews, portfolio reviews, and application guidance. The availability and duration of post-program support will be confirmed in your enrollment terms.',
  ],
] as const;
