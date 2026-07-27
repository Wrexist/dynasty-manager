import { cn } from '@/lib/utils';

/**
 * SectionHeader — the ONE way a heading is drawn.
 *
 * WHY THIS EXISTS: an audit found page titles alone written 17 different
 * ways (`text-lg font-bold font-display`, `text-lg font-display font-bold`,
 * `text-xl font-black font-display`, `text-base font-bold`, `text-sm
 * font-bold`, …) — including two spellings of byte-identical output — plus
 * 22 distinct `tracking-*` values. Headings are the skeleton a player reads
 * every screen; inconsistent ones are what makes a good app feel assembled
 * rather than designed.
 *
 * Three levels, and that's the whole vocabulary:
 *   - `page`    — the screen's title. One per screen, Oswald, 20px.
 *   - `section` — a block inside a screen. DM Sans, 14px semibold.
 *   - `eyebrow` — the small all-caps muted label above dense data. Seeded
 *                 from `SettingsPage`'s `SettingsSection`, which had the
 *                 cleanest treatment in the codebase.
 *
 * The `accessory` slot is what stops call sites from re-inventing the
 * `flex items-center justify-between` wrapper (the second-most duplicated
 * fragment in the audit) — pass a badge, count, or button and alignment is
 * handled here.
 */

type HeaderLevel = 'page' | 'section' | 'eyebrow';

const LEVEL_STYLES: Record<HeaderLevel, string> = {
  // Oswald + tight tracking: display type at 20px needs negative tracking or
  // it reads loose next to DM Sans body copy.
  page: 'text-h3 font-display font-bold text-foreground tracking-tight',
  section: 'text-body font-semibold text-foreground',
  eyebrow: 'text-caption font-semibold uppercase tracking-wider text-muted-foreground',
};

interface SectionHeaderProps {
  title: string;
  /** Right-aligned slot: status pill, count, action button. */
  accessory?: React.ReactNode;
  /** Leading icon — sized and coloured here so call sites stop guessing. */
  icon?: React.ElementType;
  /** One-line supporting copy below the title. */
  subtitle?: string;
  /** Hairline divider under the header. Use inside dense panels. */
  rule?: boolean;
  level?: HeaderLevel;
  /** Heading tag override — keep the document outline sane. */
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
}

export function SectionHeader({
  title,
  accessory,
  icon: Icon,
  subtitle,
  rule = false,
  level = 'page',
  as,
  className,
}: SectionHeaderProps) {
  const Tag = as ?? (level === 'page' ? 'h2' : 'h3');

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        rule && 'border-b border-border/40 pb-2',
        className,
      )}
    >
      <div className="min-w-0 flex items-center gap-2">
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              'shrink-0',
              level === 'page' ? 'w-5 h-5 text-primary' : 'w-4 h-4 text-muted-foreground',
            )}
          />
        )}
        <div className="min-w-0">
          <Tag className={cn(LEVEL_STYLES[level], 'truncate')}>{title}</Tag>
          {subtitle && (
            <p className="text-micro text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {accessory && <div className="shrink-0 flex items-center gap-2">{accessory}</div>}
    </div>
  );
}
