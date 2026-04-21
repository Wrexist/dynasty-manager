import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
  /**
   * Visual tone. Padding and layout are identical across tones — only the
   * rim colour changes.
   *   - 'default' — neutral card-on-background (most pages)
   *   - 'danger'  — warmer rim for destructive sections (Delete Data, etc.)
   */
  tone?: 'default' | 'danger';
}

/**
 * Apple-style liquid-glass surface — the project-wide panel primitive.
 *
 * Every page uses this for sectioned content, so the look is centralized here.
 * Changes to blur / gradient / rim should be made on this file so they ripple
 * across the whole app.
 *
 * Effect stack:
 *   1. Base diagonal gradient, card tones, ~70% alpha.
 *   2. backdrop-blur-2xl + saturate so content behind shows through tinted.
 *   3. Multi-layer inset shadow for the "thick glass" rim (outer stroke,
 *      top highlight, bottom shadow) + soft drop shadow to float the panel.
 *   4. Decorative overlays rendered AFTER children so native `space-y-*`
 *      applied to children via className still works — absolute-positioned
 *      overlays are removed from flow and margin-top on them is harmless.
 *        - top specular crescent (mix-blend-mode: screen → reads as light)
 *        - left/right edge refraction (thin bright streaks on the rim)
 *
 * All decorative layers are pointer-events-none and aria-hidden so they
 * don't steal clicks or show up in the a11y tree.
 */
export function GlassPanel({
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
  tone = 'default',
}: GlassPanelProps) {
  const handleClick = onClick ? () => { hapticLight(); onClick(); } : undefined;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      hapticLight();
      onClick();
    }
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-[hsl(222_35%_14%/0.65)] via-[hsl(222_28%_10%/0.7)] to-[hsl(222_40%_7%/0.78)]',
        'backdrop-blur-2xl backdrop-saturate-150',
        tone === 'danger'
          ? 'shadow-[0_0_0_0.5px_rgba(255,120,120,0.18)_inset,inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.4),0_14px_36px_-16px_rgba(0,0,0,0.6)]'
          : 'shadow-[0_0_0_0.5px_rgba(255,255,255,0.14)_inset,inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.4),0_14px_36px_-16px_rgba(0,0,0,0.55)]',
        onClick && 'cursor-pointer active:scale-[0.985] transition-transform focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none',
        className,
      )}
    >
      {children}
      {/* Specular crescent — bright sky reflected on polished glass. After
          children in DOM so it paints on top (screen blend = additive light). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 60%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Edge refraction — catches the rim on left/right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.07) 100%)',
        }}
      />
    </div>
  );
}
