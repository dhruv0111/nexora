export default function Loading() {
  return (
    <main
      id="main"
      className="container state-page"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton" />
      <p role="status">Preparing your workspace…</p>
    </main>
  );
}
