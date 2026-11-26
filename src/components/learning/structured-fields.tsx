'use client';
import { useState } from 'react';
type Criterion = { criterion: string; points: number };
type Question = { prompt: string; options: string[]; correctIndex: number };
export function RubricInput({ name, value }: { name: string; value: string }) {
  const [rows, setRows] = useState<Criterion[]>(() => JSON.parse(value));
  return (
    <div className="learn-builder">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div className="learn-builder-row" key={i}>
          <label>
            Criterion {i + 1}
            <input
              value={r.criterion}
              required
              minLength={3}
              maxLength={160}
              onChange={(e) =>
                setRows(
                  rows.map((x, j) =>
                    j === i ? { ...x, criterion: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label>
            Maximum points
            <input
              type="number"
              min={1}
              max={100}
              required
              value={r.points}
              onChange={(e) =>
                setRows(
                  rows.map((x, j) =>
                    j === i ? { ...x, points: Number(e.target.value) } : x,
                  ),
                )
              }
            />
          </label>
          {rows.length > 1 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              Remove criterion {i + 1}
            </button>
          )}
        </div>
      ))}
      {rows.length < 10 && (
        <button
          className="button button-secondary"
          type="button"
          onClick={() => setRows([...rows, { criterion: '', points: 10 }])}
        >
          Add criterion
        </button>
      )}
    </div>
  );
}
export function ScoreInput({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const [scores, setScores] = useState<number[]>(() => JSON.parse(value));
  return (
    <div className="learn-builder">
      <input name={name} type="hidden" value={JSON.stringify(scores)} />
      {options.map((o, i) => (
        <label key={i}>
          {o.label} · out of {o.value}
          <input
            type="number"
            min={0}
            max={Number(o.value)}
            required
            value={scores[i] ?? 0}
            onChange={(e) =>
              setScores(
                scores.map((v, j) => (j === i ? Number(e.target.value) : v)),
              )
            }
          />
        </label>
      ))}
    </div>
  );
}
export function QuestionsInput({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    JSON.parse(value),
  );
  const update = (i: number, data: Partial<Question>) =>
    setQuestions(questions.map((q, j) => (i === j ? { ...q, ...data } : q)));
  return (
    <div className="learn-builder">
      <input name={name} type="hidden" value={JSON.stringify(questions)} />
      {questions.map((q, i) => (
        <fieldset key={i}>
          <legend>Question {i + 1}</legend>
          <label>
            Question prompt
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={q.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
            />
          </label>
          {q.options.map((option, j) => (
            <label key={j}>
              Option {j + 1}
              <input
                required
                maxLength={300}
                value={option}
                onChange={(e) =>
                  update(i, {
                    options: q.options.map((o, k) =>
                      j === k ? e.target.value : o,
                    ),
                  })
                }
              />
            </label>
          ))}
          <label>
            Correct answer
            <select
              value={q.correctIndex}
              onChange={(e) =>
                update(i, { correctIndex: Number(e.target.value) })
              }
            >
              {q.options.map((_, j) => (
                <option key={j} value={j}>
                  Option {j + 1}
                </option>
              ))}
            </select>
          </label>
          <div className="learn-link-row">
            {q.options.length < 6 && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => update(i, { options: [...q.options, ''] })}
              >
                Add option
              </button>
            )}
            {questions.length > 1 && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  setQuestions(questions.filter((_, j) => j !== i))
                }
              >
                Remove question {i + 1}
              </button>
            )}
          </div>
        </fieldset>
      ))}
      {questions.length < 30 && (
        <button
          className="button button-secondary"
          type="button"
          onClick={() =>
            setQuestions([
              ...questions,
              { prompt: '', options: ['', ''], correctIndex: 0 },
            ])
          }
        >
          Add question
        </button>
      )}
    </div>
  );
}
