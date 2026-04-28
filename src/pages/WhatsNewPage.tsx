import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { useGameStore } from '@/store/gameStore';
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

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ReleaseCard({ entry, isLatest }: { entry: ReleaseNote; isLatest: boolean }) {
  // Flatten every category into a single bullet list — players don't need
  // the Highlights / New / Improved / Fixed split to scan a release.
  const bullets = CATEGORY_ORDER.flatMap(cat => entry[cat] ?? []);

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

      {bullets.length > 0 && (
        <ul className="space-y-1 pl-3">
          {bullets.map((item, i) => (
            <li
              key={i}
              className="text-[12px] leading-snug text-foreground/85 relative before:content-['•'] before:absolute before:-left-3 before:text-primary/60"
            >
              {item}
            </li>
          ))}
        </ul>
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
  const navigate = useNavigate();
  const setScreen = useGameStore(s => s.setScreen);
  const gameStarted = useGameStore(s => s.gameStarted);

  useEffect(() => {
    writeWhatsNewSeenVersion(LATEST_RELEASE.version);
  }, []);

  const notes = RELEASE_NOTES;

  const handleBack = () => {
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
    <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        {standalone && (
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Back"
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
