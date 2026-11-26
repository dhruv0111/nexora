import { Container } from '@/components/layout/container';
import { InquiryForm } from '@/components/marketing/inquiry-form';
import { marketingCourses } from '@/config/marketing';
export const metadata = { title: 'Find your next step' };
export default async function Interest({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; intent?: string }>;
}) {
  const { program, intent } = await searchParams;
  const course = marketingCourses.find((c) => c.slug === program);
  return (
    <main id="main" className="marketing interest-page">
      <Container>
        <div className="inquiry-layout">
          <div>
            <p className="eyebrow">
              YOUR NEXT CHAPTER STARTS WITH A CONVERSATION
            </p>
            <h1>
              {intent === 'career_call' ? (
                <>
                  Let’s talk about
                  <br />
                  <span className="gradient-text">what’s next.</span>
                </>
              ) : course ? (
                <>
                  {course.name}
                  <br />
                  <span className="gradient-text">Your next direction.</span>
                </>
              ) : (
                <>
                  Find your
                  <br />
                  <span className="gradient-text">way forward.</span>
                </>
              )}
            </h1>
            <p>
              {course?.description ??
                'Tell us a little about your goals. Explore a program or request a free career conversation with the team.'}
            </p>
            {course && (
              <dl className="interest-facts">
                <div>
                  <dt>Suggested starting point</dt>
                  <dd>{course.startingPoint}</dd>
                </div>
                <div>
                  <dt>Technologies</dt>
                  <dd>{course.technologies.join(' · ')}</dd>
                </div>
                <div>
                  <dt>Duration & fees</dt>
                  <dd>To be confirmed before enrollment</dd>
                </div>
              </dl>
            )}
            <p className="interest-disclosure">
              An inquiry does not enroll you, reserve a cohort place, or
              authorize payment. A call request is subject to availability and
              personal confirmation.
            </p>
          </div>
          <section
            className="inquiry-card"
            aria-label="Contact the Nexora team"
          >
            <InquiryForm program={program} intent={intent} />
          </section>
        </div>
      </Container>
    </main>
  );
}
