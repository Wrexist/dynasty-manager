import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ManagerAvatar } from '@/components/game/ManagerAvatar';
import { ReputationBadge } from '@/components/game/ReputationBadge';
import { Button } from '@/components/ui/button';
import { Trophy, Award, Calendar, Briefcase, Percent, Sparkles } from 'lucide-react';
import { calculateLegacyScore, calculateReputationTier } from '@/utils/managerCareer';
import { cn } from '@/lib/utils';

/**
 * Terminal screen for a retired career manager.
 *
 * Retirement used to just set `currentScreen: 'hall-of-managers'` — a cross-save
 * leaderboard with no recap, no acknowledgement and no way forward — while the
 * save stayed half-employed: `advanceWeek` re-entered the unemployed branch,
 * club tabs still pointed at a club the manager no longer had, and after another
 * 24 unemployed weeks the forced-retirement branch fired again and bounced the
 * player straight back here on every tick.
 *
 * This is the ending: what the career amounted to, and one clear next step.
 */
const CareerRetired = () => {
  const navigate = useNavigate();
  const careerManager = useGameStore((s) => s.careerManager);
  const seasonHistory = useGameStore((s) => s.seasonHistory);
  const setScreen = useGameStore((s) => s.setScreen);

  const stats = useMemo(() => {
    if (!careerManager) return null;
    const matches = careerManager.totalCareerMatches || 0;
    return {
      legacyScore: calculateLegacyScore(careerManager),
      winRate: matches > 0 ? Math.round((careerManager.totalCareerWins / matches) * 100) : 0,
      matches,
      seasons: seasonHistory.length,
      clubs: careerManager.careerHistory.length,
      trophies: (careerManager.titlesWon || 0) + (careerManager.cupsWon || 0),
    };
  }, [careerManager, seasonHistory.length]);

  if (!careerManager || !stats) {
    return (
      <GlassPanel className="p-6 text-center">
        <p className="text-muted-foreground">No career to report.</p>
      </GlassPanel>
    );
  }

  const initials = careerManager.name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('');
  const spells = [...careerManager.careerHistory].reverse();

  const summary = stats.trophies === 0
    ? 'A career spent in the dugout, chasing the game that never quite gave it back.'
    : stats.trophies === 1
      ? 'One trophy, and the long seasons that made it mean something.'
      : `${stats.trophies} trophies across ${stats.seasons} season${stats.seasons === 1 ? '' : 's'} in management.`;

  return (
    <div className="space-y-4 pb-6">
      <GlassPanel className="p-6 text-center">
        <div className="flex justify-center mb-3">
          <ManagerAvatar appearance={careerManager.appearance} size={96} initials={initials} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Retired</p>
        <h1 className="font-display text-2xl font-bold mt-1">
          {careerManager.name}
        </h1>
        <div className="flex justify-center mt-2">
          <ReputationBadge tier={calculateReputationTier(careerManager.reputationScore)} score={careerManager.reputationScore} size="md" />
        </div>
        <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">{summary}</p>
      </GlassPanel>

      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Legacy</h2>
        </div>
        <div className="text-center py-2">
          <p className="font-display text-4xl font-bold tabular-nums text-primary">{stats.legacyScore}</p>
          <p className="text-xs text-muted-foreground mt-1">Legacy score</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <RetiredStat icon={Trophy} label="Trophies" value={stats.trophies} />
          <RetiredStat icon={Calendar} label="Seasons" value={stats.seasons} />
          <RetiredStat icon={Briefcase} label="Clubs" value={stats.clubs} />
          <RetiredStat icon={Percent} label="Win rate" value={`${stats.winRate}%`} />
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-3 tabular-nums">
          {stats.matches} matches · {careerManager.totalCareerWins}W {careerManager.totalCareerDraws}D {careerManager.totalCareerLosses}L
        </p>
      </GlassPanel>

      {spells.length > 0 && (
        <GlassPanel className="p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider mb-3">The Spells</h2>
          <div className="space-y-2">
            {spells.map((spell, i) => (
              <div
                key={`${spell.clubId}-${spell.startSeason}-${i}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/20"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{spell.clubName}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    S{spell.startSeason}–{spell.endSeason ?? '·'}
                    {spell.titlesWon > 0 && ` · ${spell.titlesWon} title${spell.titlesWon === 1 ? '' : 's'}`}
                  </p>
                </div>
                {spell.reason && (
                  <span className={cn(
                    'text-[10px] uppercase tracking-wider shrink-0',
                    spell.reason === 'sacked' ? 'text-destructive' : 'text-muted-foreground',
                  )}>
                    {spell.reason.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {careerManager.awardsWon.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">Individual Honours</h2>
          </div>
          <p className="text-sm tabular-nums">
            {careerManager.awardsWon.length} Manager of the Season award
            {careerManager.awardsWon.length === 1 ? '' : 's'}
          </p>
        </GlassPanel>
      )}

      <div className="space-y-2">
        <Button className="w-full h-12 rounded-xl text-base font-bold" onClick={() => navigate('/create-manager')}>
          Start a New Career
        </Button>
        <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => setScreen('hall-of-managers')}>
          Hall of Fame
        </Button>
        <Button variant="ghost" className="w-full h-11 rounded-xl" onClick={() => navigate('/')}>
          Main Menu
        </Button>
      </div>
    </div>
  );
};

function RetiredStat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-muted/20 text-center">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
      <p className="font-display text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

export default CareerRetired;
