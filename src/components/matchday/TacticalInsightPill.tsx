import { Zap } from 'lucide-react';

/**
 * The in-match tactical insight ("Wide play exploiting SOU's narrow shape
 * (+10%)"). It was a 9px pill (playthrough 2026-09, R20) — under the 11px type
 * floor — so it now uses the `text-micro` token (11px / 14px). At that size a
 * long insight no longer fits one line at 375px, so the pill wraps: rounded
 * rather than fully round, icon pinned to the first line, capped to the
 * column width.
 */
export function TacticalInsightPill({ text }: { text: string }) {
  return (
    <span
      data-testid="tactical-insight-pill"
      className="inline-flex max-w-full items-start gap-1 rounded-2xl border border-primary/25 bg-primary/15 px-2.5 py-1 text-left text-micro font-medium text-primary"
    >
      <Zap className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{text}</span>
    </span>
  );
}
