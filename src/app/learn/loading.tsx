import '@/styles/learning.css';
export default function Loading() {
  return (
    <main id="main" className="learn-content" aria-busy="true">
      <h1>Opening your learning workspace…</h1>
      <div className="learn-skeleton" />
      <div className="learn-skeleton" />
    </main>
  );
}
