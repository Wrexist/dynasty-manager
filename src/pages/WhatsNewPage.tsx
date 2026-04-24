import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { useGameStore } from '@/store/gameStore';
import {
  Sparkles,
  Plus,
  ArrowUp,
  Wrench,
  Star,
  ArrowLeft,
  Calendar,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RELEASE_NOTES,
  LATEST_RELEASE,
  writeWhatsNewSeenVersion,
  type ReleaseNote,
  type ReleaseCategory,
} from '@/data/whatsNew';

const CATEGORY_META: Record<ReleaseCategory, {
  label: string;
  icon: typeof Sparkles;
  color: string;
  bg: string;
  border: string;
}> = {
  highlights: {
    label: 'Highlights',
    icon: Star,
    color: 'text-primary',
    bg: 'bg-primary/15',
    border: 'border-primary/30',
  },
  new: {
    label: 'New',
    icon: Plus,
    color: 'text-emerald-300',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
  },
  improved: {
    label: 'Improved',
    icon: ArrowUp,
    color: 'text-sky-300',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
  },
  fixed: {
    label: 'Fixed',
    icon: Wrench,
    color: 'text-amber-300',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
  },
};

const CATEGORY_ORDER: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];

function formatDate(iso: string): string {
  // Guard against malformed strings — fall back to the raw value so release
  // notes still render even if a historical entry has a non-ISO date.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ChangeSection({ category, items }: { category: ReleaseCategory; items: string[] }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'w-5 h-5 rounded-md flex items-center justify-center border',
          meta.bg, meta.border,
        )}>
          <Icon className={cn('w-3 h-3', meta.color)} />
        </div>
        <p className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', meta.color)}>
          {meta.label}
        </p>
      </div>
      <ul className="space-y-1.5 pl-[26px]">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-[13px] leading-relaxed text-foreground/85 relative before:content-['•'] before:absolute before:-left-3 before:text-muted-foreground/50"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReleaseCard({ entry, isLatest }: { entry: ReleaseNote; isLatest: boolean }) {
  const sections = CATEGORY_ORDER
    .map<[ReleaseCategory, string[] | undefined]>(cat => [cat, entry[cat]])
    .filter(
      (pair): pair is [ReleaseCategory, string[]] =>
        !!pair[1] && pair[1].length > 0,
    );

  return (
    <GlassPanel className={cn('p-4 space-y-3.5', isLatest && 'border border-primary/20')}>
      {/* Header — version + build + date, App Store style */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-[11px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border',
            isLatest
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-white/5 text-muted-foreground border-white/10',
          )}>
            Version {entry.version}
          </span>
          {isLatest && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
              Latest
            </span>
          )}
        </div>
        <h3 className="font-display text-lg leading-tight font-bold text-foreground tracking-tight">
          {entry.headline}
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(entry.date)}
          </span>
          <span aria-hidden className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {entry.build !== null ? `Build ${entry.build}` : 'Build pending'}
          </span>
        </div>
      </div>

      {/* Player-facing summary */}
      <p className="text-[13px] leading-relaxed text-foreground/75">
        {entry.summary}
      </p>

      {/* Categorized change sections */}
      {sections.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-white/[0.06]">
          {sections.map(([category, items]) => (
            <ChangeSection key={category} category={category} items={items} />
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

/**
 * What's New — App Store–style release notes.
 *
 * Rendered two ways:
 *   • From TitleScreen: `<WhatsNewPage standalone />` — full-screen route.
 *   • From GameShell:    `<WhatsNewPage />` — plugs into the shared shell.
 */
const WhatsNewPage = ({ standalone = false }: WhatsNewPageProps) => {
  const navigate = useNavigate();
  const setScreen = useGameStore(s => s.setScreen);
  const gameStarted = useGameStore(s => s.gameStarted);

  // Mark the current version as seen the moment the user opens the page —
  // this clears the "NEW" badge from the menu tiles on their next visit.
  useEffect(() => {
    writeWhatsNewSeenVersion(LATEST_RELEASE.version);
  }, []);

  // RELEASE_NOTES is a module-level constant — no need to memoize.
  const notes = RELEASE_NOTES;

  const handleBack = () => {
    // In-game → go back to Settings. Standalone (title screen) → try to pop
    // history, but fall back to the title route in case the user landed on
    // /whats-new directly (deep link, cold start, or refresh).
    if (!standalone && gameStarted) {
      setScreen('settings');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const content = (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      {/* Intro header */}
      <div className="flex items-center gap-2 mb-1">
        {standalone && (
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
          What&apos;s New
        </h2>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed px-1">
        Every release, big and small. New features, polish, and fixes — most
        recent at the top.
      </p>

      {/* Release cards */}
      <div className="space-y-3">
        {notes.map((entry, idx) => (
          <motion.div
            key={`${entry.version}-${entry.build ?? 'pending'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.05, 0.3), duration: 0.35, ease: 'easeOut' }}
          >
            <ReleaseCard entry={entry} isLatest={idx === 0} />
          </motion.div>
        ))}
      </div>

      {notes.length === 0 && (
        <GlassPanel className="p-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No release notes yet.</p>
        </GlassPanel>
      )}

      <p className="text-[10px] text-muted-foreground/60 text-center pt-2 pb-4">
        Updates arrive via the App Store. Restart the app to pull the latest TestFlight build.
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
