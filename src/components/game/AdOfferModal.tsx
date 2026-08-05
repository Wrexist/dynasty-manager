/**
 * Rewarded-ad offer popup.
 *
 * Presents a reward the player can take right now: an extra pack, a budget
 * top-up, a scout reveal, an academy preview. Free players watch a rewarded
 * video for it; **Pro players skip the ad and claim directly** — that is the
 * `ad_free` entitlement they paid for, and the reward itself is identical for
 * both cohorts. Pro is also shown far fewer offers (see `AD_PACING`), because
 * the subscription's value is the reward being free, not the pitch.
 *
 * Pacing — frequency, escalation, caps — lives entirely in `utils/adPacing.ts`.
 * This component asks "may I?" and reports the outcome; it decides nothing.
 *
 * Presented through the shared presentation queue at the LOWEST priority, so an
 * ad offer can never preempt a trophy lift, a sacking, a press conference or
 * any other in-fiction beat. It fills gaps; it does not interrupt.
 *
 * Dismissal is always available: an X, Escape, and a "Not now" button. A
 * dismissal is recorded and *reduces* future frequency.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Crown, Loader2 } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { AD_PLACEMENTS, type AdPlacementId } from '@/config/ads';
import { isPro } from '@/utils/monetization';
import { REWARDED_ADS_USABLE, showRewardedAd } from '@/utils/ads';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { errorToast } from '@/utils/gameToast';
import { track } from '@/utils/analytics';
import { cn } from '@/lib/utils';

interface AdOfferModalProps {
  placementId: AdPlacementId | null;
  /** Called once the reward is actually earned (ad watched, or Pro claim). */
  onGranted: (placementId: AdPlacementId) => void;
  /** Called when the player declines or closes. */
  onDismissed: () => void;
}

export function AdOfferModal({ placementId, onGranted, onDismissed }: AdOfferModalProps) {
  const monetization = useGameStore(s => s.monetization);
  const recordAdPromptShown = useGameStore(s => s.recordAdPromptShown);
  const recordAdWatched = useGameStore(s => s.recordAdWatched);
  const recordAdPromptDismissed = useGameStore(s => s.recordAdPromptDismissed);

  const userIsPro = isPro(monetization);
  const placement = placementId ? AD_PLACEMENTS[placementId] : null;

  const [busy, setBusy] = useState(false);
  const wants = placement != null;
  const isActive = usePresentationSlot('adOffer', wants);
  const open = wants && isActive;

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  // Count the impression once per opening, not on every re-render.
  const countedFor = useRef<AdPlacementId | null>(null);
  useEffect(() => {
    if (!open || !placementId) return;
    if (countedFor.current === placementId) return;
    countedFor.current = placementId;
    recordAdPromptShown();
    track('ad_prompt_shown', { placementId, pro: userIsPro });
  }, [open, placementId, recordAdPromptShown, userIsPro]);

  useEffect(() => {
    if (!wants) countedFor.current = null;
  }, [wants]);

  const dismiss = useCallback(() => {
    if (busy) return;
    hapticLight();
    recordAdPromptDismissed();
    track('ad_prompt_dismissed', { placementId, pro: userIsPro });
    onDismissed();
  }, [busy, recordAdPromptDismissed, placementId, userIsPro, onDismissed]);

  useEscapeClose(dismiss, open && !busy);

  const accept = useCallback(async () => {
    if (!placement || busy) return;
    setBusy(true);
    try {
      if (userIsPro) {
        // Pro paid for ad-free. Grant immediately — same reward, no video.
        hapticSuccess();
        recordAdWatched();
        track('ad_reward_claimed', { placementId: placement.id, pro: true, watched: false });
        onGranted(placement.id);
        return;
      }

      const watched = await showRewardedAd();
      if (!watched) {
        // No reward without a completed view, but this is not the player's
        // fault — do not count it as a dismissal against their allowance.
        errorToast('Ad unavailable', 'Could not load an ad just now. Try again shortly.');
        track('ad_prompt_failed', { placementId: placement.id, pro: false });
        onDismissed();
        return;
      }
      hapticSuccess();
      recordAdWatched();
      track('ad_reward_claimed', { placementId: placement.id, pro: false, watched: true });
      onGranted(placement.id);
    } finally {
      setBusy(false);
    }
  }, [placement, busy, userIsPro, recordAdWatched, onGranted, onDismissed]);

  // A free player can only be offered this if an ad can actually be shown.
  // Offering a reward the app cannot deliver is the failure mode that made
  // rewards Pro-only the last time ads were half-wired.
  if (!userIsPro && !REWARDED_ADS_USABLE) return null;

  return (
    <AnimatePresence>
      {open && placement && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={placement.title}
            className={cn(LIQUID_GLASS_SURFACE, 'relative w-full max-w-sm p-5 rounded-2xl')}
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={dismiss}
              disabled={busy}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-display font-bold text-foreground pr-8">
              {placement.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5">{placement.body}</p>

            {userIsPro && (
              <div className="flex items-center gap-1.5 mt-3 text-[11px] text-[hsl(var(--gold))]">
                <Crown className="w-3.5 h-3.5" />
                <span className="font-semibold">Pro — no ad needed</span>
              </div>
            )}

            <button
              onClick={accept}
              disabled={busy}
              className={cn(
                'mt-4 w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-all',
                'flex items-center justify-center gap-2 disabled:opacity-60',
                userIsPro
                  ? 'bg-[hsl(var(--gold))] text-[hsl(30,20%,10%)]'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : userIsPro ? (
                <Crown className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {busy ? 'Just a moment…' : userIsPro ? placement.claimCta : placement.watchCta}
            </button>

            <button
              onClick={dismiss}
              disabled={busy}
              className="mt-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
