import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { DollarSign, Users, Building2, GraduationCap, TrendingUp, TrendingDown, Star, HeartPulse, Smile, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConfidenceColor, getFanConfidenceColor } from '@/utils/uiHelpers';
import { getWeeklyIncome, getNetWeeklyIncome } from '@/utils/financeHelpers';
import { FAN_MOOD_HIGH_THRESHOLD, FAN_MOOD_MID_THRESHOLD } from '@/config/ui';

const ClubPage = () => {
  const { playerClubId, clubs, players, season, boardConfidence, boardObjectives, setScreen, fanMood } = useGameStore();
  const club = clubs[playerClubId];
  if (!club) return null;

  const squad = club.playerIds.map(id => players[id]).filter(Boolean);
  const avgAge = squad.length > 0 ? (squad.reduce((s, p) => s + p.age, 0) / squad.length).toFixed(1) : '0';
  const avgOvr = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length) : 0;
  const avgMorale = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + (p.morale ?? 50), 0) / squad.length) : 50;
  const injuries = squad.filter(p => p.injured).length;
  const weeklyIncome = getWeeklyIncome(club);
  const netWeekly = getNetWeeklyIncome(club);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Club Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black" style={{ backgroundColor: club.color, color: club.secondaryColor }}>
          {club.shortName}
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground font-display">{club.name}</h2>
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
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">Fan Mood</span>
              <span className="text-muted-foreground">{fanMood}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', fanMood >= FAN_MOOD_HIGH_THRESHOLD ? 'bg-emerald-500' : fanMood >= FAN_MOOD_MID_THRESHOLD ? 'bg-amber-500' : 'bg-destructive')} style={{ width: `${fanMood}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
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
            <p className="text-2xl font-black text-foreground">£{(club.budget / 1e6).toFixed(1)}M</p>
            <p className="text-xs text-muted-foreground">Transfer Budget</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">£{(club.wageBill / 1e3).toFixed(0)}K</p>
            <p className="text-xs text-muted-foreground">Weekly Wages</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">£{(weeklyIncome / 1e3).toFixed(0)}K</p>
            <p className="text-xs text-muted-foreground">Weekly Income</p>
          </div>
          <div>
            <p className={cn('text-lg font-bold', netWeekly >= 0 ? 'text-emerald-400' : 'text-destructive')}>
              {netWeekly >= 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
              £{(Math.abs(netWeekly) / 1e3).toFixed(0)}K
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
            <p className="text-xl font-black text-foreground">{squad.length}</p>
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
        {injuries > 0 && (
          <p className="text-xs text-destructive mt-2 flex items-center gap-1"><HeartPulse className="w-3 h-3" /> {injuries} player{injuries > 1 ? 's' : ''} injured</p>
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
          {[
            { label: 'Training Ground', value: club.facilities },
            { label: 'Youth Academy', value: club.youthRating },
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
              {obj.completed && <span className="text-xs text-emerald-400">✓</span>}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default ClubPage;
