import { useId } from 'react';
import {
  ShieldCheck,
  Code2,
  Cpu,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
const palettes: Record<string, [string, string, string]> = {
  QA_SDET: ['#a855f7', '#4d2d9b', '#ec85cf'],
  FULL_STACK: ['#ff647c', '#802e81', '#ffaf80'],
  AI_ENGINEERING: ['#b255e9', '#493bd1', '#eb86ed'],
  DATA_ANALYTICS: ['#706bff', '#263b83', '#86bddb'],
};
const icons = {
  QA_SDET: ShieldCheck,
  FULL_STACK: Code2,
  AI_ENGINEERING: Cpu,
  DATA_ANALYTICS: ChartNoAxesColumnIncreasing,
};
export function CourseArtwork({
  track,
  large = false,
}: {
  track: string;
  large?: boolean;
}) {
  const id = useId();
  const colors = palettes[track] ?? palettes.QA_SDET;
  const Icon = icons[track as keyof typeof icons] ?? Code2;
  return (
    <div
      className={`course-artwork ${large ? 'course-artwork-large' : ''}`}
      aria-hidden="true"
    >
      <svg
        className="course-artwork-bg"
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={colors[0]} />
            <stop offset=".55" stopColor={colors[1]} />
            <stop offset="1" stopColor={colors[2]} />
          </linearGradient>
          <radialGradient id={`${id}-light`}>
            <stop stopColor={colors[2]} stopOpacity=".65" />
            <stop offset="1" stopColor={colors[2]} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="400" fill="#151125" />
        <path
          d="M-80 390C80 60 200 480 425 96S700 120 700 300V450H-80Z"
          fill={`url(#${id})`}
        />
        <path
          d="M-90 240C120 -20 260 370 470 50S720 180 700 330"
          fill="none"
          stroke={colors[2]}
          strokeOpacity=".5"
          strokeWidth="2"
        />
        <path
          d="M-80 280C130 30 270 400 480 100S700 220 700 350"
          fill="none"
          stroke="#ffffff"
          strokeOpacity=".15"
        />
        <ellipse
          cx="420"
          cy="70"
          rx="260"
          ry="230"
          fill={`url(#${id}-light)`}
        />
        <circle cx="310" cy="195" r="103" fill="#08081640" stroke="#ffffff25" />
        <circle
          cx="310"
          cy="195"
          r="125"
          fill="none"
          stroke="#ffffff15"
          strokeDasharray="4 11"
        />
      </svg>
      <span className="artwork-discipline">{track.replaceAll('_', ' / ')}</span>
      <Icon className="artwork-symbol" strokeWidth={1.15} />
      <span className="artwork-caption">
        LEARN WITH INTENTION. BUILD WITH PURPOSE.
      </span>
    </div>
  );
}
