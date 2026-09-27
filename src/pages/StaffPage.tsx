import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import {
  Plus, ArrowUpRight, X, Shield, Dumbbell, Heart, Search, GraduationCap, Activity,
  UserCheck, RefreshCw, FileText, Clock, AlertTriangle, Briefcase,
  Smile, Frown, ChevronDown, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole, StaffMember, StaffTrait, Club } from '@/types/game';
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

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  'assistant-manager': 'Helps the squad learn new formations.',
  'first-team-coach': 'Improves every training session.',
  'fitness-coach': 'Boosts training effectiveness.',
  'goalkeeping-coach': 'Boosts goalkeeper development.',
  'scout': 'Unlocks scouting assignments.',
  'youth-coach': 'Stronger youth academy intake.',
  'physio': 'Fewer injuries, faster recovery.',
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

const k = (n: number) => `£${Math.round(n / 1000)}K`;

function qualityTone(q: number): string {
  if (q >= 8) return 'text-emerald-400 bg-emerald-500/15';
  if (q >= 6) return 'text-primary bg-primary/15';
  if (q >= 4) return 'text-amber-400 bg-amber-500/15';
  return 'text-rose-400 bg-rose-500/15';
}

function moraleTone(m: number): 'emerald' | 'primary' | 'amber' | 'rose' {
  if (m >= 75) return 'emerald';
  if (m >= 50) return 'primary';
  if (m >= 30) return 'amber';
  return 'rose';
}

const QualityBadge = ({ quality, label = 'Quality' }: { quality: number; label?: string }) => (
  <span
    className={cn('shrink-0 min-w-[36px] text-center text-sm font-display font-bold tabular-nums px-1.5 py-0.5 rounded-md', qualityTone(quality))}
    aria-label={`${label} ${quality} of 10`}
  >
    {quality}
  </span>
);

const TRAIT_TONE: Record<StaffTrait, string> = {
  tactician: 'bg-primary/15 text-primary border-primary/25',
  motivator: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  talent_spotter: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  innovator: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  disciplinarian: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  veteran: 'bg-muted/40 text-muted-foreground border-border/40',
  rising_star: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
};

/** Trait chip + its description as visible text — a `title=` does nothing on touch. */
const TraitList = ({ traits }: { traits: StaffTrait[] }) => (
  <div className="space-y-1.5">
    {traits.map(tr => (
      <div key={tr} className="flex items-start gap-2">
        <span className={cn('shrink-0 text-micro font-bold px-1.5 py-0.5 rounded border', TRAIT_TONE[tr])}>
          {getTraitLabel(tr)}
        </span>
        <p className="text-micro text-muted-foreground leading-snug pt-0.5">{getTraitDescription(tr)}</p>
      </div>
    ))}
  </div>
);

interface CandidateCardProps {
  role: StaffRole;
  candidate: StaffMember;
  current?: StaffMember;
  club?: Club;
  onHire: (id: string) => void;
}

/** A hire candidate: vacancy fill or a replacement for the current holder. */
function CandidateCard({ role, candidate, current, club, onHire }: CandidateCardProps) {
  const [confirming, setConfirming] = useState(false);
  const effective = getEffectiveQuality(candidate);
  const currentEffective = current ? getEffectiveQuality(current) : 0;
  const isUpgrade = !!current && effective > currentEffective;
  const fee = candidate.wage * STAFF_HIRING_FEE_WEEKS;
  const canAfford = !!club && club.budget >= fee;
  const wageDelta = current ? candidate.wage - current.wage : 0;

  const heading = !current ? 'Available to hire' : isUpgrade ? 'Upgrade available' : 'Alternative candidate';

  const hire = () => {
    hapticLight();
    if (current && !confirming) { setConfirming(true); return; }
    onHire(candidate.id);
    setConfirming(false);
  };

  return (
    <div className={cn(
      'rounded-lg p-3 border space-y-2',
      isUpgrade ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-primary/5 border-primary/20',
    )}>
      <p className={cn('text-micro font-semibold flex items-center gap-1', isUpgrade ? 'text-emerald-400' : current ? 'text-muted-foreground' : 'text-primary')}>
        {isUpgrade && <ArrowUpRight className="w-3.5 h-3.5" />}
        {heading}
      </p>
      <div className="flex items-center gap-2">
        <QualityBadge quality={candidate.quality} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{candidate.firstName} {candidate.lastName}</p>
          <p className="text-micro text-muted-foreground">{getStatEffect(role, effective)}</p>
        </div>
      </div>
      {candidate.traits && candidate.traits.length > 0 && <TraitList traits={candidate.traits} />}
      <div className="flex items-center justify-between text-micro text-muted-foreground">
        <span>Wage {k(candidate.wage)}/wk
          {current && wageDelta !== 0 && (
            <span className={wageDelta > 0 ? 'text-destructive' : 'text-emerald-400'}> ({wageDelta > 0 ? '+' : '−'}{k(Math.abs(wageDelta))})</span>
          )}
        </span>
        <span>Signing fee {k(fee)}</span>
      </div>
      {confirming && current && (
        <p className="text-micro text-foreground">
          Replace {current.firstName} {current.lastName} (quality {current.quality}) with {candidate.lastName}? {current.lastName} leaves the club.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={hire}
          disabled={!canAfford}
          className={cn(
            'flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all',
            canAfford ? 'bg-primary/20 text-primary hover:bg-primary/30 active:scale-[0.98]' : 'bg-muted/20 text-muted-foreground cursor-not-allowed',
          )}
        >
          {confirming ? <Check className="w-4 h-4" /> : current ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {confirming ? 'Confirm replacement' : current ? `Replace · ${k(fee)}` : `Hire · ${k(fee)}`}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-muted/30 text-muted-foreground"
            aria-label="Cancel replacement"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {!canAfford && (
        <p className="text-micro text-destructive font-medium">
          Can't afford the {k(fee)} signing fee (budget {k(club?.budget ?? 0)}).
        </p>
      )}
    </div>
  );
}

const StaffPage = () => {
  const { t } = useTranslation();
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

  const [openRole, setOpenRole] = useState<StaffRole | null>(null);
  const [confirmFireId, setConfirmFireId] = useState<string | null>(null);

  const membersByRole: Partial<Record<StaffRole, StaffMember>> = {};
  for (const m of staff.members) membersByRole[m.role] = m;

  const filledCount = staff.members.length;
  const totalWages = staff.members.reduce((s, m) => s + m.wage, 0);
  const avgMorale = staff.members.length
    ? Math.round(staff.members.reduce((s, m) => s + (m.morale ?? 70), 0) / staff.members.length)
    : 0;

  const refreshSameSeason = staff.lastMarketRefreshSeason === season;
  const weeksSinceRefresh = refreshSameSeason ? week - (staff.lastMarketRefreshWeek ?? -99) : 99;
  const refreshCooldown = Math.max(0, STAFF_MARKET_REFRESH_COOLDOWN - weeksSinceRefresh);
  const refreshAvailable = refreshCooldown <= 0 && (club?.budget ?? 0) >= STAFF_MARKET_REFRESH_FEE;
  const nowAbs = absWeek(season, week);

  // `hireStaff` no-ops when the club can't cover the signing fee, so the toast
  // must follow the result — never fire unconditionally.
  const runHire = (staffId: string) => {
    const r = hireStaff(staffId);
    if (r.success) successToast('Staff Hired', r.message);
    else errorToast(r.message);
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

  const stats: { label: string; value: string; tone: string }[] = [
    { label: 'Roles filled', value: `${filledCount}/${ALL_ROLES.length}`, tone: filledCount === ALL_ROLES.length ? 'text-emerald-400' : 'text-foreground' },
    { label: 'Wages / wk', value: k(totalWages), tone: 'text-foreground' },
    {
      label: 'Avg. morale',
      value: filledCount ? String(avgMorale) : '—',
      tone: avgMorale >= 75 ? 'text-emerald-400' : avgMorale >= 50 ? 'text-primary' : avgMorale >= 30 ? 'text-amber-400' : 'text-destructive',
    },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="staff" title={PAGE_HINTS.staff.title} body={PAGE_HINTS.staff.body} />
      <div className="px-4 pb-4 space-y-3">
        {/* Header: title, the three numbers, and the market refresh */}
        <GlassPanel className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-display font-bold text-foreground leading-tight">Backroom Staff</h2>
              <p className="text-micro text-muted-foreground">Better staff and happier staff give bigger bonuses.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map(s => (
              <div key={s.label} className="text-center rounded-lg bg-muted/15 py-2">
                <p className={cn('text-lg font-display font-bold tabular-nums leading-tight', s.tone)}>{s.value}</p>
                <p className="text-micro text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefreshMarket}
            disabled={!refreshAvailable}
            className={cn(
              'w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
              refreshAvailable ? 'bg-primary/15 text-primary hover:bg-primary/25 active:scale-[0.98]' : 'bg-muted/20 text-muted-foreground cursor-not-allowed',
            )}
          >
            <RefreshCw className="w-4 h-4" />
            {refreshCooldown > 0
              ? `New candidates in ${refreshCooldown} wk`
              : `Find new candidates · ${k(STAFF_MARKET_REFRESH_FEE)}`}
          </button>
        </GlassPanel>

        {/* Roles — one compact row each; tap to manage */}
        <section className="space-y-2">
          {ALL_ROLES.map(role => {
            const current = membersByRole[role];
            const candidate = staff.availableHires.find(h => h.role === role);
            const Icon = ROLE_ICONS[role];
            const isOpen = openRole === role;
            const currentEffective = current ? getEffectiveQuality(current) : 0;
            const hasUpgrade = !!current && !!candidate && getEffectiveQuality(candidate) > currentEffective;

            const morale = current?.morale ?? 70;
            const contractYears = current?.contractYearsRemaining ?? 0;
            // Last full season — one more season-end tick and they walk.
            const expiringSoon = !!current && contractYears <= 1;
            const interactCooldown = current ? Math.max(0, STAFF_INTERACTION_COOLDOWN - (nowAbs - (current.lastInteractionWeek ?? -99))) : 0;
            const renewCooldown = current ? Math.max(0, STAFF_RENEWAL_COOLDOWN - (nowAbs - (current.lastRenewalWeek ?? -99))) : 0;
            const renewFee = current ? Math.round(current.wage * STAFF_RENEWAL_FEE_WEEKS) : 0;
            const canRenew = !!current && renewCooldown <= 0 && (club?.budget ?? 0) >= renewFee;
            const moraleMult = getMoraleMultiplier(morale);

            return (
              <GlassPanel key={role} className={cn('p-0 overflow-hidden', isOpen && 'ring-1 ring-primary/30')}>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setOpenRole(isOpen ? null : role); setConfirmFireId(null); }}
                  aria-expanded={isOpen}
                  className="w-full min-h-[64px] flex items-center gap-3 p-3 text-left active:bg-muted/10 transition-colors"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    current ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground',
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-micro text-muted-foreground">{ROLE_LABELS[role]}</p>
                    <p className={cn('text-sm font-semibold truncate', current ? 'text-foreground' : 'text-muted-foreground italic')}>
                      {current ? `${current.firstName} ${current.lastName}` : 'Vacant'}
                    </p>
                    <p className="text-micro text-muted-foreground truncate">
                      {current ? getStatEffect(role, currentEffective) : ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {current && <QualityBadge quality={current.quality} />}
                    {hasUpgrade && (
                      <span className="text-micro font-semibold text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />Upgrade
                      </span>
                    )}
                    {!current && candidate && <span className="text-micro font-semibold text-primary">Hire</span>}
                    {expiringSoon && (
                      <span className="text-micro font-semibold text-amber-400 flex items-center gap-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" />Expiring
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                    <p className="text-micro text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>

                    {current && (
                      <div className="space-y-3">
                        {current.traits && current.traits.length > 0 && <TraitList traits={current.traits} />}

                        {/* Morale */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-micro text-muted-foreground">Morale</span>
                            <span className={cn(
                              'text-micro font-semibold tabular-nums',
                              moraleMult >= 1.05 ? 'text-emerald-400' : moraleMult <= 0.95 ? 'text-amber-400' : 'text-muted-foreground',
                            )}>
                              {Math.round(morale)} · {moraleMult >= 1 ? '+' : ''}{Math.round((moraleMult - 1) * 100)}% effect
                            </span>
                          </div>
                          <PremiumProgress size="sm" animate={false} tone={moraleTone(morale)} value={morale} />
                        </div>

                        {/* Have a word */}
                        {interactCooldown > 0 ? (
                          <p className="text-micro text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> You can talk to {current.lastName} again in {interactCooldown} wk.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handlePraise(current)}
                              className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 active:scale-[0.98] transition-all"
                            >
                              <Smile className="w-4 h-4" /> Praise
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCriticize(current)}
                              className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 active:scale-[0.98] transition-all"
                            >
                              <Frown className="w-4 h-4" /> Criticise
                            </button>
                          </div>
                        )}

                        {/* Facts */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-muted/15 py-1.5">
                            <p className="text-sm font-bold text-foreground tabular-nums">{k(current.wage)}</p>
                            <p className="text-micro text-muted-foreground">Wage / wk</p>
                          </div>
                          <div className="rounded-lg bg-muted/15 py-1.5">
                            <p className={cn('text-sm font-bold tabular-nums', expiringSoon ? 'text-amber-400' : 'text-foreground')}>{contractYears}y</p>
                            <p className="text-micro text-muted-foreground">Contract</p>
                          </div>
                          <div className="rounded-lg bg-muted/15 py-1.5">
                            <p className="text-sm font-bold text-foreground tabular-nums">{current.seasonsAtClub ?? 0}</p>
                            <p className="text-micro text-muted-foreground">Seasons</p>
                          </div>
                        </div>
                        {current.performance && (
                          <p className="text-micro text-muted-foreground">
                            {role === 'youth-coach' && `${current.performance.youthPromotions} youth promoted`}
                            {role === 'scout' && `${current.performance.scoutFinds} scout reports`}
                            {role === 'physio' && `${current.performance.injuriesPrevented} injuries averted`}
                            {(role === 'first-team-coach' || role === 'fitness-coach' || role === 'goalkeeping-coach' || role === 'assistant-manager')
                              && `${current.performance.trainingGains} player improvements`}
                          </p>
                        )}

                        {/* Contract actions */}
                        {confirmFireId === current.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                fireStaff(current.id);
                                setConfirmFireId(null);
                                infoToast('Staff Released', `${current.firstName} ${current.lastName} has left the club`);
                              }}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-bold"
                            >
                              <Check className="w-4 h-4" /> Release {current.lastName}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmFireId(null)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-muted/30 text-muted-foreground"
                              aria-label={t('common.close')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRenew(current)}
                              disabled={!canRenew}
                              className={cn(
                                'flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
                                canRenew ? 'bg-primary/15 text-primary hover:bg-primary/25 active:scale-[0.98]' : 'bg-muted/20 text-muted-foreground cursor-not-allowed',
                              )}
                            >
                              {renewCooldown > 0 ? <Clock className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              {renewCooldown > 0 ? `Renew in ${renewCooldown} wk` : `Renew contract · ${k(renewFee)}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => { hapticLight(); setConfirmFireId(current.id); }}
                              className="min-h-[44px] px-3 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all"
                              aria-label={`Release ${current.firstName} ${current.lastName}`}
                              title={t('staffPage.release')}
                            >
                              Release
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {candidate && (
                      <CandidateCard role={role} candidate={candidate} current={current} club={club} onHire={runHire} />
                    )}
                    {!current && !candidate && (
                      <p className="text-xs text-muted-foreground text-center py-3 rounded-lg border border-dashed border-border/40">
                        No candidates right now. Use "Find new candidates" above.
                      </p>
                    )}
                  </div>
                )}
              </GlassPanel>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default StaffPage;
