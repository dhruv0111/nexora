import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  RubricInput,
  ScoreInput,
  QuestionsInput,
} from '@/components/learning/structured-fields';
describe('accessible mentor authoring controls', () => {
  it('serializes editable rubric criteria without requiring JSON entry', () => {
    const { container } = render(
      <RubricInput
        name="rubric"
        value={'[{"criterion":"Reasoning","points":100}]'}
      />,
    );
    fireEvent.change(screen.getByLabelText('Criterion 1'), {
      target: { value: 'Test evidence' },
    });
    fireEvent.change(screen.getByLabelText('Maximum points'), {
      target: { value: '80' },
    });
    expect(
      JSON.parse(
        (container.querySelector('input[type=hidden]') as HTMLInputElement)
          .value,
      ),
    ).toEqual([{ criterion: 'Test evidence', points: 80 }]);
  });
  it('uses labeled bounded grading inputs', () => {
    const { container } = render(
      <ScoreInput
        name="scores"
        value="[0]"
        options={[{ label: 'Reasoning', value: '100' }]}
      />,
    );
    const field = screen.getByLabelText('Reasoning · out of 100');
    expect(field).toHaveAttribute('max', '100');
    fireEvent.change(field, { target: { value: '85' } });
    expect(
      (container.querySelector('input[type=hidden]') as HTMLInputElement).value,
    ).toBe('[85]');
  });
  it('creates questions with explicit answer choices', () => {
    const { container } = render(
      <QuestionsInput
        name="questions"
        value={
          '[{"prompt":"An initial question","options":["Yes","No"],"correctIndex":0}]'
        }
      />,
    );
    fireEvent.change(screen.getByLabelText('Correct answer'), {
      target: { value: '1' },
    });
    expect(
      JSON.parse(
        (container.querySelector('input[type=hidden]') as HTMLInputElement)
          .value,
      )[0].correctIndex,
    ).toBe(1);
  });
});
