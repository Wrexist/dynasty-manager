import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface PremiumCheckProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
}

export const PremiumCheck = forwardRef<SVGSVGElement, PremiumCheckProps>(
  ({ className, ...rest }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('w-3 h-3', className)}
      {...rest}
    >
      <path
        d="M3.6 8.4 L6.5 11.3 L12.4 4.9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
);

PremiumCheck.displayName = 'PremiumCheck';
