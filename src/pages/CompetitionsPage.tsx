import { useMemo, useState, lazy, Suspense } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { getActiveCompetitions } from '@/utils/competitionStatus';
import { findTournamentMatch } from '@/hooks/useGameSelectors';
import type { CompetitionKey } from '@/types/game';

// Lazy sub-pages so the hub chunk doesn't eagerly bundle all five competition
// screens — only the active tab's chunk loads. Mirrors GameShell's lazy pattern.
const LeagueTable = lazy(() => import('./LeagueTable'));
const CupPage = lazy(() => import('./CupPage'));
const LeagueCupPage = lazy(() => import('./LeagueCupPage'));
const ContinentalPage = lazy(() => import('./ContinentalPage'));
const SuperCupPage = lazy(() => import('./SuperCupPage'));

type TabKey = 'league' | CompetitionKey;

interface TabDef {
  key: TabKey;
  label: string;
  render: () => JSX.Element;
}

// Small centered spinner while a tab's lazy chunk resolves. Honors reduced
// motion via Tailwind's motion-reduce variant (same as GameShell's fallback).
const TabSuspenseFallback = () => (
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label="Loading competition"
    className="flex items-center justify-center py-16"
  >
    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin motion-reduce:animate-none" />
  </div>
);

/** Maps a findTournamentMatch competition label to the hub tab it belongs to. */
function competitionLabelToTab(label: string): CompetitionKey | null {
  switch (label) {
    case 'Dynasty Cup': return 'cup';
    case 'League Cup': return 'league-cup';
    case 'Champions Cup':
    case 'Shield Cup':
    case 'Conference Cup': return 'continental';
    case 'Super Cup':
    case 'Continental Super Cup': return 'super-cup';
    default: return null;
  }
}

const CompetitionsPage = () => {
  const ctx = useGameStore(useShallow(s => ({
    cup: s.cup,
    leagueCup: s.leagueCup,
    championsCup: s.championsCup,
    shieldCup: s.shieldCup,
    conferenceCup: s.conferenceCup,
    domesticSuperCup: s.domesticSuperCup,
    continentalSuperCup: s.continentalSuperCup,
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    virtualClubs: s.virtualClubs,
    week: s.week,
  })));

  // League is always available; the rest appear only when the player is active
  // in them this season (same presence logic the Dashboard card uses).
  const activeKeys = useMemo(() => new Set(getActiveCompetitions(ctx).map(e => e.key)), [ctx]);

  const tabs = useMemo<TabDef[]>(() => {
    const defs: TabDef[] = [
      { key: 'league', label: 'League', render: () => <LeagueTable /> },
    ];
    if (activeKeys.has('cup')) defs.push({ key: 'cup', label: 'Cup', render: () => <CupPage /> });
    if (activeKeys.has('league-cup')) defs.push({ key: 'league-cup', label: 'League Cup', render: () => <LeagueCupPage /> });
    if (activeKeys.has('continental')) defs.push({ key: 'continental', label: 'Continental', render: () => <ContinentalPage embedded /> });
    if (activeKeys.has('super-cup')) defs.push({ key: 'super-cup', label: 'Super Cup', render: () => <SuperCupPage /> });
    return defs;
  }, [activeKeys]);

  // Default to the cup that has a tie THIS week (so the hub opens on the match
  // that matters), else League. Computed once on mount — selection is local and
  // never persisted.
  const [active, setActive] = useState<TabKey>(() => {
    const tie = findTournamentMatch({
      week: ctx.week,
      playerClubId: ctx.playerClubId,
      cup: ctx.cup,
      leagueCup: ctx.leagueCup,
      championsCup: ctx.championsCup,
      shieldCup: ctx.shieldCup,
      conferenceCup: ctx.conferenceCup,
      domesticSuperCup: ctx.domesticSuperCup,
      continentalSuperCup: ctx.continentalSuperCup,
    });
    const tab = tie ? competitionLabelToTab(tie.competition) : null;
    return tab && activeKeys.has(tab) ? tab : 'league';
  });

  // Guard against a tab disappearing (e.g. eliminated mid-view) — fall back to League.
  const activeTab = tabs.some(t => t.key === active) ? active : 'league';
  const activeDef = tabs.find(t => t.key === activeTab) ?? tabs[0];

  return (
    <div className="max-w-lg mx-auto">
      {/* Horizontally scrollable tab strip — pills scroll on narrow screens. */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.28)] overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { hapticLight(); setActive(t.key); }}
              className={cn(
                'relative shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap',
                activeTab === t.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {activeTab === t.key && (
                <motion.div
                  layoutId="competitions-tab"
                  className="absolute inset-0 rounded-full bg-white/12 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.25)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active tab body — the existing page component, rendered unchanged. */}
      <Suspense fallback={<TabSuspenseFallback />}>
        {activeDef.render()}
      </Suspense>
    </div>
  );
};

export default CompetitionsPage;
