import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
import { cn } from '@/lib/utils';
import {
  RELEASE_NOTES,
  LATEST_RELEASE,
  writeWhatsNewSeenVersion,
  type ReleaseNote,
  type ReleaseCategory,
} from '@/data/whatsNew';

const CATEGORY_ORDER: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];

/**
 * Per-category label + bullet colour.
 *
 * `highlights` uses `gold`, not `primary`, deliberately: this page renders in
 * two theme contexts — standalone from TitleScreen where `--primary` is gold,
 * and inside GameShell where `.game-theme` flips `--primary` to emerald. The
 * marquee section must read as gold on both (see the medal-tier comment in
 * `tailwind.config.ts`). The other three avoid `primary` for the same reason.
 *
 * Class strings are written out in full — Tailwind cannot see interpolated
 * names, so a template-built class would be purged from the build.
 */
const CATEGORY_META: Record<ReleaseCategory, { label: string; bullet: string; labelColor: string }> = {
  highlights: { label: 'Highlights', bullet: "before:text-gold", labelColor: 'text-gold/90' },
  new: { label: 'New', bullet: "before:text-emerald-300/80", labelColor: 'text-emerald-300/85' },
  improved: { label: 'Improved', bullet: "before:text-accent/85", labelColor: 'text-accent/90' },
  fixed: { label: 'Fixed', bullet: "before:text-muted-foreground/60", labelColor: 'text-muted-foreground/75' },
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ReleaseCard({ entry, isLatest }: { entry: ReleaseNote; isLatest: boolean }) {
  // Grouped, not flattened: a release this size is unreadable as one undivided
  // list, and "what's new" vs "what's fixed" is the split players actually scan
  // for. Empty categories drop out so short releases stay compact.
  const sections = CATEGORY_ORDER
    .map(cat => ({ cat, items: entry[cat] ?? [] }))
    .filter(section => section.items.length > 0);

  return (
    <GlassPanel className={cn('p-3 space-y-2', isLatest && 'border border-primary/25')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border',
            isLatest
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-white/5 text-muted-foreground border-white/10',
          )}>
            v{entry.version}
          </span>
          {isLatest && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
              New
            </span>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground/80 uppercase tracking-wider">
          {formatDate(entry.date)}
        </span>
      </div>

      {entry.headline && (
        <h3 className="font-display text-[13px] font-bold leading-snug text-foreground tracking-tight">
          {entry.headline}
        </h3>
      )}

      {/*
        Summary is prose, and prose does not scan. It earns its space on the
        card the player actually reads on launch; on the historical entries
        below it, the grouped bullets carry the release on their own.
      */}
      {isLatest && entry.summary && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {entry.summary}
        </p>
      )}

      {sections.length > 0 && (
        <div className="space-y-2 pt-0.5">
          {sections.map(({ cat, items }) => (
            <div key={cat} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-widest',
                  CATEGORY_META[cat].labelColor,
                )}>
                  {CATEGORY_META[cat].label}
                </span>
                <span className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[9px] tabular-nums text-muted-foreground/50">
                  {items.length}
                </span>
              </div>
              <ul className="space-y-1 pl-3">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className={cn(
                      'text-[12px] leading-snug text-foreground/85 relative',
                      "before:content-['•'] before:absolute before:-left-3",
                      CATEGORY_META[cat].bullet,
                    )}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}

interface WhatsNewPageProps {
  /**
   * When true, renders a self-contained page with header + background (used
   * from TitleScreen via React Router). When false/omitted, renders a bare
   * content block suitable for GameShell's in-game screen container.
   */
  standalone?: boolean;
}

const WhatsNewPage = ({ standalone = false }: WhatsNewPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    writeWhatsNewSeenVersion(LATEST_RELEASE.version);
  }, []);

  const notes = RELEASE_NOTES;

  // Only the standalone variant renders the back button, so this handler
  // never runs in-game (GameShell owns navigation there).
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const content = (
    <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        {standalone && (
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <PremiumSparkle className="w-4 h-4" />
        <h2 className="font-display text-base font-bold text-foreground tracking-tight">
          Update Log
        </h2>
        <span className="ml-auto text-[10px] text-muted-foreground/70 uppercase tracking-wider">
          {notes.length} {notes.length === 1 ? 'release' : 'releases'}
        </span>
      </div>

      <div className="space-y-2">
        {notes.map((entry, idx) => (
          <motion.div
            key={`${entry.version}-${entry.build ?? 'pending'}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.24), duration: 0.3, ease: 'easeOut' }}
          >
            <ReleaseCard entry={entry} isLatest={idx === 0} />
          </motion.div>
        ))}
      </div>

      {notes.length === 0 && (
        <GlassPanel className="p-6 text-center">
          <PremiumSparkle className="w-7 h-7 mx-auto mb-2 opacity-40" withSatellite={false} />
          <p className="text-xs text-muted-foreground">No release notes yet.</p>
        </GlassPanel>
      )}

      <p className="text-[9px] text-muted-foreground/50 text-center pt-1 pb-3">
        Updates ship via the App Store · restart to pull latest TestFlight build.
      </p>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
        {content}
      </div>
    );
  }
  return content;
};

export default WhatsNewPage;
