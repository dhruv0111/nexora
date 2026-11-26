import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  CalendarDays,
  MonitorPlay,
  Layers3,
} from 'lucide-react';
import { CourseArtwork } from './artwork';
import { money, type CourseView } from '@/lib/catalog/read';
export function Catalog({
  courses,
  q,
  level,
}: {
  courses: CourseView[];
  q: string;
  level: string;
}) {
  const filtered = courses.filter(
    (c) =>
      (!q ||
        [c.title, c.description, ...c.technologies]
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (level === 'all' ||
        (level === 'foundations'
          ? c.assessmentRequired
          : !c.assessmentRequired)),
  );
  return (
    <>
      <div className="catalog-toolbar">
        <form action="/programs" className="catalog-search" role="search">
          <div>
            <label htmlFor="course-search">Find your next direction</label>
            <Search size={18} />
            <input
              id="course-search"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="Search programs or technologies…"
            />
          </div>
          <div>
            <label htmlFor="course-level">Starting point</label>
            <select name="level" id="course-level" defaultValue={level}>
              <option value="all">All starting points</option>
              <option value="beginner">Beginner pathways</option>
              <option value="foundations">Foundations required</option>
            </select>
          </div>
          <button className="button button-secondary" type="submit">
            <SlidersHorizontal size={16} />
            Filter programs
          </button>
        </form>
        <span className="catalog-count" role="status">
          {filtered.length} {filtered.length === 1 ? 'path' : 'paths'} to
          explore
        </span>
      </div>
      <div className="catalog-grid">
        {filtered.map((c) => (
          <article key={c.slug} className="catalog-card">
            <Link href={`/programs/${c.slug}`} tabIndex={-1} aria-hidden="true">
              <CourseArtwork track={c.track} />
            </Link>
            <div className="catalog-card-body">
              <div className="catalog-card-flags">
                <span>
                  {c.assessmentRequired
                    ? 'Technical foundations'
                    : 'Beginner pathway'}
                </span>
                <span className={c.verified ? 'approved-label' : 'draft-label'}>
                  {c.verified ? 'Approved program' : 'Illustrative draft'}
                </span>
              </div>
              <h2>
                <Link href={`/programs/${c.slug}`}>{c.title}</Link>
              </h2>
              <p>{c.description}</p>
              <div className="catalog-technologies">
                {c.technologies.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="catalog-facts">
                <span>
                  <CalendarDays size={15} />
                  {c.durationWeeks} weeks{!c.verified ? ' · proposed' : ''}
                </span>
                <span>
                  <MonitorPlay size={15} />
                  {c.deliveryFormat}
                </span>
                <span>
                  <Layers3 size={15} />
                  {c.cohorts.some((h) => h.admissionsOpen)
                    ? 'Cohort applications open'
                    : 'Cohort dates unannounced'}
                </span>
              </div>
              <div className="catalog-card-bottom">
                <span>
                  {c.priceApproved
                    ? money(c.priceMinor, c.currency)
                    : 'Fee awaiting approval'}
                </span>
                <Link
                  className="button button-secondary"
                  href={`/programs/${c.slug}`}
                >
                  Explore Program
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="catalog-empty">
          <Search size={30} />
          <h2>No matching programs.</h2>
          <p>Try a different technology or starting point.</p>
          <Link href="/programs" className="button button-secondary">
            Reset filters
          </Link>
        </div>
      )}
      <section id="compare-tracks" className="track-comparison">
        <p className="eyebrow">DIFFERENT PATHS. AN INFORMED CHOICE.</p>
        <h2>Find the right starting point.</h2>
        <div
          className="comparison-scroll"
          role="region"
          aria-label="Compare all four programs"
          tabIndex={0}
        >
          <table>
            <caption>
              Program comparison — unapproved content remains illustrative.
            </caption>
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Starting point</th>
                <th scope="col">Structure</th>
                <th scope="col">Admission</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.slug}>
                  <th scope="row">
                    <Link href={`/programs/${c.slug}`}>{c.title}</Link>
                  </th>
                  <td>{c.prerequisites[0]}</td>
                  <td>
                    {c.durationWeeks}-week{' '}
                    {c.verified ? 'curriculum' : 'draft outline'}
                  </td>
                  <td>
                    {c.assessmentRequired
                      ? 'Reviewed technical prerequisite assessment'
                      : 'Background and goals review'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
