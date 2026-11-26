'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="career-content">
      <h1>Career workspace unavailable</h1>
      <p>We could not load this view. Your saved records remain available.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
