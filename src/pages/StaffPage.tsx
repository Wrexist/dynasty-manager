import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Plus, ArrowUpRight, X, Shield, Dumbbell, Heart, Search, GraduationCap, Activity, UserCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole, StaffMember } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { STAFF_HIRING_FEE_WEEKS } from '@/config/staff';

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

/** Matches actual engine formulas */
function getStatEffect(role: StaffRole, quality: number): string {
  switch (role) {
    case 'assistant-manager':
      return `+${(quality * 0.5).toFixed(1)} tactical familiarity/wk`;
    case 'first-team-coach':
      return `+${quality} training effectiveness`;
    case 'fitness-coach':
      return `+${(quality * 0.5).toFixed(1)} training effectiveness`;
    case 'goalkeeping-coach':
      return `+${(quality * 0.5).toFixed(0)}% GK development`;
    case 'scout':
      return `Unlocks 1 scouting slot`;
    case 'youth-coach':
      return `+${quality} youth prospect quality`;
    case 'physio':
      return `-${(quality * 5)}% injury risk`;
  }
}

/** Role description shown in header — not quality-dependent */
const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  'assistant-manager': 'Helps squad learn new formations',
  'first-team-coach': 'Improves all training sessions',
  'fitness-coach': 'Boosts training effectiveness',
  'goalkeeping-coach': 'Boosts goalkeeper development',
  'scout': 'Unlocks scouting assignments',
  'youth-coach': 'Stronger youth academy intake',
  'physio': 'Reduces injuries, speeds recovery',
};

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
  const [confirmReplaceId, setConfirmReplaceId] = useState<string | null>(null);

  const membersByRole: Record<string, StaffMember | undefined> = {};
  for (const m of staff.members) {
    membersByRole[m.role] = m;
  }

  const filledCount = staff.members.length;
  const totalWages = staff.members.reduce((s, m) => s + m.wage, 0);

  const handleHire = (upgrade: StaffMember, current: StaffMember | undefined) => {
    if (current) {
      setConfirmReplaceId(upgrade.id);
    } else {
      hireStaff(upgrade.id);
    }
  };

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
              <span className="text-[10px] text-muted-foreground">{'\u00A3'}{(totalWages / 1000).toFixed(0)}K/w total</span>
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
          const hiringFee = upgrade ? upgrade.wage * STAFF_HIRING_FEE_WEEKS : 0;
          const canAfford = club && club.budget >= hiringFee;
          const wageDelta = current && upgrade ? upgrade.wage - current.wage : 0;

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
                  <p className="text-[10px] text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
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
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{'\u00A3'}{(current.wage / 1000).toFixed(0)}K/w</span>
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

              {/* Vacant slot — no current holder and no hire available */}
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
                  {/* Replace confirmation */}
                  {confirmReplaceId === upgrade.id && current && (
                    <div className="mb-2 p-2 rounded bg-background/60 border border-border/40">
                      <p className="text-[10px] text-foreground font-semibold mb-1">
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Replace {current.firstName} {current.lastName} (Q{current.quality}) with {upgrade.firstName} {upgrade.lastName} (Q{upgrade.quality})?
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                        <span>Fee: {'\u00A3'}{Math.round(hiringFee / 1000)}K</span>
                        {wageDelta !== 0 && (
                          <span className={wageDelta > 0 ? 'text-destructive' : 'text-emerald-400'}>
                            {' '}({wageDelta > 0 ? '+' : ''}{'\u00A3'}{(wageDelta / 1000).toFixed(0)}K/w)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { hireStaff(upgrade.id); setConfirmReplaceId(null); }} className="text-xs text-primary font-bold py-1 px-2 min-h-[36px]">Confirm</button>
                        <button onClick={() => setConfirmReplaceId(null)} className="text-xs text-muted-foreground font-semibold py-1 px-2 min-h-[36px]">Cancel</button>
                      </div>
                    </div>
                  )}

                  {confirmReplaceId !== upgrade.id && (
                    <>
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
                          <span className="text-[10px] text-muted-foreground">{'\u00A3'}{(upgrade.wage / 1000).toFixed(0)}K/w</span>
                          <button
                            onClick={() => handleHire(upgrade, current)}
                            disabled={!canAfford}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              !canAfford
                                ? 'bg-muted/20 text-muted-foreground cursor-not-allowed'
                                : 'bg-primary/20 text-primary hover:bg-primary/30'
                            )}
                            title={!canAfford ? 'Insufficient budget' : current ? `Replace (fee: \u00A3${Math.round(hiringFee / 1000)}K)` : `Hire (fee: \u00A3${Math.round(hiringFee / 1000)}K)`}
                          >
                            {current ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
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
                        <div className="flex items-center gap-2">
                          {current && wageDelta !== 0 && (
                            <span className={cn('text-[10px]', wageDelta > 0 ? 'text-destructive' : 'text-emerald-400')}>
                              {wageDelta > 0 ? '+' : ''}{'\u00A3'}{(wageDelta / 1000).toFixed(0)}K/w
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/70">
                            Fee: {'\u00A3'}{Math.round(hiringFee / 1000)}K
                          </span>
                        </div>
                      </div>
                    </>
                  )}
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
