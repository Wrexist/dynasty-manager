import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ManagerStatBar } from '@/components/game/ManagerStatBar';
import { ReputationBadge } from '@/components/game/ReputationBadge';
import { Button } from '@/components/ui/button';
import { User, Trophy, Briefcase, Calendar, Award, LogOut, TrendingUp, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MANAGER_TRAITS } from '@/config/managerCareer';
import { calculateLegacyScore, getRetirementAge } from '@/utils/managerCareer';
import { getSpecializationTitle } from '@/utils/managerPerks';

const CareerOverview = () => {
  const { careerManager, setScreen, resignFromClub, managerProgression } = useGameStore();

  if (!careerManager) {
    return (
      <GlassPanel className="p-6 text-center">
        <p className="text-muted-foreground">Career mode is not active.</p>
      </GlassPanel>
    );
  }

  const legacyScore = calculateLegacyScore(careerManager);
  const specTitle = getSpecializationTitle(managerProgression);
  const retirementAge = getRetirementAge(careerManager);
  const seasonsLeft = retirementAge - careerManager.age;
  const winRate = careerManager.totalCareerMatches > 0
    ? Math.round((careerManager.totalCareerWins / careerManager.totalCareerMatches) * 100)
    : 0;

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign? You will enter the job market.')) {
      resignFromClub();
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Manager Header */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{careerManager.name}</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Age {careerManager.age} — {careerManager.nationality}
              </p>
              {specTitle && (
                <span className="text-[9px] font-bold text-primary italic">{specTitle}</span>
              )}
            </div>
          </div>
          <ReputationBadge tier={careerManager.reputationTier} score={Math.round(careerManager.reputationScore)} size="md" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-muted/20 rounded-lg py-2">
            <p className="text-sm font-bold text-foreground">{careerManager.totalCareerMatches}</p>
            <p className="text-[9px] text-muted-foreground">Matches</p>
          </div>
          <div className="bg-muted/20 rounded-lg py-2">
            <p className="text-sm font-bold text-emerald-400">{winRate}%</p>
            <p className="text-[9px] text-muted-foreground">Win Rate</p>
          </div>
          <div className="bg-muted/20 rounded-lg py-2">
            <p className="text-sm font-bold text-primary">{careerManager.titlesWon}</p>
            <p className="text-[9px] text-muted-foreground">Titles</p>
          </div>
          <div className="bg-muted/20 rounded-lg py-2">
            <p className="text-sm font-bold text-amber-400">{legacyScore}</p>
            <p className="text-[9px] text-muted-foreground">Legacy</p>
          </div>
        </div>
      </GlassPanel>

      {/* Contract */}
      {careerManager.contract && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Current Contract</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Salary: </span>
              <span className="text-foreground font-semibold">£{(careerManager.contract.salary / 1000).toFixed(1)}k/wk</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expires: </span>
              <span className="text-foreground font-semibold">End of Season {careerManager.contract.endSeason}</span>
            </div>
          </div>
          {careerManager.contract.bonuses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {careerManager.contract.bonuses.map((b, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded font-semibold',
                    b.met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/30 text-muted-foreground'
                  )}
                >
                  {b.condition.replace('_', ' ')}: £{(b.amount / 1000).toFixed(0)}k {b.met ? '✓' : ''}
                </span>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Manager Attributes */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Manager Attributes</h3>
        </div>
        <div className="space-y-3">
          {([
            ['Tactical Knowledge', careerManager.attributes.tacticalKnowledge, 'Boosts tactical familiarity gain rate'],
            ['Motivation', careerManager.attributes.motivation, 'Amplifies squad morale from results & talks'],
            ['Negotiation', careerManager.attributes.negotiation, 'Reduces transfer fees when buying players'],
            ['Scouting Eye', careerManager.attributes.scoutingEye, 'Speeds up scouting assignments'],
            ['Youth Development', careerManager.attributes.youthDevelopment, 'Boosts youth prospect growth rate'],
            ['Discipline', careerManager.attributes.discipline, 'Reduces card probability in matches'],
            ['Media Handling', careerManager.attributes.mediaHandling, 'Amplifies press conference effects'],
          ] as [string, number, string][]).map(([label, value, desc]) => (
            <div key={label}>
              <ManagerStatBar label={label} value={value} />
              <p className="text-[9px] text-muted-foreground/60 italic mt-0.5 pl-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Talent Tree Quick Access */}
      <Button
        variant="outline"
        className="w-full h-11 gap-2 border-primary/30 text-primary hover:bg-primary/10"
        onClick={() => setScreen('perks')}
      >
        <GitBranch className="w-4 h-4" /> Talent Tree
      </Button>

      {/* Traits */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Traits</h3>
        </div>
        <div className="space-y-2">
          {careerManager.traits.map(traitId => {
            const trait = MANAGER_TRAITS[traitId];
            if (!trait) return null;
            return (
              <div key={traitId} className="bg-muted/20 rounded-lg p-2.5">
                <p className="text-xs font-bold text-primary">{trait.name}</p>
                <p className="text-[10px] text-muted-foreground italic">{trait.passiveEffect}</p>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Career History */}
      {careerManager.careerHistory.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Career History</h3>
          </div>
          <div className="space-y-2">
            {[...careerManager.careerHistory].reverse().map((entry, idx) => (
              <div key={idx} className="bg-muted/20 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{entry.clubName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Season {entry.startSeason}{entry.endSeason ? ` — ${entry.endSeason}` : ' — Present'}
                  </p>
                </div>
                <div className="text-right">
                  {entry.bestFinish > 0 && (
                    <p className="text-[10px] text-muted-foreground">Best: {entry.bestFinish}th</p>
                  )}
                  {entry.reason !== 'hired' && entry.endSeason && (
                    <span className={cn(
                      'text-[9px] font-semibold capitalize',
                      entry.reason === 'sacked' ? 'text-red-400' : entry.reason === 'moved' ? 'text-blue-400' : entry.reason === 'contract_expired' ? 'text-amber-400' : 'text-muted-foreground'
                    )}>
                      {entry.reason === 'contract_expired' ? 'expired' : entry.reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Awards */}
      {careerManager.awardsWon.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Awards ({careerManager.awardsWon.length})</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {careerManager.awardsWon.map((award, idx) => (
              <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-semibold">
                {award.type === 'manager_of_month' ? 'MOTM' : 'MOTY'} S{award.season}
              </span>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Retirement Info */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground">
          Retirement age: {retirementAge} — {seasonsLeft > 0 ? `${seasonsLeft} seasons remaining` : 'Retirement imminent'}
        </p>
      </GlassPanel>

      {/* Resign Button */}
      {careerManager.contract && (
        <Button
          variant="outline"
          className="w-full h-11 gap-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
          onClick={handleResign}
        >
          <LogOut className="w-4 h-4" /> Resign from Club
        </Button>
      )}
    </div>
  );
};

export default CareerOverview;
