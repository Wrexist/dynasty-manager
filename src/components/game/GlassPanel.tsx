import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

/**
 * Shared liquid-glass class string — use via `cn(LIQUID_GLASS_SURFACE, ...)`
 * on elements that need the GlassPanel look but can't use the `<GlassPanel>`
 * component directly (e.g. `<motion.button>` with hover/press animation,
 * interactive cards that need their own event handlers, etc.).
 *
 * This is the single source of truth for the liquid-glass surface. Changes
 * here ripple everywhere the constant is imported.
 */
export const LIQUID_GLASS_SURFACE =
  'relative overflow-hidden rounded-2xl transform-gpu ' +
  'bg-gradient-to-br from-[hsl(222_35%_14%/0.65)] via-[hsl(222_28%_10%/0.7)] to-[hsl(222_40%_7%/0.78)] ' +
  'backdrop-blur-2xl backdrop-saturate-150 ' +
  'shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.32),0_10px_28px_-16px_rgba(0,0,0,0.4)]';

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
        // `transform-gpu` forces a compositing layer so the rounded clip +
        // backdrop-blur render cleanly (without it, iOS Safari / Chromium
        // can leave jagged subpixel fringing at the rounded corners).
        'relative overflow-hidden rounded-2xl transform-gpu',
        'bg-gradient-to-br from-[hsl(222_35%_14%/0.65)] via-[hsl(222_28%_10%/0.7)] to-[hsl(222_40%_7%/0.78)]',
        'backdrop-blur-2xl backdrop-saturate-150',
        tone === 'danger'
          ? 'shadow-[0_0_0_1px_rgba(255,120,120,0.12)_inset,inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.32),0_10px_28px_-16px_rgba(0,0,0,0.45)]'
          : 'shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.32),0_10px_28px_-16px_rgba(0,0,0,0.4)]',
        onClick && 'cursor-pointer active:scale-[0.985] transition-transform focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none',
        className,
      )}
    >
      {children}
      {/* Specular crescent — bright sky reflected on polished glass. After
          children in DOM so it paints on top (screen blend = additive light).
          Kept on its own layer so the additive highlight doesn't fight the
          tonal gradient underneath. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 32%, rgba(255,255,255,0) 62%)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}
