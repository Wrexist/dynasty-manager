import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ClubCrest } from '@/components/game/ClubCrest';
import { DollarSign, Users, Building2, GraduationCap, TrendingUp, TrendingDown, Star, HeartPulse, Smile, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConfidenceColor, getFanConfidenceColor } from '@/utils/uiHelpers';
import { useFinanceBreakdown } from '@/hooks/useFinanceBreakdown';
import { FAN_MOOD_HIGH_THRESHOLD, FAN_MOOD_MID_THRESHOLD } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { PremiumCheck } from '@/components/game/icons/PremiumCheck';
import { useSquadSummary } from '@/hooks/useGameSelectors';
import { formatMoney } from '@/utils/helpers';
import { SectionHeader } from '@/components/game/SectionHeader';

const ClubPage = () => {
  const { t } = useTranslation();
  const { playerClubId, clubs, season, boardConfidence, boardObjectives, fanMood, facilities } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    season: s.season,
    boardConfidence: s.boardConfidence,
    boardObjectives: s.boardObjectives,
    fanMood: s.fanMood,
    facilities: s.facilities,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  // One-pass selector for all 5 squad stats. Runs unconditionally (Rules of
  // Hooks) — returns neutral values when the club is missing so the early
  // return below still applies to render.
  const { size, avgAge, avgOvr, avgMorale, injured } = useSquadSummary();
  const { breakdown } = useFinanceBreakdown();
  const club = clubs[playerClubId];
  if (!club) return null;

  // Full breakdown (matches the Finance page + breakdown sheet) rather than the
  // simplified matchday+commercial estimate, so figures are consistent across screens.
  const weeklyIncome = breakdown?.totalIncome ?? 0;
  const netWeekly = breakdown?.net ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint
        screen="club"
        title={t('clubPage.clubOverview')}
        body={t('clubPage.yourClubAtAGlance')}
      />

      {/* Club Header */}
      <div className="flex items-center gap-4">
        <ClubCrest club={club} size="xl" shape="squircle" />
        <div>
          <SectionHeader title={club.name} />
          <p className="text-sm text-muted-foreground flex items-center gap-1">Season {season} • {Array.from({ length: club.reputation }).map((_, i) => <Star key={i} className="w-3 h-3 fill-primary text-primary inline" />)}</p>
        </div>
      </div>

      {/* Fan Mood & Atmosphere */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Smile className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Fan Mood & Atmosphere</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={cn('text-2xl font-black tabular-nums', getFanConfidenceColor(fanMood))}>
              {fanMood}%
            </p>
            <p className="text-xs text-muted-foreground">
              {fanMood >= FAN_MOOD_HIGH_THRESHOLD ? 'Buzzing' : fanMood >= FAN_MOOD_MID_THRESHOLD ? 'Content' : 'Restless'}
            </p>
          </div>
          <div>
            <p className={cn('text-2xl font-black tabular-nums', avgMorale > 70 ? 'text-emerald-400' : avgMorale > 40 ? 'text-amber-400' : 'text-destructive')}>
              {avgMorale}%
            </p>
            <p className="text-xs text-muted-foreground">Squad Morale</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div>
            <div className="flex justify-between text-micro mb-0.5">
              <span className="text-muted-foreground">Fan Mood</span>
              <span className="text-muted-foreground">{fanMood}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', fanMood >= FAN_MOOD_HIGH_THRESHOLD ? 'bg-emerald-500' : fanMood >= FAN_MOOD_MID_THRESHOLD ? 'bg-amber-500' : 'bg-destructive')} style={{ width: `${fanMood}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-micro mb-0.5">
              <span className="text-muted-foreground">Squad Morale</span>
              <span className="text-muted-foreground">{avgMorale}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', avgMorale > 70 ? 'bg-emerald-500' : avgMorale > 40 ? 'bg-amber-500' : 'bg-destructive')} style={{ width: `${avgMorale}%` }} />
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Finances */}
      <GlassPanel className="p-4" onClick={() => setScreen('finance')} aria-label="View finances">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Finances</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-black text-foreground tabular-nums">{formatMoney(club.budget)}</p>
            <p className="text-xs text-muted-foreground">Transfer Budget</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tabular-nums">{formatMoney(club.wageBill)}</p>
            <p className="text-xs text-muted-foreground">Weekly Wages</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tabular-nums">{formatMoney(weeklyIncome)}</p>
            <p className="text-xs text-muted-foreground">Weekly Income</p>
          </div>
          <div>
            <p className={cn('text-lg font-bold tabular-nums', netWeekly >= 0 ? 'text-emerald-400' : 'text-destructive')}>
              {netWeekly >= 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
              {formatMoney(netWeekly, { signed: true })}
            </p>
            <p className="text-xs text-muted-foreground">Net per Week</p>
          </div>
        </div>
      </GlassPanel>

      {/* Squad Summary */}
      <GlassPanel className="p-4" onClick={() => setScreen('squad')} aria-label="View squad">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Squad</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-black text-foreground">{size}</p>
            <p className="text-xs text-muted-foreground">Players</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{avgOvr}</p>
            <p className="text-xs text-muted-foreground">Avg OVR</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{avgAge}</p>
            <p className="text-xs text-muted-foreground">Avg Age</p>
          </div>
        </div>
        {injured > 0 && (
          <p className="text-xs text-destructive mt-2 flex items-center gap-1"><HeartPulse className="w-3 h-3" /> {injured} player{injured > 1 ? 's' : ''} injured</p>
        )}
      </GlassPanel>

      {/* Facilities */}
      <GlassPanel className="p-4" onClick={() => setScreen('facilities')} aria-label="View facilities">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Facilities</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          {/* Read the facilities slice, not the static club fields — upgrades
              write only to the slice, so club.facilities/youthRating freeze at
              their day-one values. */}
          {[
            { label: 'Training Ground', value: facilities.trainingLevel },
            { label: 'Youth Academy', value: facilities.youthLevel },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-sm text-foreground flex-1">{f.label}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={cn('w-2 h-4 rounded-sm', i < f.value ? 'bg-primary' : 'bg-muted/50')} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground w-6 text-right">{f.value}/10</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Board */}
      <GlassPanel className="p-4" onClick={() => setScreen('board')} aria-label="View board room">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Board</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-foreground">Confidence</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', getConfidenceColor(boardConfidence).bgClass)} style={{ width: `${boardConfidence}%` }} />
          </div>
          <span className="text-sm font-bold text-foreground">{boardConfidence}%</span>
        </div>
        <div className="space-y-1.5">
          {boardObjectives.map(obj => (
            <div key={obj.id} className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full', obj.priority === 'critical' ? 'bg-destructive' : obj.priority === 'important' ? 'bg-primary' : 'bg-muted-foreground')} />
              <span className="text-xs text-muted-foreground">{obj.description}</span>
              {obj.completed && <PremiumCheck className="w-3 h-3 text-emerald-400" />}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default ClubPage;
