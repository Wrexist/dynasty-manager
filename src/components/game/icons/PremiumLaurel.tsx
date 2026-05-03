import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface PremiumLaurelProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

/**
 * Half laurel sprig in the project's gold tone — a curved branch with
 * almond-shaped leaves on the outer side. Mirror with `scale-x-[-1]` to
 * flank a centred award label (e.g. WINNER pill in Ballon d'Or).
 */
export const PremiumLaurel = forwardRef<SVGSVGElement, PremiumLaurelProps>(
  ({ className, ...rest }, ref) => {
    const reactId = useId();
    const stemId = `lrlst-${reactId.replace(/:/g, '')}`;
    const leafId = `lrlf-${reactId.replace(/:/g, '')}`;

    return (
      <svg
        ref={ref}
        viewBox="0 0 14 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn('w-3.5 h-5', className)}
        {...rest}
      >
        <defs>
          <linearGradient id={stemId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#A56F12" />
            <stop offset="55%" stopColor="#F4C84A" />
            <stop offset="100%" stopColor="#FFEFB8" />
          </linearGradient>
          <linearGradient id={leafId} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFEFB8" />
            <stop offset="55%" stopColor="#E0A926" />
            <stop offset="100%" stopColor="#7E5210" />
          </linearGradient>
        </defs>

        {/* Curved stem from lower-right to top, leaning inward toward label. */}
        <path
          d="M 10 21 C 9.4 16, 7.5 9, 4 1.5"
          stroke={`url(#${stemId})`}
          strokeWidth="0.85"
          strokeLinecap="round"
          fill="none"
        />

        {/* Outer leaves — almond shapes rotated to follow the stem curve. */}
        <ellipse
          cx="11.6" cy="17" rx="2.6" ry="1"
          transform="rotate(-48 11.6 17)"
          fill={`url(#${leafId})`}
          stroke="#FFE49A" strokeOpacity="0.45" strokeWidth="0.22"
        />
        <ellipse
          cx="10.2" cy="12.2" rx="2.5" ry="0.95"
          transform="rotate(-58 10.2 12.2)"
          fill={`url(#${leafId})`}
          stroke="#FFE49A" strokeOpacity="0.45" strokeWidth="0.22"
        />
        <ellipse
          cx="8.2" cy="7.4" rx="2.2" ry="0.85"
          transform="rotate(-68 8.2 7.4)"
          fill={`url(#${leafId})`}
          stroke="#FFE49A" strokeOpacity="0.45" strokeWidth="0.22"
        />
        <ellipse
          cx="5.6" cy="3.2" rx="1.7" ry="0.75"
          transform="rotate(-80 5.6 3.2)"
          fill={`url(#${leafId})`}
          stroke="#FFE49A" strokeOpacity="0.45" strokeWidth="0.22"
        />

        {/* Tiny tip leaf for refinement. */}
        <ellipse
          cx="3.6" cy="1.4" rx="1.1" ry="0.55"
          transform="rotate(-92 3.6 1.4)"
          fill={`url(#${leafId})`}
          stroke="#FFE49A" strokeOpacity="0.45" strokeWidth="0.18"
        />
      </svg>
    );
  },
);

PremiumLaurel.displayName = 'PremiumLaurel';
