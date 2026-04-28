import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface PremiumSparkleProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  withSatellite?: boolean;
}

export const PremiumSparkle = forwardRef<SVGSVGElement, PremiumSparkleProps>(
  ({ className, withSatellite = true, ...rest }, ref) => {
    const reactId = useId();
    const gradId = `psg-${reactId.replace(/:/g, '')}`;
    const glowId = `psgl-${reactId.replace(/:/g, '')}`;

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn('w-4 h-4', className)}
        {...rest}
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#FFF6D8" />
            <stop offset="38%" stopColor="#FFD86B" />
            <stop offset="78%" stopColor="#E0A926" />
            <stop offset="100%" stopColor="#A56F12" />
          </radialGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE49A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFE49A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft halo */}
        <circle cx="13" cy="11" r="9" fill={`url(#${glowId})`} />

        {/* Main 4-point burst sparkle (concave diamond) */}
        <path
          d="M13 1.5
             C 13.55 5.6, 14.9 7.2, 19 8
             C 14.9 8.8, 13.55 10.4, 13 14.5
             C 12.45 10.4, 11.1 8.8, 7 8
             C 11.1 7.2, 12.45 5.6, 13 1.5 Z"
          fill={`url(#${gradId})`}
          stroke="#FFE49A"
          strokeOpacity="0.55"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />

        {/* Inner highlight on main star for dimension */}
        <path
          d="M13 4
             C 13.3 6.5, 14.1 7.4, 16.4 8
             C 14.1 8.6, 13.3 9.5, 13 12
             C 12.7 9.5, 11.9 8.6, 9.6 8
             C 11.9 7.4, 12.7 6.5, 13 4 Z"
          fill="#FFFBEA"
          fillOpacity="0.35"
        />

        {/* Optional satellite mini-sparkle for premium "magic" feel */}
        {withSatellite && (
          <path
            d="M5.5 16
               C 5.7 17.6, 6.2 18.1, 7.8 18.3
               C 6.2 18.5, 5.7 19, 5.5 20.6
               C 5.3 19, 4.8 18.5, 3.2 18.3
               C 4.8 18.1, 5.3 17.6, 5.5 16 Z"
            fill={`url(#${gradId})`}
            stroke="#FFE49A"
            strokeOpacity="0.5"
            strokeWidth="0.3"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  },
);

PremiumSparkle.displayName = 'PremiumSparkle';
