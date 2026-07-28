import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import {
  Plus, ArrowUpRight, X, Shield, Dumbbell, Heart, Search, GraduationCap, Activity,
  UserCheck, RefreshCw, FileText, Sparkles, Clock, AlertTriangle,
  MessageSquare, Smile, Frown, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole, StaffMember, StaffTrait } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import {
  STAFF_HIRING_FEE_WEEKS, STAFF_INTERACTION_COOLDOWN, STAFF_MARKET_REFRESH_FEE,
  STAFF_MARKET_REFRESH_COOLDOWN, STAFF_RENEWAL_FEE_WEEKS, STAFF_RENEWAL_COOLDOWN,
} from '@/config/staff';
import { getEffectiveQuality, getMoraleMultiplier, getTraitLabel, getTraitDescription, absWeek } from '@/utils/staff';
import { successToast, infoToast, errorToast } from '@/utils/gameToast';
import { hapticLight } from '@/utils/haptics';

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

/** Effective-quality based stat effect (factors morale + traits). */
function getStatEffect(role: StaffRole, effective: number): string {
  const q = effective;
  switch (role) {
    case 'assistant-manager':
      return `+${(q * 0.5).toFixed(1)} tactical familiarity/wk`;
    case 'first-team-coach':
      return `+${q.toFixed(1)} training effectiveness`;
    case 'fitness-coach':
      return `+${(q * 0.5).toFixed(1)} training effectiveness`;
    case 'goalkeeping-coach':
      return `+${(q * 0.5).toFixed(0)}% GK development`;
    case 'scout':
      return `Unlocks 1 scouting slot`;
    case 'youth-coach':
      return `+${q.toFixed(1)} youth prospect quality`;
    case 'physio':
      return `-${(q * 5).toFixed(0)}% injury risk`;
  }
}

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
  const tone = quality >= 8 ? 'emerald' : quality >= 6 ? 'primary' : quality >= 4 ? 'amber' : 'rose';
  return (
    <div className={cn('flex items-center gap-2', compact ? 'w-20' : 'w-24')}>
      <PremiumProgress
        className="flex-1"
        size={compact ? 'sm' : 'md'}
        tone={tone}
        animate={false}
        value={pct}
      />
      <span className={cn('font-semibold tabular-nums', compact ? 'text-[10px]' : 'text-xs', 'text-foreground')}>{quality}</span>
    </div>
  );
};

const MoraleDot = ({ morale }: { morale: number }) => {
  const tone =
    morale >= 75 ? 'bg-emerald-500'
    : morale >= 50 ? 'bg-primary'
    : morale >= 30 ? 'bg-amber-500'
    : 'bg-destructive';
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full ring-1 ring-white/25 shadow-lg',
        tone,
      )}
    />
  );
};

const MoraleBar = ({ morale }: { morale: number }) => {
  const pct = Math.max(0, Math.min(100, morale));
  const tone = pct >= 75 ? 'emerald' : pct >= 50 ? 'primary' : pct >= 30 ? 'amber' : 'rose';
  return (
    <div className="flex items-center gap-1.5 w-16">
      <PremiumProgress className="flex-1" size="sm" tone={tone} animate={false} value={pct} />
      <span className="text-[9px] text-muted-foreground tabular-nums w-5 text-right">{Math.round(pct)}</span>
    </div>
  );
};

const TRAIT_TONE: Record<StaffTrait, string> = {
  tactician: 'bg-primary/15 text-primary border-primary/25',
  motivator: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  talent_spotter: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  innovator: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  disciplinarian: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  veteran: 'bg-muted/40 text-muted-foreground border-border/40',
  rising_star: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
};

const TraitChip = ({ trait }: { trait: StaffTrait }) => (
  <span
    className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', TRAIT_TONE[trait])}
    title={getTraitDescription(trait)}
  >
    {getTraitLabel(trait)}
  </span>
);

const StaffPage = () => {
  const { staff, club, week, season } = useGameStore(useShallow(s => ({
    staff: s.staff,
    club: s.clubs[s.playerClubId],
    week: s.week,
    season: s.season,
  })));
  const hireStaff = useGameStore(s => s.hireStaff);
  const fireStaff = useGameStore(s => s.fireStaff);
  const praiseStaff = useGameStore(s => s.praiseStaff);
  const criticizeStaff = useGameStore(s => s.criticizeStaff);
  const renewStaffContract = useGameStore(s => s.renewStaffContract);
  const refreshStaffMarket = useGameStore(s => s.refreshStaffMarket);

  const [confirmFireId, setConfirmFireId] = useState<string | null>(null);
  const [confirmReplaceId, setConfirmReplaceId] = useState<string | null>(null);
  const [expandedTraitsId, setExpandedTraitsId] = useState<string | null>(null);
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);

  const membersByRole: Record<string, StaffMember | undefined> = {};
  for (const m of staff.members) {
    membersByRole[m.role] = m;
  }

  const filledCount = staff.members.length;
  const totalWages = staff.members.reduce((s, m) => s + m.wage, 0);
  const avgMorale = staff.members.length
    ? Math.round(staff.members.reduce((s, m) => s + (m.morale ?? 70), 0) / staff.members.length)
    : 0;

  const refreshSameSeason = staff.lastMarketRefreshSeason === season;
  const weeksSinceRefresh = refreshSameSeason ? week - (staff.lastMarketRefreshWeek ?? -99) : 99;
  const refreshCooldown = Math.max(0, STAFF_MARKET_REFRESH_COOLDOWN - weeksSinceRefresh);
  const refreshAvailable = refreshCooldown <= 0 && (club?.budget ?? 0) >= STAFF_MARKET_REFRESH_FEE;

  // `hireStaff` no-ops when the club can't cover the signing fee, so the toast
  // must follow the result — never fire unconditionally.
  const runHire = (staffId: string) => {
    const r = hireStaff(staffId);
    if (r.success) successToast('Staff Hired', r.message);
    else errorToast(r.message);
  };

  const handleHire = (upgrade: StaffMember, current: StaffMember | undefined) => {
    hapticLight();
    if (current) {
      setConfirmReplaceId(upgrade.id);
    } else {
      runHire(upgrade.id);
    }
  };

  const handlePraise = (m: StaffMember) => {
    hapticLight();
    const r = praiseStaff(m.id);
    if (r.success) successToast('Praised', r.message);
    else infoToast('Not now', r.message);
  };

  const handleCriticize = (m: StaffMember) => {
    hapticLight();
    const r = criticizeStaff(m.id);
    if (r.success) infoToast('Words had', r.message);
    else infoToast('Not now', r.message);
  };

  const handleRenew = (m: StaffMember) => {
    hapticLight();
    const r = renewStaffContract(m.id);
    if (r.success) successToast('Renewed', r.message);
    else errorToast(r.message);
  };

  const handleRefreshMarket = () => {
    hapticLight();
    const r = refreshStaffMarket();
    if (r.success) successToast('Candidates Found', r.message);
    else errorToast(r.message);
  };

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="staff" title={PAGE_HINTS.staff.title} body={PAGE_HINTS.staff.body} />
      <div className="px-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Staff</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">{filledCount}/{ALL_ROLES.length} roles</span>
            {totalWages > 0 && (
              <span className="text-[10px] text-muted-foreground">{'£'}{(totalWages / 1000).toFixed(0)}K/w</span>
            )}
          </div>
        </div>

        {/* Backroom mood + market refresh */}
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Backroom Mood</p>
                <div className="flex items-center gap-2">
                  <p className={cn(
                    'text-sm font-bold tabular-nums',
                    avgMorale >= 75 ? 'text-emerald-400' : avgMorale >= 50 ? 'text-primary' : avgMorale >= 30 ? 'text-amber-400' : 'text-destructive',
                  )}>{avgMorale}</p>
                  <span className="text-[10px] text-muted-foreground">avg morale</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefreshMarket}
              disabled={!refreshAvailable}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all min-h-[36px]',
                refreshAvailable
                  ? 'bg-primary/15 text-primary hover:bg-primary/25 active:scale-[0.97]'
                  : 'bg-muted/20 text-muted-foreground cursor-not-allowed',
              )}
              title={refreshCooldown > 0 ? `Available in ${refreshCooldown}w` : `Cost: £${Math.round(STAFF_MARKET_REFRESH_FEE / 1000)}K`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {refreshCooldown > 0 ? `${refreshCooldown}w cooldown` : `Scout candidates · £${Math.round(STAFF_MARKET_REFRESH_FEE / 1000)}K`}
            </button>
          </div>
        </GlassPanel>

        {/* Role Slots */}
        {ALL_ROLES.map(role => {
          const current = membersByRole[role];
          const upgrade = staff.availableHires.find(h => h.role === role);
          const Icon = ROLE_ICONS[role];
          const currentEffective = current ? getEffectiveQuality(current) : 0;
          const upgradeEffective = upgrade ? getEffectiveQuality(upgrade) : 0;
          const isUpgrade = current && upgrade && upgradeEffective > currentEffective;
          const isDowngrade = current && upgrade && upgradeEffective <= currentEffective;
          const hiringFee = upgrade ? upgrade.wage * STAFF_HIRING_FEE_WEEKS : 0;
          const canAfford = club && club.budget >= hiringFee;
          const wageDelta = current && upgrade ? upgrade.wage - current.wage : 0;

          // Current member derived state
          const currentMorale = current?.morale ?? 70;
          const currentContractYears = current?.contractYearsRemaining ?? 0;
          // Warn when this is the member's last full season — i.e. one more
          // season-end tick will take them to 0 and they'll walk.
          const expiringSoon = current ? currentContractYears <= 1 : false;
          const nowAbs = absWeek(season, week);
          const lastInteract = current?.lastInteractionWeek ?? -99;
          const interactCooldown = Math.max(0, STAFF_INTERACTION_COOLDOWN - (nowAbs - lastInteract));
          const interactReady = interactCooldown <= 0;
          const lastRenew = current?.lastRenewalWeek ?? -99;
          const renewCooldown = Math.max(0, STAFF_RENEWAL_COOLDOWN - (nowAbs - lastRenew));
          const renewFee = current ? Math.round(current.wage * STAFF_RENEWAL_FEE_WEEKS) : 0;
          const canRenew = current && renewCooldown <= 0 && (club?.budget ?? 0) >= renewFee;
          const moraleMult = getMoraleMultiplier(currentMorale);
          const traitsExpanded = current && expandedTraitsId === current.id;

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
                <div className="bg-background/40 rounded-lg p-2.5 mb-1.5 space-y-2">
                  {/* Name + base / effective quality */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {current.firstName} {current.lastName}
                      </p>
                      <QualityBar quality={current.quality} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{'£'}{(current.wage / 1000).toFixed(0)}K/w</span>
                  </div>

                  {/* Traits */}
                  {(current.traits && current.traits.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {current.traits.map(t => <TraitChip key={t} trait={t} />)}
                      <button
                        type="button"
                        onClick={() => setExpandedTraitsId(traitsExpanded ? null : current.id)}
                        aria-label={traitsExpanded ? 'Hide trait descriptions' : 'Show trait descriptions'}
                        className="ml-0.5 p-0.5 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {traitsExpanded && current.traits && (
                    <div className="text-[10px] text-muted-foreground/80 leading-relaxed bg-muted/10 rounded p-2 space-y-1">
                      {current.traits.map(t => (
                        <p key={t}><span className="font-semibold text-foreground">{getTraitLabel(t)}.</span> {getTraitDescription(t)}</p>
                      ))}
                    </div>
                  )}

                  {/* Morale + Have-a-word button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MoraleDot morale={currentMorale} />
                      <span className="text-[10px] text-muted-foreground">Morale</span>
                      <MoraleBar morale={currentMorale} />
                      <span className={cn(
                        'text-[10px] font-medium tabular-nums shrink-0',
                        moraleMult >= 1.05 ? 'text-emerald-400' : moraleMult <= 0.95 ? 'text-amber-400' : 'text-muted-foreground',
                      )}>
                        {moraleMult >= 1 ? '+' : ''}{Math.round((moraleMult - 1) * 100)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatOpenId(chatOpenId === current.id ? null : current.id)}
                      disabled={!interactReady}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all min-h-[28px] shrink-0',
                        interactReady
                          ? 'bg-primary/15 text-primary hover:bg-primary/25 active:scale-[0.97]'
                          : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed',
                      )}
                      title={interactReady ? 'Have a word with this staff member' : `Cooldown: ${interactCooldown}w`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      {interactReady ? 'Have a word' : `${interactCooldown}w`}
                    </button>
                  </div>

                  {/* Inline praise/criticise picker */}
                  {chatOpenId === current.id && interactReady && (
                    <div className="flex items-center gap-1.5 bg-muted/10 rounded-md p-1.5">
                      <button
                        type="button"
                        onClick={() => { handlePraise(current); setChatOpenId(null); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 active:scale-[0.97] transition-all min-h-[36px]"
                      >
                        <Smile className="w-3.5 h-3.5" />
                        Praise <span className="text-emerald-400/80 font-normal">· +morale</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleCriticize(current); setChatOpenId(null); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:scale-[0.97] transition-all min-h-[36px]"
                      >
                        <Frown className="w-3.5 h-3.5" />
                        Criticise <span className="text-amber-400/80 font-normal">· −morale</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatOpenId(null)}
                        aria-label="Close"
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors min-h-[36px] min-w-[36px]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Effective stat line */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-[10px] font-medium',
                      currentEffective >= 7 ? 'text-emerald-400' : currentEffective >= 5 ? 'text-primary' : 'text-amber-400'
                    )}>
                      {getStatEffect(role, currentEffective)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                      Effective {currentEffective.toFixed(1)}
                    </span>
                  </div>

                  {/* Performance summary */}
                  {current.performance && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/80 border-t border-border/30 pt-1.5">
                      {(current.seasonsAtClub ?? 0) > 0 && (
                        <span>
                          <span className="text-foreground/80 font-semibold tabular-nums">{current.seasonsAtClub}</span>
                          {' '}{current.seasonsAtClub === 1 ? 'season' : 'seasons'} at club
                        </span>
                      )}
                      {role === 'youth-coach' && (
                        <span>
                          <span className="text-foreground/80 font-semibold tabular-nums">{current.performance.youthPromotions}</span>
                          {' '}youth promoted
                        </span>
                      )}
                      {role === 'scout' && (
                        <span>
                          <span className="text-foreground/80 font-semibold tabular-nums">{current.performance.scoutFinds}</span>
                          {' '}scout reports
                        </span>
                      )}
                      {role === 'physio' && (
                        <span>
                          <span className="text-foreground/80 font-semibold tabular-nums">{current.performance.injuriesPrevented}</span>
                          {' '}injuries averted
                        </span>
                      )}
                      {(role === 'first-team-coach' || role === 'fitness-coach' || role === 'goalkeeping-coach' || role === 'assistant-manager') && (
                        <span>
                          <span className="text-foreground/80 font-semibold tabular-nums">{current.performance.trainingGains}</span>
                          {' '}player improvements
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contract row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <FileText className="w-3 h-3 text-muted-foreground/70" />
                      {expiringSoon ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Expires next season
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Contract: {currentContractYears}y</span>
                      )}
                    </div>
                    {confirmFireId === current.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { fireStaff(current.id); setConfirmFireId(null); infoToast('Staff Released', `${current.firstName} ${current.lastName} has left the club`); }}
                          className="text-xs text-destructive font-bold py-1 px-2 min-h-[36px]"
                        >
                          Confirm
                        </button>
                        <button type="button" onClick={() => setConfirmFireId(null)} className="text-xs text-muted-foreground font-semibold py-1 px-2 min-h-[36px]">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRenew(current)}
                          disabled={!canRenew}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all min-h-[32px]',
                            canRenew ? 'bg-primary/15 text-primary hover:bg-primary/25 active:scale-[0.97]' : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed',
                          )}
                          title={renewCooldown > 0 ? `Renewal cooldown ${renewCooldown}w` : `Renew · £${Math.round(renewFee / 1000)}K`}
                        >
                          {renewCooldown > 0 ? <Clock className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {expiringSoon ? 'Renew now' : renewCooldown > 0 ? `${renewCooldown}w` : 'Renew'}
                        </button>
                        <button
                          onClick={() => setConfirmFireId(current.id)}
                          className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.94] transition-all min-h-[32px] min-w-[32px]"
                          title="Release"
                          aria-label={`Release ${current.firstName} ${current.lastName}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vacant slot */}
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
                  {confirmReplaceId === upgrade.id && current && (
                    <div className="mb-2 p-2 rounded bg-background/60 border border-border/40">
                      <p className="text-[10px] text-foreground font-semibold mb-1">
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Replace {current.firstName} {current.lastName} (Q{current.quality}) with {upgrade.firstName} {upgrade.lastName} (Q{upgrade.quality})?
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                        <span>Fee: {'£'}{Math.round(hiringFee / 1000)}K</span>
                        {wageDelta !== 0 && (
                          <span className={wageDelta > 0 ? 'text-destructive' : 'text-emerald-400'}>
                            {' '}({wageDelta > 0 ? '+' : ''}{'£'}{(wageDelta / 1000).toFixed(0)}K/w)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { runHire(upgrade.id); setConfirmReplaceId(null); }} className="text-xs text-primary font-bold py-1 px-2 min-h-[36px]">Confirm</button>
                        <button type="button" onClick={() => setConfirmReplaceId(null)} className="text-xs text-muted-foreground font-semibold py-1 px-2 min-h-[36px]">Cancel</button>
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
                          <span className="text-[10px] text-muted-foreground">{'£'}{(upgrade.wage / 1000).toFixed(0)}K/w</span>
                          <button
                            onClick={() => handleHire(upgrade, current)}
                            disabled={!canAfford}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              !canAfford
                                ? 'bg-muted/20 text-muted-foreground cursor-not-allowed'
                                : 'bg-primary/20 text-primary hover:bg-primary/30'
                            )}
                            aria-label={!canAfford ? `Cannot hire ${upgrade.firstName} ${upgrade.lastName} — insufficient budget` : current ? `Replace with ${upgrade.firstName} ${upgrade.lastName} (fee £${Math.round(hiringFee / 1000)}K)` : `Hire ${upgrade.firstName} ${upgrade.lastName} (fee £${Math.round(hiringFee / 1000)}K)`}
                          >
                            {current ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {/* Trait chips on hire candidate */}
                      {upgrade.traits && upgrade.traits.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {upgrade.traits.map(t => <TraitChip key={t} trait={t} />)}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className={cn(
                          'text-[10px]',
                          upgradeEffective >= 7 ? 'text-emerald-400' : upgradeEffective >= 5 ? 'text-primary' : 'text-amber-400'
                        )}>
                          {getStatEffect(role, upgradeEffective)}
                        </span>
                        <div className="flex items-center gap-2">
                          {current && wageDelta !== 0 && (
                            <span className={cn('text-[10px]', wageDelta > 0 ? 'text-destructive' : 'text-emerald-400')}>
                              {wageDelta > 0 ? '+' : ''}{'£'}{(wageDelta / 1000).toFixed(0)}K/w
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/70">
                            Fee: {'£'}{Math.round(hiringFee / 1000)}K
                          </span>
                        </div>
                      </div>
                      {/* Affordability reason as visible text — a `title=`
                          attribute does nothing on a touch device. */}
                      {!canAfford && (
                        <p className="text-[10px] text-destructive font-medium mt-1">
                          Can't afford the {'£'}{Math.round(hiringFee / 1000)}K signing fee
                          {' '}(budget {'£'}{Math.round((club?.budget ?? 0) / 1000)}K).
                        </p>
                      )}
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
