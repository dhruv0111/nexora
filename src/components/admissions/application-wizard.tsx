'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserRound,
  GraduationCap,
  Sparkles,
  FileCheck2,
  Check,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  applicantSchema,
  type ApplicantDetails,
} from '@/lib/admissions/validation';
const questions = [
  'Explain how you would use a Python dictionary to count repeated items.',
  'Why would you separate training data from validation data?',
  'What would you check before trusting a result returned by an API?',
];
const labels = ['Your starting point', 'Your direction', 'Review & submit'];
export function ApplicationWizard({
  slug,
  title,
  assessmentRequired,
  initial,
  initialVersion = 0,
}: {
  slug: string;
  title: string;
  assessmentRequired: boolean;
  initial: Partial<ApplicantDetails>;
  initialVersion?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0),
    [version, setVersion] = useState(initialVersion),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<ApplicantDetails>({
    fullName: '',
    education: [{ qualification: '', institution: '', year: '' }],
    background: 'NON_TECHNICAL',
    backgroundDetails: '',
    careerGoals: '',
    availability: '10_20',
    timezone: 'Asia/Kolkata',
    assessmentAnswers: ['', '', ''],
    consent: false,
    ...initial,
  });
  function set<K extends keyof ApplicantDetails>(
    key: K,
    value: ApplicantDetails[K],
  ) {
    setData((old) => ({ ...old, [key]: value }));
    setMessage('');
    setError('');
  }
  function next() {
    setStep((s) => Math.min(s + 1, 2));
    heading.current?.focus();
  }
  async function save(action: 'save' | 'submit') {
    setError('');
    setMessage('');
    if (action === 'submit') {
      const parsed = applicantSchema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setError(
          issue
            ? `${String(issue.path[0] ?? 'Application')}: ${issue.message}`
            : 'Check your information.',
        );
        return;
      }
      if (!data.consent) {
        setError('Agree to the application data notice to submit.');
        return;
      }
      if (
        assessmentRequired &&
        data.assessmentAnswers.some((a) => a.trim().length < 30)
      ) {
        setError(
          'Complete each technical question with at least 30 characters.',
        );
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/applications/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, version, details: data }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Unable to save. Please retry.');
        return;
      }
      setVersion(result.version);
      if (result.status !== 'DRAFT') router.push(`/applications/${result.id}`);
      else
        setMessage(
          'Draft saved to your account. You can return here to continue.',
        );
    } catch {
      setError(
        'Connection interrupted. Your information is still in the form. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="application-frame">
      <aside className="application-steps">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h2>{title}</h2>
        <p>One thoughtful step at a time.</p>
        <ol>
          {labels.map((label, i) => {
            const Icon = [UserRound, Sparkles, FileCheck2][i];
            return (
              <li key={label} aria-current={step === i ? 'step' : undefined}>
                <span>
                  {i < step ? <Check size={19} /> : <Icon size={21} />}
                </span>
                <div>
                  <small>STEP {i + 1}</small>
                  <strong>{label}</strong>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="application-side-note">
          <ShieldCheck size={19} />
          <p>
            Applying is not enrollment. Your background and goals are reviewed
            before any fee agreement.
          </p>
        </div>
        <Link href="/applications">View my applications</Link>
      </aside>
      <form
        className="application-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) next();
          else void save('submit');
        }}
      >
        <p className="eyebrow">STEP {step + 1} OF 3</p>
        <h2 ref={heading} tabIndex={-1}>
          {labels[step]}
        </h2>
        <p className="application-form-intro">
          {step === 0
            ? 'Tell us about the experience you’re bringing with you.'
            : step === 1
              ? 'Help admissions understand your goals, readiness, and available time.'
              : 'Review your details and agree to the specific application data notice.'}
        </p>
        {error && (
          <div className="workflow-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p className="workflow-success" role="status">
            {message}
          </p>
        )}
        {step === 0 && (
          <div className="application-fields">
            <label htmlFor="app-name">Full name</label>
            <Input
              id="app-name"
              autoComplete="name"
              value={data.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              maxLength={100}
            />
            <label htmlFor="app-background">Your background</label>
            <select
              id="app-background"
              className="input"
              value={data.background}
              onChange={(e) =>
                set(
                  'background',
                  e.target.value as ApplicantDetails['background'],
                )
              }
            >
              <option value="NON_TECHNICAL">
                Transitioning from a nontechnical background
              </option>
              <option value="TECHNICAL">Some technical experience</option>
              <option value="STUDENT">Currently studying</option>
              <option value="OTHER">Another starting point</option>
            </select>
            <label htmlFor="app-background-details">
              A little about your experience <span>(20+ characters)</span>
            </label>
            <textarea
              id="app-background-details"
              className="input"
              rows={3}
              value={data.backgroundDetails}
              maxLength={1500}
              onChange={(e) => set('backgroundDetails', e.target.value)}
            />
            <div className="education-heading">
              <GraduationCap size={20} />
              <h3>Education</h3>
            </div>
            {data.education.map((education, index) => (
              <fieldset className="education-row" key={index}>
                <legend>Education {index + 1}</legend>
                <div>
                  <label htmlFor={`qualification-${index}`}>
                    Qualification or learning pathway
                  </label>
                  <Input
                    id={`qualification-${index}`}
                    value={education.qualification}
                    maxLength={150}
                    onChange={(e) =>
                      set(
                        'education',
                        data.education.map((item, i) =>
                          i === index
                            ? { ...item, qualification: e.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Degree, diploma, or another learning path"
                  />
                </div>
                <div>
                  <label htmlFor={`institution-${index}`}>
                    Institution <span>(optional)</span>
                  </label>
                  <Input
                    id={`institution-${index}`}
                    value={education.institution}
                    maxLength={180}
                    onChange={(e) =>
                      set(
                        'education',
                        data.education.map((item, i) =>
                          i === index
                            ? { ...item, institution: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <label htmlFor={`year-${index}`}>
                    Completion year <span>(optional)</span>
                  </label>
                  <Input
                    id={`year-${index}`}
                    inputMode="numeric"
                    value={education.year}
                    maxLength={4}
                    onChange={(e) =>
                      set(
                        'education',
                        data.education.map((item, i) =>
                          i === index
                            ? { ...item, year: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                {data.education.length > 1 && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() =>
                      set(
                        'education',
                        data.education.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove education {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            {data.education.length < 4 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  set('education', [
                    ...data.education,
                    { qualification: '', institution: '', year: '' },
                  ])
                }
              >
                Add another education record
              </Button>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="application-fields">
            <label htmlFor="app-goals">
              What would you like to build toward? <span>(40+ characters)</span>
            </label>
            <textarea
              className="input"
              id="app-goals"
              rows={4}
              maxLength={2000}
              value={data.careerGoals}
              onChange={(e) => set('careerGoals', e.target.value)}
            />
            <div className="application-two-columns">
              <div>
                <label htmlFor="app-availability">
                  Weekly practice availability
                </label>
                <select
                  id="app-availability"
                  className="input"
                  value={data.availability}
                  onChange={(e) =>
                    set(
                      'availability',
                      e.target.value as ApplicantDetails['availability'],
                    )
                  }
                >
                  <option value="5_10">5–10 hours</option>
                  <option value="10_20">10–20 hours</option>
                  <option value="20_PLUS">20+ hours</option>
                </select>
              </div>
              <div>
                <label htmlFor="app-timezone">Your time zone</label>
                <Input
                  id="app-timezone"
                  value={data.timezone}
                  maxLength={80}
                  onChange={(e) => set('timezone', e.target.value)}
                />
              </div>
            </div>
            {assessmentRequired && (
              <fieldset className="assessment-questions">
                <legend>AI Engineering prerequisite assessment</legend>
                <p>
                  A human reviewer assesses your answers. There is no automatic
                  admission or fabricated assessment score.
                </p>
                {questions.map((q, i) => (
                  <div key={q}>
                    <label htmlFor={`assessment-${i}`}>{q}</label>
                    <textarea
                      id={`assessment-${i}`}
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={data.assessmentAnswers[i] ?? ''}
                      onChange={(e) => {
                        const answers = [...data.assessmentAnswers];
                        answers[i] = e.target.value;
                        set('assessmentAnswers', answers);
                      }}
                    />
                    <small>
                      At least 30 characters. Explain in your own words.
                    </small>
                  </div>
                ))}
              </fieldset>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="application-review">
            <dl>
              <div>
                <dt>Program</dt>
                <dd>{title}</dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{data.fullName || 'Not entered'}</dd>
              </div>
              <div>
                <dt>Education</dt>
                <dd>
                  {data.education
                    .map((e) => e.qualification || 'Not entered')
                    .join(' · ')}
                </dd>
              </div>
              <div>
                <dt>Background</dt>
                <dd>{data.backgroundDetails || 'Not entered'}</dd>
              </div>
              <div>
                <dt>Career goals</dt>
                <dd>{data.careerGoals || 'Not entered'}</dd>
              </div>
              <div>
                <dt>Practice availability</dt>
                <dd>
                  {data.availability.replace('_', '–')} hours · {data.timezone}
                </dd>
              </div>
            </dl>
            <label className="application-consent">
              <input
                type="checkbox"
                checked={data.consent}
                onChange={(e) => set('consent', e.target.checked)}
              />
              <span>
                I agree to Nexora storing and reviewing my application,
                education, background, goals, availability, and assessment
                answers for admissions. I understand that this is not
                enrollment, employment, or a payment agreement.
              </span>
            </label>
            <p className="application-data-note">
              Application data notice · application-v1. Your submitted snapshot
              is visible to authorized admissions staff. Don’t include sensitive
              documents or financial details.{' '}
              <Link href="/policies/privacy">Read privacy information</Link>.
            </p>
          </div>
        )}
        <div className="application-actions">
          <div>
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
              >
                Previous
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void save('save')}
            >
              <Save size={15} />
              Save draft
            </Button>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : step === 2 ? 'Submit Application' : 'Continue'}
          </Button>
        </div>
        <p className="application-draft-note">
          Draft version {version} · Only saved data persists between visits.
        </p>
      </form>
    </div>
  );
}
