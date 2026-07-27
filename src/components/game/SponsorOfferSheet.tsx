import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useGameStore } from '@/store/gameStore';
import {
  Handshake, Calendar, Trophy, Banknote, AlertTriangle,
  ArrowLeft, Minus, Plus, Check, X, Sparkles, ThumbsUp, Meh, Frown, Scale,
} from 'lucide-react';
import {
  getSponsorById, getBonusConditionLabel, SPONSOR_SLOTS,
  SPONSOR_NEGOTIATION_MAX_ROUNDS, getSponsorNegotiationBounds,
} from '@/config/sponsorship';
import { formatMoney } from '@/utils/helpers';
import { TOTAL_WEEKS } from '@/config/gameBalance';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import type { SponsorOffer, SponsorNegotiationProposal } from '@/types/game';

interface Props {
  offer: SponsorOffer | null;
  onClose: () => void;
}

// Colour roles — each negotiable term owns a colour the player learns to read.
const TONE = {
  gold:  { text: 'text-primary',   ring: 'ring-primary/25',   glow: 'from-primary/15',   icon: 'text-primary' },
  sky:   { text: 'text-sky-300',   ring: 'ring-sky-400/25',   glow: 'from-sky-400/15',   icon: 'text-sky-400' },
  amber: { text: 'text-amber-300', ring: 'ring-amber-400/25', glow: 'from-amber-400/15', icon: 'text-amber-400' },
} as const;
type Tone = keyof typeof TONE;

const TIER_BADGE: Record<number, string> = {
  5: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  4: 'bg-violet-400/15 text-violet-300 ring-violet-400/30',
  3: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
  2: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  1: 'bg-white/8 text-foreground/60 ring-white/15',
};

const MOOD = {
  pleased: { ring: 'ring-emerald-400/30', bg: 'from-emerald-500/12', text: 'text-emerald-300', Icon: ThumbsUp },
  neutral: { ring: 'ring-sky-400/30',     bg: 'from-sky-500/12',     text: 'text-sky-300',     Icon: Meh },
  annoyed: { ring: 'ring-orange-400/30',  bg: 'from-orange-500/12',  text: 'text-orange-300',  Icon: Frown },
} as const;

function StatTile({ tone, icon, label, value, sub, was }: {
  tone: Tone; icon: ReactNode; label: string; value: string; sub?: string; was?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-3 ring-1', t.ring,
      'bg-gradient-to-b from-white/[0.05] to-transparent',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.28)]',
    )}>
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b to-transparent', t.glow)} />
      <div className="relative flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('relative text-xl font-black tabular-nums leading-none', t.text)}>{value}</p>
      {was && <p className="relative text-[10px] text-muted-foreground/60 mt-1">was <span className="line-through">{was}</span></p>}
      {sub && <p className="relative text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Stepper({ tone, icon, label, value, min, max, step, original, format, onChange }: {
  tone: Tone; icon: ReactNode; label: string;
  value: number; min: number; max: number; step: number; original: number;
  format: (n: number) => string; onChange: (n: number) => void;
}) {
  const t = TONE[tone];
  const delta = value - original;
  const btn = 'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.06] ring-1 ring-white/10 text-foreground active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100';
  return (
    <div className={cn('relative overflow-hidden rounded-xl p-3 ring-1', t.ring, 'bg-gradient-to-b from-white/[0.04] to-transparent')}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        {delta !== 0 && (
          <span className={cn(
            'ml-auto text-[10px] font-bold tabular-nums',
            delta > 0 ? 'text-emerald-400' : 'text-destructive',
          )}>
            {delta > 0 ? '+' : '-'}{format(Math.abs(delta))} vs offer
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={value <= min}
          onClick={() => { hapticLight(); onChange(Math.max(min, value - step)); }}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className={cn('flex-1 text-center text-xl font-black tabular-nums', t.text)}>{format(value)}</span>
        <button
          type="button"
          className={btn}
          disabled={value >= max}
          onClick={() => { hapticLight(); onChange(Math.min(max, value + step)); }}
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const seasons = (n: number) => `${n} season${n !== 1 ? 's' : ''}`;

export function SponsorOfferSheet({ offer, onClose }: Props) {
  const week = useGameStore(s => s.week);
  const offerId = offer?.id;
  // Re-derive the offer from the store by id so the sheet reflects live
  // negotiation state after every counter (the prop is a stale snapshot).
  const liveOffer = useGameStore(s => (offerId ? s.sponsorOffers.find(o => o.id === offerId) : undefined));
  const acceptSponsorOffer = useGameStore(s => s.acceptSponsorOffer);
  const rejectSponsorOffer = useGameStore(s => s.rejectSponsorOffer);
  const negotiateSponsorOffer = useGameStore(s => s.negotiateSponsorOffer);

  const [mode, setMode] = useState<'review' | 'negotiate'>('review');
  const [proposal, setProposal] = useState<SponsorNegotiationProposal>({
    weeklyPayment: 0, seasonDuration: 1, performanceBonus: 0,
  });

  // Reset to the review screen whenever a different offer is opened.
  useEffect(() => { setMode('review'); }, [offerId]);

  if (!offer) return null;

  const sponsor = getSponsorById(offer.sponsorId);
  const slotLabel = SPONSOR_SLOTS.find(s => s.id === offer.slotId)?.label || 'Sponsor';
  const sponsorName = sponsor?.name || 'Unknown Sponsor';

  const close = () => { setMode('review'); onClose(); };

  const Header = (
    <div className="relative flex items-center gap-3 mb-4 pr-8">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
        <Handshake className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-display font-bold text-foreground leading-tight truncate">{sponsorName}</p>
        <p className="text-xs text-muted-foreground truncate">{sponsor?.industry} · {slotLabel}</p>
      </div>
      {sponsor && (
        <span className={cn(
          'ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ring-1',
          TIER_BADGE[sponsor.tier],
        )}>
          Tier {sponsor.tier}
        </span>
      )}
    </div>
  );

  // ── Sponsor withdrew mid-negotiation: the offer is gone from the store. ──
  if (!liveOffer) {
    return (
      <Sheet open onOpenChange={o => !o && close()}>
        <SheetContent side="bottom" className={SHEET_CLASS}>
          <SheetTitle className="sr-only">{sponsorName} withdrew their offer</SheetTitle>
          <SpecularEdge />
          {Header}
          <div className={cn(
            'relative rounded-xl p-4 mb-4 ring-1 ring-orange-400/30',
            'bg-gradient-to-b from-orange-500/12 to-transparent',
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Frown className="w-4 h-4 text-orange-300" />
              <p className="text-sm font-bold text-orange-300">They walked away</p>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {sponsorName} felt your demands were unreasonable and pulled the {slotLabel} offer
              off the table. Hold firmer next time — push too hard and a sponsor will leave.
            </p>
          </div>
          <button onClick={close} className={BTN_MUTED}>Close</button>
        </SheetContent>
      </Sheet>
    );
  }

  const neg = liveOffer.negotiation;
  const live = neg ?? {
    weeklyPayment: liveOffer.weeklyPayment,
    seasonDuration: liveOffer.seasonDuration,
    performanceBonus: liveOffer.performanceBonus,
  };
  const original = {
    weeklyPayment: liveOffer.weeklyPayment,
    seasonDuration: liveOffer.seasonDuration,
    performanceBonus: liveOffer.performanceBonus,
  };
  const weeksLeft = liveOffer.expiresWeek - week;
  const roundsUsed = neg?.roundsUsed ?? 0;
  const canNegotiate = !neg || neg.outcome === 'countered';
  const bounds = getSponsorNegotiationBounds(original);

  const handleAccept = () => { hapticLight(); acceptSponsorOffer(liveOffer.id); close(); };
  const handleReject = () => { hapticLight(); rejectSponsorOffer(liveOffer.id); close(); };
  const openNegotiate = () => {
    hapticLight();
    setProposal({ ...live });
    setMode('negotiate');
  };
  const sendProposal = () => {
    hapticLight();
    negotiateSponsorOffer(liveOffer.id, proposal);
    setMode('review');
  };

  const proposalChanged =
    proposal.weeklyPayment !== live.weeklyPayment ||
    proposal.seasonDuration !== live.seasonDuration ||
    proposal.performanceBonus !== live.performanceBonus;

  // ── Negotiation panel ──
  if (mode === 'negotiate') {
    return (
      <Sheet open onOpenChange={o => !o && close()}>
        <SheetContent side="bottom" className={SHEET_CLASS}>
          <SheetTitle className="sr-only">Negotiate with {sponsorName}</SheetTitle>
          <SpecularEdge />
          {Header}

          <div className="relative flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Counter-proposal</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 tabular-nums">
              Round {roundsUsed + 1} of {SPONSOR_NEGOTIATION_MAX_ROUNDS}
            </span>
          </div>

          <div className="relative space-y-2.5 mb-3">
            <Stepper
              tone="gold" label="Weekly Pay"
              icon={<Banknote className="w-3.5 h-3.5 text-primary" />}
              value={proposal.weeklyPayment} original={live.weeklyPayment}
              min={bounds.weeklyPayment.min} max={bounds.weeklyPayment.max} step={bounds.weeklyPayment.step}
              format={formatMoney}
              onChange={n => setProposal(p => ({ ...p, weeklyPayment: n }))}
            />
            <Stepper
              tone="sky" label="Duration"
              icon={<Calendar className="w-3.5 h-3.5 text-sky-400" />}
              value={proposal.seasonDuration} original={live.seasonDuration}
              min={bounds.seasonDuration.min} max={bounds.seasonDuration.max} step={bounds.seasonDuration.step}
              format={seasons}
              onChange={n => setProposal(p => ({ ...p, seasonDuration: n }))}
            />
            <Stepper
              tone="amber" label="Performance Bonus"
              icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
              value={proposal.performanceBonus} original={live.performanceBonus}
              min={bounds.performanceBonus.min} max={bounds.performanceBonus.max} step={bounds.performanceBonus.step}
              format={formatMoney}
              onChange={n => setProposal(p => ({ ...p, performanceBonus: n }))}
            />
          </div>

          <div className="relative flex items-start gap-1.5 mb-4 px-1">
            <AlertTriangle className="w-3 h-3 text-amber-400/80 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              The harder you push, the more likely {sponsorName} counters low — or walks away
              for good. A strong club reputation buys you more room.
            </p>
          </div>

          <div className="relative flex gap-2">
            <button onClick={() => { hapticLight(); setMode('review'); }} className={cn(BTN_MUTED, 'flex-1')}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={sendProposal} disabled={!proposalChanged} className={cn(BTN_PRIMARY, 'flex-[1.4]')}>
              <Sparkles className="w-4 h-4" /> Send Proposal
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Review panel ──
  const moodCfg = neg ? MOOD[neg.mood] : null;
  const responseText = !neg ? '' :
    neg.outcome === 'accepted' ? `${sponsorName} agreed to your terms.` :
    neg.outcome === 'final'    ? `${sponsorName}'s final offer — take it or leave it.` :
                                 `${sponsorName} countered with revised terms.`;

  return (
    <Sheet open onOpenChange={o => !o && close()}>
      <SheetContent side="bottom" className={SHEET_CLASS}>
        <SheetTitle className="sr-only">Sponsor offer from {sponsorName}</SheetTitle>
        <SpecularEdge />
        {Header}

        {/* Sponsor response to the last counter */}
        {neg && moodCfg && (
          <div className={cn(
            'relative rounded-xl p-3 mb-3 ring-1', moodCfg.ring,
            'bg-gradient-to-b to-transparent', moodCfg.bg,
          )}>
            <div className="flex items-center gap-2">
              <moodCfg.Icon className={cn('w-4 h-4 shrink-0', moodCfg.text)} />
              <p className={cn('text-xs font-semibold', moodCfg.text)}>{responseText}</p>
            </div>
          </div>
        )}

        {/* Key terms — colour-coded */}
        <div className="relative grid grid-cols-2 gap-2 mb-2">
          <StatTile
            tone="gold"
            icon={<Banknote className="w-3.5 h-3.5 text-primary" />}
            label="Weekly Pay"
            value={formatMoney(live.weeklyPayment)}
            sub={`${formatMoney(live.weeklyPayment * TOTAL_WEEKS)}/season`}
            was={neg && live.weeklyPayment !== original.weeklyPayment ? formatMoney(original.weeklyPayment) : undefined}
          />
          <StatTile
            tone="sky"
            icon={<Calendar className="w-3.5 h-3.5 text-sky-400" />}
            label="Duration"
            value={seasons(live.seasonDuration)}
            was={neg && live.seasonDuration !== original.seasonDuration ? seasons(original.seasonDuration) : undefined}
          />
        </div>

        {/* Performance bonus */}
        <div className="relative mb-3">
          <StatTile
            tone="amber"
            icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
            label="Performance Bonus"
            value={formatMoney(live.performanceBonus)}
            sub={`Paid if you: ${getBonusConditionLabel(liveOffer.bonusCondition)}`}
            was={neg && live.performanceBonus !== original.performanceBonus ? formatMoney(original.performanceBonus) : undefined}
          />
        </div>

        {/* Fine print */}
        <div className="relative rounded-xl p-3 mb-4 bg-white/[0.03] ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Terms</span>
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1">
            <li>· Early termination buyout: {formatMoney(liveOffer.buyoutCost)}</li>
            <li>· Sponsor may withdraw if satisfaction drops below 15%</li>
            <li className={cn(weeksLeft <= 2 && 'text-amber-400')}>
              · Offer expires in {weeksLeft} week{weeksLeft !== 1 ? 's' : ''}
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="relative space-y-2">
          <button onClick={handleAccept} className={cn(BTN_PRIMARY, 'w-full')}>
            <Check className="w-4 h-4" /> Accept Deal
          </button>
          <div className="flex gap-2">
            {canNegotiate && (
              <button onClick={openNegotiate} className={cn(BTN_OUTLINE, 'flex-1')}>
                <Scale className="w-4 h-4" />
                Negotiate
                <span className="text-[10px] opacity-70">
                  ({SPONSOR_NEGOTIATION_MAX_ROUNDS - roundsUsed} left)
                </span>
              </button>
            )}
            <button onClick={handleReject} className={cn(BTN_MUTED, canNegotiate ? 'flex-1' : 'w-full')}>
              <X className="w-4 h-4" /> Decline
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Shared styling ──

const SHEET_CLASS = cn(
  'border-t border-white/10 rounded-t-2xl max-h-[90vh] overflow-y-auto px-4 pt-5',
  'bg-gradient-to-b from-[hsl(222_32%_13%)] via-[hsl(222_30%_10%)] to-[hsl(222_36%_8%)]',
  'backdrop-blur-2xl backdrop-saturate-150',
);

const BTN_PRIMARY = cn(
  'flex items-center justify-center gap-2 h-12 rounded-xl',
  'bg-gradient-to-b from-primary to-primary/85 text-primary-foreground font-bold text-sm tracking-wide',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_4px_14px_-5px_hsl(43_96%_46%/0.5)]',
  'active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100',
);

const BTN_OUTLINE = cn(
  'flex items-center justify-center gap-1.5 h-12 rounded-xl',
  'bg-primary/10 text-primary font-bold text-sm tracking-wide ring-1 ring-primary/30',
  'active:scale-[0.98] transition-transform',
);

const BTN_MUTED = cn(
  'flex items-center justify-center gap-2 h-12 rounded-xl',
  'bg-white/[0.06] text-muted-foreground font-bold text-sm tracking-wide ring-1 ring-white/[0.08]',
  'active:scale-[0.98] transition-transform',
);

/** Top specular crescent — the Liquid Glass lighting cue used app-wide. */
function SpecularEdge() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 34%, rgba(255,255,255,0) 64%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
    </>
  );
}
