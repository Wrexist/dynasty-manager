import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Plus, ArrowUpRight, X, Shield, Dumbbell, Heart, Search, GraduationCap, Activity, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole, StaffMember } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';

const SQUAD_SUB_NAV = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  'assistant-manager': 'Assistant Manager',
  'first-team-coach': 'First Team Coach',
  'fitness-coach': 'Fitness Coach',
  'goalkeeping-coach': 'GK Coach',
  'scout': 'Scout',
  'youth-coach': 'Youth Coach',
  'physio': 'Physio',
};

const ROLE_ICONS: Record<StaffRole, typeof Shield> = {
  'assistant-manager': UserCheck,
  'first-team-coach': Dumbbell,
  'fitness-coach': Activity,
  'goalkeeping-coach': Shield,
  'scout': Search,
  'youth-coach': GraduationCap,
  'physio': Heart,
};

function getStatEffect(role: StaffRole, quality: number): string {
  switch (role) {
    case 'assistant-manager':
      return `+${(quality * 0.5).toFixed(1)} tactical familiarity/wk`;
    case 'first-team-coach':
      return `+${quality} training effectiveness`;
    case 'fitness-coach':
      return `+${(quality * 0.5).toFixed(1)} training boost`;
    case 'goalkeeping-coach':
      return `+${quality} GK development`;
    case 'scout':
      return `Unlocks 1 scouting slot`;
    case 'youth-coach':
      return `+${quality} youth prospect quality`;
    case 'physio':
      return `-${(quality * 5)}% injury risk`;
  }
}

function getStatEffectSecondary(role: StaffRole, quality: number): string | null {
  switch (role) {
    case 'physio':
      return quality >= 7 ? 'Chance of faster recovery' : `Recovery boost at 7+ quality`;
    case 'fitness-coach':
      return 'Boosts player fitness recovery';
    case 'assistant-manager':
      return 'Helps squad learn new formations';
    case 'first-team-coach':
      return 'Improves all training sessions';
    case 'scout':
      return 'Better scout report accuracy';
    case 'youth-coach':
      return 'Stronger youth academy intake';
    case 'goalkeeping-coach':
      return 'Boosts goalkeeper training';
    default:
      return null;
  }
}

const ALL_ROLES: StaffRole[] = [
  'assistant-manager',
  'first-team-coach',
  'fitness-coach',
  'goalkeeping-coach',
  'scout',
  'youth-coach',
  'physio',
];

const QualityBar = ({ quality, compact }: { quality: number; compact?: boolean }) => {
  const pct = (quality / 10) * 100;
  const color = quality >= 8 ? 'bg-emerald-500' : quality >= 6 ? 'bg-primary' : quality >= 4 ? 'bg-amber-500' : 'bg-muted-foreground';
  return (
    <div className={cn('flex items-center gap-2', compact ? 'w-20' : 'w-24')}>
      <div className={cn('flex-1 rounded-full overflow-hidden', compact ? 'h-1.5' : 'h-2', 'bg-muted/40')}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('font-semibold tabular-nums', compact ? 'text-[10px]' : 'text-xs', 'text-foreground')}>{quality}</span>
    </div>
  );
};

const StaffPage = () => {
  const staff = useGameStore(s => s.staff);
  const club = useGameStore(s => s.clubs[s.playerClubId]);
  const hireStaff = useGameStore(s => s.hireStaff);
  const fireStaff = useGameStore(s => s.fireStaff);
  const [confirmFireId, setConfirmFireId] = useState<string | null>(null);

  const membersByRole: Record<string, StaffMember | undefined> = {};
  for (const m of staff.members) {
    membersByRole[m.role] = m;
  }

  const filledCount = staff.members.length;
  const totalWages = staff.members.reduce((s, m) => s + m.wage, 0);

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <PageHint screen="staff" title={PAGE_HINTS.staff.title} body={PAGE_HINTS.staff.body} />
      <div className="px-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Staff</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">{filledCount}/{ALL_ROLES.length} roles filled</span>
            {totalWages > 0 && (
              <span className="text-[10px] text-muted-foreground">£{(totalWages / 1000).toFixed(0)}K/w total</span>
            )}
          </div>
        </div>

        {/* Role Slots */}
        {ALL_ROLES.map(role => {
          const current = membersByRole[role];
          const upgrade = staff.availableHires.find(h => h.role === role);
          const Icon = ROLE_ICONS[role];
          const isUpgrade = current && upgrade && upgrade.quality > current.quality;
          const isDowngrade = current && upgrade && upgrade.quality <= current.quality;

          return (
            <GlassPanel key={role} className="p-3">
              {/* Role header */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  current ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{ROLE_LABELS[role]}</p>
                  <p className="text-[10px] text-muted-foreground">{getStatEffectSecondary(role, current?.quality || 0)}</p>
                </div>
                {!current && !upgrade && (
                  <span className="text-[10px] text-muted-foreground/50 italic">Vacant</span>
                )}
              </div>

              {/* Current holder */}
              {current && (
                <div className="bg-background/40 rounded-lg p-2.5 mb-1.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {current.firstName} {current.lastName}
                      </p>
                      <QualityBar quality={current.quality} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">£{(current.wage / 1000).toFixed(0)}K/w</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-[10px] font-medium',
                      current.quality >= 7 ? 'text-emerald-400' : current.quality >= 5 ? 'text-primary' : 'text-amber-400'
                    )}>
                      {getStatEffect(role, current.quality)}
                    </span>
                    {confirmFireId === current.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { fireStaff(current.id); setConfirmFireId(null); }} className="text-xs text-destructive font-bold py-1 px-2 min-h-[36px]">Confirm</button>
                        <button onClick={() => setConfirmFireId(null)} className="text-xs text-muted-foreground font-semibold py-1 px-2 min-h-[36px]">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmFireId(current.id)}
                        className="text-[10px] text-destructive hover:text-destructive/80 font-semibold transition-colors flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" />
                        Release
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Vacant slot — no current holder */}
              {!current && !upgrade && (
                <div className="bg-background/40 rounded-lg p-4 flex items-center justify-center border border-dashed border-border/30">
                  <p className="text-xs text-muted-foreground/60">No one assigned to this role</p>
                </div>
              )}

              {/* Available hire / upgrade */}
              {upgrade && (
                <div className={cn(
                  'rounded-lg p-2.5 border',
                  isUpgrade ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-primary/5 border-primary/20'
                )}>
                  {current && isUpgrade && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-emerald-400">Upgrade Available</span>
                    </div>
                  )}
                  {current && isDowngrade && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground">Alternative Available</span>
                    </div>
                  )}
                  {!current && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[10px] font-semibold text-primary">Available to Hire</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {upgrade.firstName} {upgrade.lastName}
                      </p>
                      <QualityBar quality={upgrade.quality} compact />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">£{(upgrade.wage / 1000).toFixed(0)}K/w</span>
                      <button
                        onClick={() => hireStaff(upgrade.id)}
                        disabled={club && club.budget < upgrade.wage * 4}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          club && club.budget < upgrade.wage * 4
                            ? 'bg-muted/20 text-muted-foreground cursor-not-allowed'
                            : 'bg-primary/20 text-primary hover:bg-primary/30'
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={cn(
                      'text-[10px]',
                      upgrade.quality >= 7 ? 'text-emerald-400' : upgrade.quality >= 5 ? 'text-primary' : 'text-amber-400'
                    )}>
                      {getStatEffect(role, upgrade.quality)}
                    </span>
                    {current && isUpgrade && (
                      <span className="text-[10px] text-emerald-400">
                        vs current {current.quality}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
};

export default StaffPage;
