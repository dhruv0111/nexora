import { describe, it, expect } from 'vitest';
import { matchReasons } from '@/lib/career/read';
import { hiringTransitions } from '@/lib/career/policy';
describe('transparent career matching and hiring states', () => {
  it('labels self-reported matches and distinguishes reviewed educational evidence', () => {
    const reasons = matchReasons(
      {
        skills: ['TypeScript'],
        locations: ['Pune'],
        workModes: ['REMOTE'],
        eligibility: 'India',
        experienceYears: 0,
      },
      {
        skills: ['typescript', 'SQL'],
        location: 'Pune',
        workMode: 'REMOTE',
        eligibility: 'India',
        minExperience: 2,
      },
      {
        graduated: true,
        assessments: 1,
        portfolios: 2,
        approvedTechnologies: ['TypeScript'],
      },
    );
    expect(reasons).toContain('Self-reported skills overlap: typescript');
    expect(reasons).toContain('Review the experience prerequisite');
    expect(reasons).toContain(
      'Mentor-reviewed training technologies match: typescript',
    );
    expect(reasons).toContain('2 publication-approved training portfolios');
    expect(reasons.join(' ')).not.toMatch(/guaranteed|rejected|employed/i);
  });
  it('keeps application terminal states terminal and requires interview before an offer', () => {
    expect(hiringTransitions.APPLIED).not.toContain('OFFERED');
    expect(hiringTransitions.INTERVIEW).toContain('OFFERED');
    for (const state of ['HIRED', 'WITHDRAWN', 'REJECTED', 'CLOSED'])
      expect(hiringTransitions[state]).toEqual([]);
  });
});
