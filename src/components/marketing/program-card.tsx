import Link from 'next/link';
import {
  ShieldCheck,
  Code2,
  Cpu,
  ChartNoAxesColumnIncreasing,
  Check,
} from 'lucide-react';
import { marketingCourses } from '@/config/marketing';
const icons = {
  shield: ShieldCheck,
  code: Code2,
  cpu: Cpu,
  chart: ChartNoAxesColumnIncreasing,
};
export function ProgramCard({
  course,
}: {
  course: (typeof marketingCourses)[number];
}) {
  const Icon = icons[course.icon];
  return (
    <article className={`path-card accent-${course.accent}`}>
      <div className="path-card-light" />
      <div className="path-top">
        <span className="path-icon">
          <Icon size={27} strokeWidth={1.5} />
        </span>
        <span className="path-level">
          <Check size={12} />
          {course.prerequisite}
        </span>
      </div>
      <p className="path-category">{course.category}</p>
      <h3>{course.name}</h3>
      <p className="path-outcome">{course.outcome}</p>
      <p className="path-description">{course.description}</p>
      <div className="path-technologies">
        {course.technologies.map((tech) => (
          <span key={tech}>{tech}</span>
        ))}
      </div>
      <Link
        href={`/programs/${course.slug}`}
        className="path-link"
        data-track="cta_click"
        data-location={`track_${course.slug}`}
      >
        Explore Program <span aria-hidden="true">+</span>
      </Link>
    </article>
  );
}
