'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function QuizForm({
  enrollmentId,
  assessmentId,
  version,
  questions,
}: {
  enrollmentId: string;
  assessmentId: string;
  version: number;
  questions: { prompt: string; options: string[] }[];
}) {
  const router = useRouter(),
    [key, setKey] = useState(''),
    [pending, setPending] = useState(false),
    [result, setResult] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="learn-quiz learn-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        const form = new FormData(e.currentTarget),
          requestKey = key || crypto.randomUUID();
        setKey(requestKey);
        try {
          const r = await fetch('/api/learning/attempt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                enrollmentId,
                assessmentId,
                version,
                requestKey,
                answers: questions.map((_, i) =>
                  Number(form.get(`answer-${i}`)),
                ),
              }),
            }),
            b = await r.json();
          if (!r.ok) throw Error(b.error);
          setResult(
            `Score: ${b.score} / ${questions.length}. ${b.passed ? 'Passed.' : 'Keep practicing.'}`,
          );
          setKey('');
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to submit.');
        } finally {
          setPending(false);
        }
      }}
    >
      {questions.map((q, i) => (
        <fieldset key={i}>
          <legend>
            {i + 1}. {q.prompt}
          </legend>
          {q.options.map((o, j) => (
            <label key={j}>
              <input name={`answer-${i}`} type="radio" value={j} required />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      <button className="button button-primary" disabled={pending}>
        {pending ? 'Scoring…' : 'Submit assessment'}
      </button>
      {result && <p role="status">{result}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
