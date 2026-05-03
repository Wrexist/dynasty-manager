import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { guardAsync } from '@/utils/asyncGuard';
import { ReputationBadge } from '@/components/game/ReputationBadge';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { BoardPitch } from '@/components/game/BoardPitch';
import { FormGuide } from '@/components/game/FormGuide';
import { Briefcase, DollarSign, Clock, Check, X, LogOut, ArrowLeft, Building2, TrendingUp, Handshake, Users, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { errorToast, infoToast, successToast } from '@/utils/gameToast';
import { getManagerBonusLabel, getReputationTierLabel } from '@/utils/managerCareer';
import { getSuffix } from '@/utils/helpers';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX, BONUS_NEGOTIATION_MAX_INCREASE, INITIAL_VACANCIES_SHOWN } from '@/config/managerCareer';
import type { JobVacancy, JobOffer, ManagerBonus } from '@/types/game';

const JobMarket = () => {
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showAllVacancies, setShowAllVacancies] = useState(false);
  const { careerManager, jobVacancies, jobOffers, season, week, activeInterview } = useGameStore(useShallow(s => ({
    careerManager: s.careerManager,
    jobVacancies: s.jobVacancies,
    jobOffers: s.jobOffers,
    season: s.season,
    week: s.week,
    activeInterview: s.activeInterview,
  })));
  const startInterview = useGameStore(s => s.startInterview);
  const respondToJobOffer = useGameStore(s => s.respondToJobOffer);
  const negotiateContractOffer = useGameStore(s => s.negotiateContractOffer);
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const retireManager = useGameStore(s => s.retireManager);
  const resignFromClub = useGameStore(s => s.resignFromClub);
  const setScreen = useGameStore(s => s.setScreen);

  if (!careerManager) return null;

  const handleApply = (vacancyId: string) => {
    const result = startInterview(vacancyId);
    if (!result.success) {
      errorToast('Cannot Apply', result.message);
    }
  };

  const handleAcceptOffer = (offerId: string) => {
    respondToJobOffer(offerId, true);
  };

  const handleDeclineOffer = (offerId: string) => {
    respondToJobOffer(offerId, false);
  };

  const handleWait = () => {
    guardAsync(
      advanceWeek(),
      'JobMarket.advanceWeek',
      { title: 'Could not advance week', body: 'Please try again.' },
    );
  };

  const availableVacancies = jobVacancies.filter(v =>
    v.expiresSeason > season || (v.expiresSeason === season && v.expiresWeek > week)
  );
  const displayedVacancies = showAllVacancies
    ? availableVacancies
    : availableVacancies.slice(0, INITIAL_VACANCIES_SHOWN);

  return (
    <div className="space-y-4 pb-24">
      <PageHint screen="jobMarket" title={PAGE_HINTS.jobMarket.title} body={PAGE_HINTS.jobMarket.body} />

      {/* Board Pitch Interview Overlay */}
      {activeInterview && <BoardPitch />}

      {/* Header */}
      {!activeInterview && (
        <>
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Job Market</h2>
                <p className="text-xs text-muted-foreground">
                  {careerManager.contract ? 'Browse opportunities' : 'Find your next club'}
                </p>
              </div>
              <ReputationBadge tier={careerManager.reputationTier} score={Math.round(careerManager.reputationScore)} size="md" />
            </div>
            {!careerManager.contract && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-400 font-semibold">
                  You are currently unemployed (Week {careerManager.unemployedWeeks}).
                  Apply for positions or wait for offers.
                </p>
              </div>
            )}
          </GlassPanel>

          {/* Incoming Offers */}
          {jobOffers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">
                Job Offers ({jobOffers.length})
              </p>
              {jobOffers.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onAccept={handleAcceptOffer}
                  onDecline={handleDeclineOffer}
                  onNegotiate={negotiateContractOffer}
                />
              ))}
            </div>
          )}

          {/* Available Vacancies */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">
              Available Positions ({availableVacancies.length})
            </p>
            {availableVacancies.length === 0 ? (
              <GlassPanel className="p-6 text-center">
                <Briefcase className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No positions available right now.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Advance time to wait for new openings.</p>
              </GlassPanel>
            ) : (
              <div className="space-y-2">
                {displayedVacancies.map(vacancy => (
                  <VacancyCard
                    key={vacancy.id}
                    vacancy={vacancy}
                    canApply={careerManager.reputationScore >= vacancy.minReputation}
                    onApply={handleApply}
                  />
                ))}
                {availableVacancies.length > INITIAL_VACANCIES_SHOWN && !showAllVacancies && (
                  <Button
                    variant="ghost"
                    className="w-full h-9 text-xs text-primary gap-1"
                    onClick={() => setShowAllVacancies(true)}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Show {availableVacancies.length - INITIAL_VACANCIES_SHOWN} More Positions
                  </Button>
                )}
                {showAllVacancies && availableVacancies.length > INITIAL_VACANCIES_SHOWN && (
                  <Button
                    variant="ghost"
                    className="w-full h-9 text-xs text-muted-foreground gap-1"
                    onClick={() => setShowAllVacancies(false)}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show Less
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Return to Club + Resign buttons for employed managers */}
          {careerManager.contract && (
            <div className="pt-2 space-y-2">
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                onClick={() => setScreen('dashboard')}
              >
                <ArrowLeft className="w-4 h-4" /> Return to Club
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 gap-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
                onClick={() => setShowResignConfirm(true)}
              >
                <LogOut className="w-4 h-4" /> Resign from Club
              </Button>
            </div>
          )}

          {/* Wait & Retire buttons */}
          {!careerManager.contract && (
            <div className="pt-2 space-y-2">
              <Button
                className="w-full h-11 gap-2"
                onClick={handleWait}
              >
                <Clock className="w-4 h-4" /> Wait for Offers (Advance Week)
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 gap-2 text-muted-foreground border-muted-foreground/30 hover:bg-muted/10"
                onClick={() => setShowRetireConfirm(true)}
              >
                <LogOut className="w-4 h-4" /> Retire from Management
              </Button>
            </div>
          )}

          <ConfirmDialog
            open={showRetireConfirm}
            onOpenChange={setShowRetireConfirm}
            title="Retire from Management"
            description={`Retire from management? Your legacy score is ${careerManager.legacyScore}. This cannot be undone.`}
            confirmLabel="Retire"
            onConfirm={retireManager}
          />

          <ConfirmDialog
            open={showResignConfirm}
            onOpenChange={setShowResignConfirm}
            title="Resign from Club"
            description="Are you sure you want to resign? You will enter the job market."
            confirmLabel="Resign"
            onConfirm={resignFromClub}
          />

          {/* Career Summary */}
          <GlassPanel className="p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Career Summary</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{careerManager.totalCareerMatches}</p>
                <p className="text-[10px] text-muted-foreground">Matches</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{careerManager.totalCareerWins}</p>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{careerManager.titlesWon}</p>
                <p className="text-[10px] text-muted-foreground">Titles</p>
              </div>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
};

function VacancyCard({ vacancy, canApply, onApply }: { vacancy: JobVacancy; canApply: boolean; onApply: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const competitors = vacancy.competitors || [];

  return (
    <GlassPanel className="p-3">
      {/* Header: club name + league + status */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {vacancy.clubColor && (
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: vacancy.clubColor }} />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{vacancy.clubName}</h3>
            {vacancy.leagueName && <p className="text-[9px] text-muted-foreground">{vacancy.leagueName}</p>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {vacancy.interviewActive && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold">Interviewing</span>
          )}
          {vacancy.applied && !vacancy.interviewActive && (
            <span className="text-[9px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded-full font-semibold">Applied</span>
          )}
          {!canApply && !vacancy.applied && !vacancy.interviewActive && (
            <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-semibold">Rep too low</span>
          )}
        </div>
      </div>

      {/* Key info: salary, contract */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          £{(vacancy.salary / 1000).toFixed(1)}k/wk
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          {vacancy.contractLength}yr contract
        </div>
      </div>

      {/* League standing + form */}
      {(vacancy.currentPosition != null || vacancy.expectedPosition) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {vacancy.currentPosition != null ? (
            <span className="text-[9px] bg-muted/20 text-muted-foreground/90 px-1.5 py-0.5 rounded font-semibold">
              {vacancy.currentPosition}{getSuffix(vacancy.currentPosition)}
              {vacancy.currentPoints != null && ` · ${vacancy.currentPoints}pts`}
            </span>
          ) : vacancy.expectedPosition ? (
            <span className="text-[9px] bg-muted/20 text-muted-foreground/70 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
              {vacancy.expectedPosition}
            </span>
          ) : null}
          {vacancy.currentForm && vacancy.currentForm.length > 0 && (
            <FormGuide form={vacancy.currentForm} className="scale-[0.65] origin-left -my-1" />
          )}
        </div>
      )}

      {/* Club details row */}
      {(vacancy.facilities != null || vacancy.budget != null) && (
        <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-foreground/80 mb-2">
          {vacancy.expectedPosition && vacancy.currentPosition != null && (
            <div className="flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              {vacancy.expectedPosition}
            </div>
          )}
          {vacancy.facilities != null && (
            <div className="flex items-center gap-0.5">
              <Building2 className="w-2.5 h-2.5" />
              Fac. {vacancy.facilities}/10
            </div>
          )}
          {vacancy.budget != null && vacancy.budget > 0 && (
            <div className="flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              £{(vacancy.budget / 1_000_000).toFixed(1)}M
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-primary/70 italic mb-2">"{vacancy.boardExpectations}"</p>

      {/* Expandable details */}
      {(competitors.length > 0) && (
        <button
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 mb-2 hover:text-muted-foreground transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less Info' : `${competitors.length} Candidate${competitors.length > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Competing candidates (expanded) */}
      {expanded && competitors.length > 0 && (
        <div className="bg-muted/10 rounded-lg px-2.5 py-1.5 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Users className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Candidates</span>
            {competitors.map((c, i) => (
              <span key={i} className="text-[9px] bg-muted/30 text-muted-foreground/70 px-1.5 py-0.5 rounded-full">
                {c.name} ({getReputationTierLabel(c.reputationTier)})
              </span>
            ))}
          </div>
        </div>
      )}

      <Button
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        disabled={!canApply || vacancy.applied || vacancy.interviewActive}
        onClick={() => onApply(vacancy.id)}
      >
        <Briefcase className="w-3 h-3" /> Start Interview
      </Button>
    </GlassPanel>
  );
}

function OfferCard({
  offer,
  onAccept,
  onDecline,
  onNegotiate,
}: {
  offer: JobOffer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onNegotiate: (offerId: string, salary: number, contractLength: number, bonuses: ManagerBonus[]) => void;
}) {
  const [negotiating, setNegotiating] = useState(false);
  const [counterSalary, setCounterSalary] = useState(Math.round(offer.salary * 1.15));
  const [counterLength, setCounterLength] = useState(offer.contractLength);
  const [counterBonuses, setCounterBonuses] = useState<ManagerBonus[]>(
    offer.bonuses.map(b => ({ ...b }))
  );

  // Live league data for this offer's division
  const leagueTable = useGameStore(s => s.divisionTables[offer.divisionId]);
  const tableEntry = leagueTable?.find(e => e.clubId === offer.clubId);
  const leaguePosition = tableEntry ? leagueTable!.indexOf(tableEntry) + 1 : null;

  // Re-sync local state only when the offer identity or negotiation round changes;
  // intentionally excluding salary/length/bonuses so the user's in-flight counter
  // isn't clobbered by every parent re-render.
  useEffect(() => {
    setCounterSalary(Math.round(offer.salary * 1.15));
    setCounterLength(offer.contractLength);
    setCounterBonuses(offer.bonuses.map(b => ({ ...b })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id, offer.negotiationRound]);

  const canNegotiate = offer.negotiationStatus !== 'final' && offer.negotiationStatus !== 'accepted';
  const tolerance = offer.boardTolerance ?? 80;

  const handleNegotiate = () => {
    onNegotiate(offer.id, counterSalary, counterLength, counterBonuses);
    setNegotiating(false);

    // Re-read the updated offer for toast
    const updatedOffers = useGameStore.getState().jobOffers;
    const updated = updatedOffers.find(o => o.id === offer.id);
    if (updated) {
      if (updated.negotiationStatus === 'accepted') {
        successToast('Terms Accepted!', `Salary: £${(updated.salary / 1000).toFixed(1)}k/wk, ${updated.contractLength}yr contract`);
      } else if (updated.negotiationStatus === 'final') {
        infoToast('Final Offer', `The board won't negotiate further. £${(updated.salary / 1000).toFixed(1)}k/wk, ${updated.contractLength}yr`);
      } else {
        infoToast('Counter-Offer', `Board countered: £${(updated.salary / 1000).toFixed(1)}k/wk, ${updated.contractLength}yr contract`);
      }
    }
  };

  const updateBonusAmount = (index: number, delta: number) => {
    const initialAmount = offer.bonuses[index]?.amount || 0;
    const maxAmount = Math.round(initialAmount * (1 + BONUS_NEGOTIATION_MAX_INCREASE));
    setCounterBonuses(prev => prev.map((b, i) =>
      i === index ? { ...b, amount: Math.max(0, Math.min(maxAmount, b.amount + delta)) } : b
    ));
  };

  const maxSalary = Math.round((offer.initialSalary || offer.salary) * 1.4);
  const minSalary = offer.salary;
  const sliderProgress = maxSalary > minSalary ? ((counterSalary - minSalary) / (maxSalary - minSalary)) * 100 : 0;

  return (
    <GlassPanel className="p-3 border-primary/30 mb-2">
      <div className="flex items-center gap-2 mb-2">
        {offer.clubColor ? (
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: offer.clubColor }} />
        ) : (
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-primary truncate">{offer.clubName}</h3>
          {offer.leagueName && <p className="text-[9px] text-muted-foreground">{offer.leagueName}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          £{(offer.salary / 1000).toFixed(1)}k/wk
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          {offer.contractLength}yr contract
        </div>
      </div>

      {/* League standing + form */}
      {(leaguePosition != null || offer.expectedPosition) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {leaguePosition != null && tableEntry ? (
            <span className="text-[9px] bg-muted/20 text-muted-foreground/90 px-1.5 py-0.5 rounded font-semibold">
              {leaguePosition}{getSuffix(leaguePosition)} · {tableEntry.points}pts
            </span>
          ) : offer.expectedPosition ? (
            <span className="text-[9px] bg-muted/20 text-muted-foreground/70 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
              {offer.expectedPosition}
            </span>
          ) : null}
          {tableEntry && tableEntry.form.length > 0 && (
            <FormGuide form={tableEntry.form} className="scale-[0.65] origin-left -my-1" />
          )}
        </div>
      )}

      {/* Enriched club details */}
      {(offer.expectedPosition || offer.facilities != null || offer.budget != null) && (
        <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-foreground/80 mb-2">
          {offer.expectedPosition && leaguePosition != null && (
            <div className="flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              {offer.expectedPosition}
            </div>
          )}
          {offer.facilities != null && (
            <div className="flex items-center gap-0.5">
              <Building2 className="w-2.5 h-2.5" />
              Fac. {offer.facilities}/10
            </div>
          )}
          {offer.budget != null && offer.budget > 0 && (
            <div className="flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              £{(offer.budget / 1_000_000).toFixed(1)}M
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-primary/70 italic mb-3">"{offer.boardExpectations}"</p>
      {offer.bonuses.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {offer.bonuses.map((b, i) => (
            <span key={i} className="text-[9px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
              {getManagerBonusLabel(b.condition)}: £{(b.amount / 1000).toFixed(0)}k
            </span>
          ))}
        </div>
      )}

      {/* Board Tolerance indicator */}
      {offer.boardTolerance != null && offer.boardTolerance < 80 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground">Board Patience</span>
            <span className="text-[9px] text-muted-foreground">{tolerance}%</span>
          </div>
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${tolerance > 50 ? 'bg-emerald-400' : tolerance > 25 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${tolerance}%` }}
            />
          </div>
        </div>
      )}

      {/* Enhanced Negotiation Panel */}
      {negotiating && (
        <div className="bg-muted/20 rounded-lg p-2.5 mb-3 space-y-3">
          {/* Club context in negotiation */}
          <div className="grid grid-cols-2 gap-1.5 text-[9px] text-muted-foreground/80">
            {offer.budget != null && offer.budget > 0 && (
              <div>Transfer Budget: £{(offer.budget / 1_000_000).toFixed(1)}M</div>
            )}
            {offer.expectedPosition && (
              <div>Expected: {offer.expectedPosition}</div>
            )}
            {leaguePosition != null && tableEntry && (
              <div>Current: {leaguePosition}{getSuffix(leaguePosition)} ({tableEntry.points}pts)</div>
            )}
            {tableEntry && tableEntry.form.length > 0 && (
              <div className="flex items-center gap-1">
                Form: <FormGuide form={tableEntry.form} className="scale-[0.55] origin-left -my-1" />
              </div>
            )}
          </div>

          {/* Salary */}
          <div>
            <p className="text-[10px] font-semibold text-foreground mb-1">Salary</p>
            <input
              type="range"
              min={minSalary}
              max={maxSalary}
              step={500}
              value={counterSalary}
              onChange={e => setCounterSalary(Number(e.target.value))}
              className="age-slider"
              style={{ '--slider-progress': `${sliderProgress}%` } as React.CSSProperties}
            />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">£{(minSalary / 1000).toFixed(1)}k</span>
              <span className="text-primary font-bold">£{(counterSalary / 1000).toFixed(1)}k/wk</span>
              <span className="text-muted-foreground">£{(maxSalary / 1000).toFixed(1)}k</span>
            </div>
          </div>

          {/* Contract Length */}
          <div>
            <p className="text-[10px] font-semibold text-foreground mb-1">Contract Length</p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-30"
                onClick={() => setCounterLength(l => Math.max(CONTRACT_LENGTH_MIN, l - 1))}
                disabled={counterLength <= CONTRACT_LENGTH_MIN}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-bold text-foreground w-16 text-center">
                {counterLength} {counterLength === 1 ? 'year' : 'years'}
              </span>
              <button
                className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-30"
                onClick={() => setCounterLength(l => Math.min(CONTRACT_LENGTH_MAX, l + 1))}
                disabled={counterLength >= CONTRACT_LENGTH_MAX}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Bonuses */}
          {counterBonuses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-foreground mb-1.5">Bonuses</p>
              <div className="space-y-1.5">
                {counterBonuses.map((b, i) => {
                  const step = b.amount >= 50000 ? 10000 : 5000;
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{getManagerBonusLabel(b.condition)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-30"
                          onClick={() => updateBonusAmount(i, -step)}
                          disabled={b.amount <= 0}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-semibold text-foreground w-12 text-center">
                          £{(b.amount / 1000).toFixed(0)}k
                        </span>
                        <button
                          className="w-5 h-5 rounded bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors"
                          onClick={() => updateBonusAmount(i, step)}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={handleNegotiate}>
              <Handshake className="w-3 h-3" /> Submit
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px]" onClick={() => setNegotiating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => onAccept(offer.id)}>
          <Check className="w-3 h-3" /> Accept
        </Button>
        {canNegotiate && !negotiating && (
          <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 px-3" onClick={() => setNegotiating(true)}>
            <Handshake className="w-3 h-3" /> Negotiate
          </Button>
        )}
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onDecline(offer.id)}>
          <X className="w-3 h-3" /> Decline
        </Button>
      </div>
    </GlassPanel>
  );
}

export default JobMarket;
