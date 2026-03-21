import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useGameStore } from '@/store/gameStore';
import { Handshake, Calendar, Trophy, DollarSign, AlertTriangle } from 'lucide-react';
import { getSponsorById, getBonusConditionLabel, SPONSOR_SLOTS } from '@/config/sponsorship';
import { formatMoney } from '@/utils/helpers';
import { TOTAL_WEEKS } from '@/config/gameBalance';
import type { SponsorOffer } from '@/types/game';

interface Props {
  offer: SponsorOffer | null;
  onClose: () => void;
}

export function SponsorOfferSheet({ offer, onClose }: Props) {
  const { acceptSponsorOffer, rejectSponsorOffer, week } = useGameStore();

  if (!offer) return null;

  const sponsor = getSponsorById(offer.sponsorId);
  const slotDef = SPONSOR_SLOTS.find(s => s.id === offer.slotId);
  const weeksLeft = offer.expiresWeek - week;
  const seasonTotal = offer.weeklyPayment * TOTAL_WEEKS;

  const handleAccept = () => {
    acceptSponsorOffer(offer.id);
    onClose();
  };

  const handleReject = () => {
    rejectSponsorOffer(offer.id);
    onClose();
  };

  return (
    <Sheet open={!!offer} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="bg-background/95 backdrop-blur-xl border-t border-border/50 rounded-t-2xl max-h-[85vh] overflow-y-auto pb-8">
        <SheetTitle className="sr-only">Sponsor Offer from {sponsor?.name}</SheetTitle>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-display font-bold text-foreground">{sponsor?.name || 'Unknown Sponsor'}</p>
            <p className="text-xs text-muted-foreground">{sponsor?.industry} — {slotDef?.label}</p>
          </div>
        </div>

        {/* Key Terms */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-card/40 rounded-xl p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Weekly Pay</span>
            </div>
            <p className="text-lg font-black text-primary tabular-nums">{formatMoney(offer.weeklyPayment)}</p>
            <p className="text-[10px] text-muted-foreground">{formatMoney(seasonTotal)}/season</p>
          </div>
          <div className="bg-card/40 rounded-xl p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-lg font-black text-foreground tabular-nums">{offer.seasonDuration}</p>
            <p className="text-[10px] text-muted-foreground">season{offer.seasonDuration > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Performance Bonus */}
        <div className="bg-card/40 rounded-xl p-3 border border-border/30 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance Bonus</span>
          </div>
          <p className="text-sm font-bold text-foreground">{formatMoney(offer.performanceBonus)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid if you: <span className="text-foreground font-medium">{getBonusConditionLabel(offer.bonusCondition)}</span>
          </p>
        </div>

        {/* Fine Print */}
        <div className="bg-muted/10 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Terms</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>· Early termination buyout: {formatMoney(offer.buyoutCost)}</li>
            <li>· Sponsor may withdraw if satisfaction drops below 15%</li>
            <li>· Offer expires in {weeksLeft} week{weeksLeft !== 1 ? 's' : ''}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Accept Deal
          </button>
          <button
            onClick={handleReject}
            className="flex-1 bg-muted/20 text-muted-foreground font-semibold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Decline
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
