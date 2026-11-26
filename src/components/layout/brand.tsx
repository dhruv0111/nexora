import { useId } from 'react';
import Link from 'next/link';
export function Brand() {
  const gradientId = useId();
  return (
    <Link href="/" className="brand" aria-label="Nexora home">
      <svg aria-hidden="true" width="33" height="34" viewBox="0 0 38 34">
        <defs>
          <linearGradient id={gradientId} x2="1" y2="1">
            <stop stopColor="#A855F7" />
            <stop offset=".5" stopColor="#E45BF5" />
            <stop offset="1" stopColor="#FF965C" />
          </linearGradient>
        </defs>
        <path
          d="M0 29 8 5h7l10 18 6-18h7l-8 24h-7L13 11 7 29Z"
          fill={`url(#${gradientId})`}
        />
      </svg>
      <span>
        NEXORA<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
