import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { Lock, Handshake, Clock, X, Check, ChevronRight } from 'lucide-react';
import { SPONSOR_SLOTS, getSponsorById, isSlotUnlocked, getBonusConditionLabel } from '@/config/sponsorship';
import { SponsorOfferSheet } from '@/components/game/SponsorOfferSheet';
import { formatMoney, clamp100 } from '@/utils/helpers';
import type { SponsorDeal, SponsorOffer } from '@/types/game';

function SatisfactionBar({ value }: { value: number }) {
  const clamped = clamp100(value);
  const color = clamped >= 60 ? 'bg-emerald-500' : clamped >= 30 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

interface DealDetailProps {
  deal: SponsorDeal;
  onTerminate: (id: string) => void;
  season: number;
}

function DealDetail({ deal, onTerminate, season }: DealDetailProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const sponsor = getSponsorById(deal.sponsorId);
  const slotDef = SPONSOR_SLOTS.find(s => s.id === deal.slotId);
  const seasonsLeft = deal.startSeason + deal.seasonDuration - season;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{sponsor?.name || 'Unknown'}</p>
          <p className="text-[10px] text-muted-foreground">{sponsor?.industry} — {slotDef?.label}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary tabular-nums">{formatMoney(deal.weeklyPayment)}/wk</p>
          <p className="text-[10px] text-muted-foreground">{seasonsLeft} season{seasonsLeft !== 1 ? 's' : ''} left</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Satisfaction</span>
          <span className={cn('text-[10px] font-semibold', deal.satisfaction >= 60 ? 'text-emerald-400' : deal.satisfaction >= 30 ? 'text-amber-400' : 'text-destructive')}>
            {deal.satisfaction}%
          </span>
        </div>
        <SatisfactionBar value={deal.satisfaction} />
      </div>

      <div className="bg-muted/10 rounded-lg p-2">
        <p className="text-[10px] text-muted-foreground">Performance Bonus</p>
        <p className="text-xs font-semibold text-foreground">{formatMoney(deal.performanceBonus)} — {getBonusConditionLabel(deal.bonusCondition)}</p>
      </div>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full text-xs text-destructive/70 hover:text-destructive py-1.5 transition-colors"
        >
          Terminate Deal (Buyout: {formatMoney(deal.buyoutCost)})
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => { onTerminate(deal.id); setShowConfirm(false); }}
            className="flex-1 flex items-center justify-center gap-1 bg-destructive/20 text-destructive text-xs font-semibold py-2 rounded-lg"
          >
            <Check className="w-3 h-3" /> Confirm
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 flex items-center justify-center gap-1 bg-muted/20 text-muted-foreground text-xs font-semibold py-2 rounded-lg"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function SponsorshipPanel() {
  const { facilities, sponsorDeals, sponsorOffers, sponsorSlotCooldowns, week, season } = useGameStore(useShallow(s => ({
    facilities: s.facilities,
    sponsorDeals: s.sponsorDeals,
    sponsorOffers: s.sponsorOffers,
    sponsorSlotCooldowns: s.sponsorSlotCooldowns,
    week: s.week,
    season: s.season,
  })));
  const terminateSponsorDeal = useGameStore(s => s.terminateSponsorDeal);
  const [selectedDeal, setSelectedDeal] = useState<SponsorDeal | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<SponsorOffer | null>(null);

  const totalWeekly = sponsorDeals.reduce((sum, d) => sum + d.weeklyPayment, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <GlassPanel className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Sponsorship Deals</span>
          </div>
          <span className="text-sm font-bold text-primary tabular-nums">{formatMoney(totalWeekly)}/wk</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {sponsorDeals.length} active deal{sponsorDeals.length !== 1 ? 's' : ''} · {sponsorOffers.length} pending offer{sponsorOffers.length !== 1 ? 's' : ''}
        </p>
      </GlassPanel>

      {/* Pending Offers */}
      {sponsorOffers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 px-1">Pending Offers</p>
          <div className="space-y-2">
            {sponsorOffers.map(offer => {
              const sponsor = getSponsorById(offer.sponsorId);
              const slotDef = SPONSOR_SLOTS.find(s => s.id === offer.slotId);
              const weeksLeft = offer.expiresWeek - week;
              return (
                <GlassPanel
                  key={offer.id}
                  className="p-3 cursor-pointer border-amber-500/20 hover:border-amber-500/40 transition-colors"
                  onClick={() => setSelectedOffer(offer)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">{sponsor?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">{slotDef?.label} · {offer.seasonDuration} season{offer.seasonDuration > 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary tabular-nums">{formatMoney(offer.weeklyPayment)}/wk</p>
                        <p className="text-[10px] text-amber-400 flex items-center gap-0.5 justify-end">
                          <Clock className="w-2.5 h-2.5" /> {weeksLeft}w left
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </div>
      )}

      {/* Sponsor Slots */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Sponsor Slots</p>
        <div className="space-y-2">
          {SPONSOR_SLOTS.map(slot => {
            const unlocked = isSlotUnlocked(slot.id, facilities);
            const deal = sponsorDeals.find(d => d.slotId === slot.id);
            const cooldownWeek = sponsorSlotCooldowns[slot.id] || 0;
            const onCooldown = cooldownWeek > week;
            const offer = sponsorOffers.find(o => o.slotId === slot.id);

            if (!unlocked) {
              return (
                <GlassPanel key={slot.id} className="p-3 opacity-50">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{slot.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Requires {slot.unlock?.facilityType} level {slot.unlock?.level}
                      </p>
                    </div>
                  </div>
                </GlassPanel>
              );
            }

            if (deal) {
              const sponsor = getSponsorById(deal.sponsorId);
              const isExpanded = selectedDeal?.id === deal.id;
              return (
                <GlassPanel
                  key={slot.id}
                  className={cn('p-3 cursor-pointer transition-colors', isExpanded ? 'border-primary/30' : '')}
                  onClick={() => setSelectedDeal(isExpanded ? null : deal)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Handshake className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{sponsor?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground">{slot.label}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-primary tabular-nums">{formatMoney(deal.weeklyPayment)}/wk</p>
                      <SatisfactionBar value={deal.satisfaction} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <DealDetail deal={deal} onTerminate={terminateSponsorDeal} season={season} />
                    </div>
                  )}
                </GlassPanel>
              );
            }

            // Empty slot
            return (
              <GlassPanel key={slot.id} className={cn('p-3', onCooldown ? 'opacity-50' : '')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/30" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{slot.label}</p>
                      {onCooldown ? (
                        <p className="text-[10px] text-amber-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> Cooldown: {cooldownWeek - week}w
                        </p>
                      ) : offer ? (
                        <p className="text-[10px] text-amber-400">Offer pending — tap to review</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50">Waiting for offers...</p>
                      )}
                    </div>
                  </div>
                  {offer && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedOffer(offer); }}
                      className="text-[10px] font-semibold text-primary px-2 py-1 rounded bg-primary/10"
                    >
                      Review
                    </button>
                  )}
                </div>
              </GlassPanel>
            );
          })}
        </div>
      </div>

      {/* Offer Sheet */}
      <SponsorOfferSheet
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
      />
    </div>
  );
}
