import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { ReputationBadge } from '@/components/game/ReputationBadge';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { Briefcase, MapPin, DollarSign, Clock, Send, Check, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { JobVacancy, JobOffer } from '@/types/game';

const JobMarket = () => {
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const {
    careerManager,
    jobVacancies,
    jobOffers,
    applyForJob,
    respondToJobOffer,
    advanceWeek,
    retireManager,
    season,
    week,
  } = useGameStore();

  if (!careerManager) return null;

  const handleApply = (vacancyId: string) => {
    const result = applyForJob(vacancyId);
    if (result.success) {
      toast.success('Application Accepted!', { description: result.message });
    } else {
      toast.error('Application Rejected', { description: result.message });
    }
  };

  const handleAcceptOffer = (offerId: string) => {
    respondToJobOffer(offerId, true);
  };

  const handleDeclineOffer = (offerId: string) => {
    respondToJobOffer(offerId, false);
  };

  const handleWait = () => {
    advanceWeek();
  };

  const availableVacancies = jobVacancies.filter(v =>
    v.expiresSeason > season || (v.expiresSeason === season && v.expiresWeek > week)
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
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
            <OfferCard key={offer.id} offer={offer} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} />
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
            {availableVacancies.map(vacancy => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                canApply={careerManager.reputationScore >= vacancy.minReputation}
                onApply={handleApply}
              />
            ))}
          </div>
        )}
      </div>

      {/* Wait & Retire buttons */}
      {!careerManager.contract && (
        <div className="pt-2 space-y-2">
          <Button
            variant="outline"
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
    </div>
  );
};

function VacancyCard({ vacancy, canApply, onApply }: { vacancy: JobVacancy; canApply: boolean; onApply: (id: string) => void }) {
  return (
    <GlassPanel className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-foreground">{vacancy.clubName}</h3>
        <div className="flex gap-1">
          {vacancy.applied && (
            <span className="text-[9px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded-full font-semibold">Applied</span>
          )}
          {!canApply && !vacancy.applied && (
            <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-semibold">Rep too low</span>
          )}
        </div>
      </div>
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
      <p className="text-[10px] text-primary/70 italic mb-2">"{vacancy.boardExpectations}"</p>
      <Button
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        disabled={!canApply || vacancy.applied}
        onClick={() => onApply(vacancy.id)}
      >
        <Send className="w-3 h-3" /> Apply
      </Button>
    </GlassPanel>
  );
}

function OfferCard({ offer, onAccept, onDecline }: { offer: JobOffer; onAccept: (id: string) => void; onDecline: (id: string) => void }) {
  return (
    <GlassPanel className="p-3 border-primary/30 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <h3 className="text-sm font-bold text-primary">{offer.clubName}</h3>
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
      <p className="text-[10px] text-primary/70 italic mb-3">"{offer.boardExpectations}"</p>
      {offer.bonuses.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {offer.bonuses.map((b, i) => (
            <span key={i} className="text-[9px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
              {b.condition.replace('_', ' ')}: £{(b.amount / 1000).toFixed(0)}k
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => onAccept(offer.id)}>
          <Check className="w-3 h-3" /> Accept
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onDecline(offer.id)}>
          <X className="w-3 h-3" /> Decline
        </Button>
      </div>
    </GlassPanel>
  );
}

export default JobMarket;
