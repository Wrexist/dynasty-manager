/**
 * What has happened lately, in one scannable column.
 *
 * The hub used to give the week log a panel and the rivalry story another one,
 * five stacked paragraphs deep, and never showed records or the squad's own
 * memories at all. `sundayNewsFeed` merges all five sources; this renders them.
 *
 * WHAT IT MUST NOT DO. Every line here is AUTHORED VOICE — week-log recaps,
 * rivalry diary, record labels, the things players remember. Not one word is
 * shortened, rewritten or summarised. The only thing that changes is the
 * presentation: a glyph that says what kind of thing it is, a stamp that says
 * when, two lines by default, and the whole line on a tap. A feed that hides
 * its own copy behind an ellipsis forever would be worse than the wall it
 * replaced, so every item stays one tap from complete.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { SUNDAY_NEWS_ICON, SUNDAY_NEWS_TONE } from '@/config/sundayIcons';
import type { SundayNewsEntry } from '@/utils/sunday/view';

export interface SundayNewsListProps {
  entries: readonly SundayNewsEntry[];
  /** Rows shown before the reveal. The rest are one tap away. */
  initial?: number;
  /**
   * Who an entry is about, when it is about somebody.
   *
   * Squad memories are written in the third person with no name in them
   * ("Made his debut against Rose & Crown Rovers."), so three men making their
   * debut in one afternoon produced three identical lines. The name is
   * PREPENDED as its own element rather than spliced into the sentence — the
   * authored line is still the authored line.
   */
  nameOf?: (playerId: string) => string | null;
}

export function SundayNewsList({ entries, initial = 5, nameOf }: SundayNewsListProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (entries.length === 0) return null;
  const shown = expanded ? entries : entries.slice(0, initial);

  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((entry, i) => {
          const Icon = SUNDAY_NEWS_ICON[entry.kind];
          const open = openId === entry.id;
          return (
            <motion.li
              key={entry.id}
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.04, 0.24), duration: 0.22 }}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : entry.id)}
                aria-expanded={open}
                className="w-full flex items-start gap-2 text-left min-h-[44px] py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Icon
                  className={cn('w-3.5 h-3.5 shrink-0 mt-1', SUNDAY_NEWS_TONE[entry.kind])}
                  aria-hidden
                />
                <span className={cn(
                  'flex-1 min-w-0 text-caption text-muted-foreground leading-relaxed',
                  !open && 'line-clamp-2',
                )}>
                  {entry.playerId && nameOf?.(entry.playerId) && (
                    <span className="font-semibold text-foreground/90">
                      {nameOf(entry.playerId)}{' — '}
                    </span>
                  )}
                  {entry.text}
                </span>
                {entry.season != null && entry.week != null && (
                  <span className="shrink-0 text-micro text-muted-foreground/60 tabular-nums mt-0.5">
                    S{entry.season} W{entry.week}
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
      {entries.length > initial && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1 w-full min-h-[44px] text-caption font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
        >
          {expanded ? t('sunday.hub.less') : t('sunday.hub.more')}
        </button>
      )}
    </div>
  );
}
