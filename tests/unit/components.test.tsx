import Link from 'next/link';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/course-card';
import { FormDemo, TokenCopy } from '@/components/showcase-interactions';
import { courses } from '@/config/site';
describe('core components', () => {
  it('supports a semantic link and a disabled action', () => {
    render(
      <>
        <Button asChild>
          <Link href="/programs">Programs</Link>
        </Button>
        <Button disabled>Unavailable</Button>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'href',
      '/programs',
    );
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
  });
  it('provides descriptive program links', () => {
    render(<CourseCard course={courses[0]} />);
    expect(screen.getByRole('link', { name: 'QA / SDET' })).toHaveAttribute(
      'href',
      '/programs/qa-sdet',
    );
    expect(screen.getByText('Automation')).toBeInTheDocument();
  });
  it('labels the field and announces local validation', () => {
    render(<FormDemo />);
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: 'learner@example.com' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Validate example' }).closest('form')!,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Valid email format');
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: '' },
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('copies the actual CSS palette', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<TokenCopy />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('--background: #080816'),
    );
  });
});
