import Link from 'next/link';
import {
  ShieldCheck,
  Code2,
  Cpu,
  ChartNoAxesColumnIncreasing,
  Plus,
} from 'lucide-react';
import type { CoursePreview } from '@/config/site';
import { Badge } from './ui/badge';
const icons = {
  shield: ShieldCheck,
  code: Code2,
  cpu: Cpu,
  chart: ChartNoAxesColumnIncreasing,
};
export function CourseCard({ course }: { course: CoursePreview }) {
  const Icon = icons[course.icon];
  return (
    <article className={`course-card accent-${course.accent}`}>
      <div className="course-art" aria-hidden="true">
        <div className="art-grid" />
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <Icon className="course-art-icon" strokeWidth={1.2} />
        <span className="art-spark spark-one" />
        <span className="art-spark spark-two" />
        <span className="art-caption">LEARN. BUILD. BECOME.</span>
      </div>
      <div className="course-content">
        <p className="eyebrow">{course.category}</p>
        <h3>
          <Link href={`/programs/${course.slug}`}>
            {course.name}
            <Plus size={18} aria-hidden="true" />
          </Link>
        </h3>
        <p>{course.description}</p>
        <div className="course-tags">
          {course.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      </div>
    </article>
  );
}
