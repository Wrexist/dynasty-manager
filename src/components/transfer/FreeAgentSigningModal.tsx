/**
 * FreeAgentSigningModal — extracted from `pages/TransferPage.tsx`.
 *
 * Modal for negotiating wage + contract length with a free agent.
 * Owns no async logic; the parent handles `signFreeAgent` via `onConfirm`.
 *
 * Nothing is committed until Confirm Signing, so Escape and a backdrop tap
 * both cancel, the same as the Cancel button.
 */
import { useRef } from 'react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FREE_AGENT_MIN_WAGE_RATIO, FREE_AGENT_MAX_WAGE_RATIO } from '@/config/transfers';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { calculateSigningBonus } from '@/utils/transferOffers';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { Player, Club } from '@/types/game';

interface FreeAgentSigningModalProps {
  player: Player;
  club: Club | undefined;
  offerWage: number;
  offerYears: number;
  totalWeeks: number;
  onSetOfferWage: (wage: number) => void;
  onSetOfferYears: (years: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FreeAgentSigningModal({
  player: p,
  club,
  offerWage,
  offerYears,
  totalWeeks,
  onSetOfferWage,
  onSetOfferYears,
  onConfirm,
  onCancel,
}: FreeAgentSigningModalProps) {
  const signingBonus = calculateSigningBonus(offerWage, offerYears);
  const canAfford = (club?.budget || 0) >= signingBonus;
  const squadFull = (club?.playerIds.length || 0) >= MAX_SQUAD_SIZE;

  const dialogRef = useRef<HTMLDivElement | null>(null);
  useScrollLock();
  useFocusTrap(dialogRef, true);
  useEscapeClose(onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-agent-signing-title"
        tabIndex={-1}
        className="relative max-w-sm w-full focus:outline-none"
      >
        <GlassPanel className="p-5 w-full space-y-4">
          <h3 id="free-agent-signing-title" className="text-base font-bold text-foreground font-display">Sign {p.firstName} {p.lastName}</h3>
          <p className="text-xs text-muted-foreground">{p.position} {'•'} {p.age}y {'•'} OVR {p.overall}</p>
          <div>
            <label htmlFor="free-agent-wage" className="text-xs text-muted-foreground mb-1 block">Weekly Wage</label>
            <div className="flex items-center gap-2">
              <input
                id="free-agent-wage"
                type="range"
                min={Math.round(p.wage * FREE_AGENT_MIN_WAGE_RATIO)}
                max={Math.round(p.wage * FREE_AGENT_MAX_WAGE_RATIO)}
                step={1000}
                value={offerWage}
                onChange={e => onSetOfferWage(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold text-foreground tabular-nums w-16 text-right">£{(offerWage / 1e3).toFixed(0)}K</span>
            </div>
          </div>
          <div>
            <p id="free-agent-years" className="text-xs text-muted-foreground mb-1">Contract Length</p>
            <div className="flex gap-2" role="group" aria-labelledby="free-agent-years">
              {[1, 2, 3].map(y => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={offerYears === y}
                  onClick={() => onSetOfferYears(y)}
                  className={cn(
                    'flex-1 min-h-11 rounded-lg text-xs font-medium transition-all',
                    offerYears === y ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {y} year{y > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Signing Bonus</span>
            <span className={cn('font-semibold', canAfford ? 'text-foreground' : 'text-destructive')}>
              £{(signingBonus / 1e6).toFixed(1)}M
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">First Year Cost</span>
            <span className="font-semibold text-muted-foreground">
              £{((signingBonus + offerWage * (totalWeeks || 46)) / 1e6).toFixed(1)}M
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Squad Size</span>
            <span className={cn('font-semibold', squadFull ? 'text-destructive' : 'text-muted-foreground')}>
              {club?.playerIds.length || 0} / {MAX_SQUAD_SIZE}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm" className="flex-1 h-11 text-xs"
              disabled={!canAfford || squadFull}
              onClick={onConfirm}
            >
              {squadFull ? 'Squad Full' : canAfford ? 'Confirm Signing' : 'Cannot Afford'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-11 text-xs" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
