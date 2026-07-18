import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Flame, Swords, Calendar, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deriveRivals } from '@/utils/rivalries';
import type { RivalSummary } from '@/types/game';

/** Row of 1-5 flames representing grudge level (dimmed when unlit). */
function GrudgeFlames({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Grudge level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Flame
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i <= level ? 'text-orange-400 fill-orange-400/80' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

function streakLabel(streak: RivalSummary['streak']): { text: string; cls: string } | null {
  if (!streak || streak.count === 0) return null;
  const map = {
    W: { text: `${streak.count}W streak`, cls: 'text-emerald-400' },
    L: { text: `${streak.count}L streak`, cls: 'text-destructive' },
    D: { text: `${streak.count}D run`, cls: 'text-amber-400' },
  } as const;
  return map[streak.type];
}

function RivalCard({ rival }: { rival: RivalSummary }) {
  const streak = streakLabel(rival.streak);
  // Dominance bar: green share = wins, red share = losses (of decisive games).
  const winPct = Math.round(rival.dominance * 100);

  return (
    <GlassPanel className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
          style={{ backgroundColor: rival.color, color: rival.secondaryColor }}
        >
          {rival.shortName}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{rival.name}</p>
          {rival.derbyName ? (
            <p className="text-[11px] font-semibold text-orange-400 truncate">{rival.derbyName}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{rival.meetings} meeting{rival.meetings === 1 ? '' : 's'}</p>
          )}
        </div>
        <GrudgeFlames level={rival.grudgeLevel} />
      </div>

      {/* Head-to-head record */}
      <div className="flex items-center gap-3 text-xs font-semibold">
        <span className="text-emerald-400">{rival.wins}W</span>
        <span className="text-amber-400">{rival.draws}D</span>
        <span className="text-destructive">{rival.losses}L</span>
        {streak && <span className={cn('ml-auto', streak.cls)}>{streak.text}</span>}
      </div>

      {/* Dominance bar */}
      <div>
        <div className="h-2 rounded-full overflow-hidden bg-muted/30 flex">
          <div className="bg-emerald-500/80 h-full" style={{ width: `${winPct}%` }} />
          <div className="bg-destructive/70 h-full" style={{ width: `${100 - winPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            {rival.wins + rival.losses > 0 ? `${winPct}% dominance` : 'Not yet met'}
          </span>
          {rival.nextMeetingWeek != null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
              <Calendar className="w-3 h-3" /> Next: Week {rival.nextMeetingWeek}
            </span>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

const RivalriesPage = () => {
  const { playerClubId, clubs, rivalries, fixtures, week } = useGameStore(
    useShallow(s => ({
      playerClubId: s.playerClubId,
      clubs: s.clubs,
      rivalries: s.rivalries,
      fixtures: s.fixtures,
      week: s.week,
    })),
  );

  const rivals = useMemo(
    () => deriveRivals({ playerClubId, clubs, rivalries, fixtures, currentWeek: week }),
    [playerClubId, clubs, rivalries, fixtures, week],
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Swords className="w-5 h-5 text-orange-400" />
        <div>
          <h1 className="text-lg font-display font-bold text-foreground tracking-wide">Rivalries</h1>
          <p className="text-xs text-muted-foreground">Derbies and grudge matches</p>
        </div>
      </div>

      {rivals.length === 0 ? (
        <GlassPanel className="p-6 text-center space-y-2">
          <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No rivalries yet</p>
          <p className="text-xs text-muted-foreground">
            Rivalries build as you play derbies and repeat opponents.
          </p>
        </GlassPanel>
      ) : (
        rivals.map(rival => <RivalCard key={rival.clubId} rival={rival} />)
      )}
    </div>
  );
};

export default RivalriesPage;
