import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  progressSummary,
  displayTime,
  pageNumber,
} from '@/lib/learning/policy';
import { validateFile } from '@/lib/learning/files';
import { httpsUrl } from '@/lib/learning/content';
describe('learning display and boundary rules', () => {
  it('counts only published lesson IDs supplied by the server', () => {
    expect(
      progressSummary(
        [
          { id: 'one', moduleId: 'm' },
          { id: 'two', moduleId: 'm' },
        ],
        new Set(['one', 'draft', 'another-course']),
      ),
    ).toEqual({ total: 2, completed: 1, percent: 50 });
    expect(progressSummary([], new Set())).toEqual({
      total: 0,
      completed: 0,
      percent: 0,
    });
  });
  it('displays timestamps in IST independent of host timezone', () => {
    expect(displayTime('2026-11-20T00:00:00Z')).toContain('5:30');
  });
  it('bounds pagination and rejects unsafe values', () => {
    expect(pageNumber('-1')).toBe(1);
    expect(pageNumber('2')).toBe(2);
    expect(pageNumber('999999')).toBe(10000);
  });
  it('validates private file names, content and size', () => {
    const bytes = new TextEncoder().encode('Evidence');
    expect(validateFile('notes.txt', 'text/plain', bytes).size).toBe(8);
    expect(() => validateFile('../notes.txt', 'text/plain', bytes)).toThrow();
    expect(() =>
      validateFile('notes.txt', 'text/plain', new Uint8Array([0])),
    ).toThrow();
    expect(() => validateFile('notes.pdf', 'application/pdf', bytes)).toThrow();
    expect(() =>
      validateFile('notes.txt', 'text/plain', new Uint8Array(2097153)),
    ).toThrow();
  });
  it('rejects unsafe external resource schemes and credentials', () => {
    expect(httpsUrl.safeParse('javascript:alert(1)').success).toBe(false);
    expect(
      httpsUrl.safeParse('https://user:password@example.com/video').success,
    ).toBe(false);
    expect(httpsUrl.safeParse('https://example.com/video').success).toBe(true);
  });
});
