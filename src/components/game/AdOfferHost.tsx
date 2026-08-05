/**
 * Ad-offer host.
 *
 * Owns WHEN an offer appears and WHAT it grants; `AdOfferModal` owns how it
 * looks and `utils/adPacing.ts` owns whether it is allowed at all.
 *
 * Mounted once inside the in-game shell. It watches for natural gaps — the
 * player has just landed on a screen where the offered reward is actually
 * useful — and raises at most one offer, subject to pacing.
 *
 * Placement is CONTEXTUAL, not random: a budget top-up is offered when the
 * transfer window is open and the budget is low, a scout reveal when there is
 * an unrevealed report, an academy preview when an intake is pending. An offer
 * for something the player cannot use is just an interruption, and it trains
 * them to dismiss on sight — which the decay logic then reads as disinterest.
 */
import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { AdOfferModal } from '@/components/game/AdOfferModal';
import { AD_PLACEMENTS, AD_OFFER_LOW_BUDGET_WAGE_WEEKS, type AdPlacementId } from '@/config/ads';
import { canPrompt } from '@/utils/adPacing';
import { REWARDED_ADS_USABLE } from '@/utils/ads';
import { canClaimAdReward } from '@/utils/monetization';
import { successToast } from '@/utils/gameToast';
import { SCOUTING_KNOWLEDGE_THRESHOLDS } from '@/config/ui';

/** How long after mount / screen change before an offer may surface. Long
 *  enough that the player has actually looked at the screen first. */
const SETTLE_MS = 2500;

export function AdOfferHost() {
  const monetization = useGameStore(s => s.monetization);
  const season = useGameStore(s => s.season);
  const screen = useGameStore(s => s.currentScreen);
  const club = useGameStore(s => s.clubs[s.playerClubId]);
  const scoutReports = useGameStore(s => s.scouting?.reports);
  const youthAcademy = useGameStore(s => s.youthAcademy);
  const transferWindowOpen = useGameStore(s => s.transferWindowOpen);

  const applyTransferBudgetBonus = useGameStore(s => s.applyTransferBudgetBonus);
  const applyYouthPreview = useGameStore(s => s.applyYouthPreview);
  const boostScoutReports = useGameStore(s => s.boostScoutReports);
  const claimAdReward = useGameStore(s => s.claimAdReward);

  const [placementId, setPlacementId] = useState<AdPlacementId | null>(null);

  /** Which placement, if any, is contextually useful on this screen right now. */
  const pickPlacement = useCallback((): AdPlacementId | null => {
    const claimable = (id: AdPlacementId) => {
      const reward = AD_PLACEMENTS[id].rewardType;
      return reward ? canClaimAdReward(monetization, reward, season) : true;
    };

    if (screen === 'scouting') {
      // "Unrevealed" means the report still hides the player's overall — the
      // exact thing boostScoutReports unlocks by raising knowledgeLevel.
      // Offering the reveal when nothing is hidden would grant nothing.
      const hasUnrevealed = (scoutReports ?? []).some(
        r => r && r.knowledgeLevel < SCOUTING_KNOWLEDGE_THRESHOLDS.REVEAL_OVERALL,
      );
      if (hasUnrevealed && claimable('scout_potential')) return 'scout_potential';
    }

    if (screen === 'youth-academy' && youthAcademy && claimable('youth_preview')) {
      if (!youthAcademy.youthPreviewEnhanced) return 'youth_preview';
    }

    if ((screen === 'transfers' || screen === 'squad') && club && claimable('transfer_budget')) {
      // The two conditions this file's own header promises, which were never
      // implemented — the gate was `club &&`, nothing more. Without them a
      // player sitting on £200M in December got pitched a budget top-up on the
      // squad screen: an offer for something they cannot use, which is the
      // exact "just an interruption" the header warns trains people to dismiss
      // on sight — and the decay logic then reads that as disinterest.
      if (!transferWindowOpen) return null;
      const budgetIsLow = club.budget < club.wageBill * AD_OFFER_LOW_BUDGET_WAGE_WEEKS;
      if (!budgetIsLow) return null;
      return 'transfer_budget';
    }

    return null;
  }, [screen, scoutReports, youthAcademy, club, monetization, season, transferWindowOpen]);

  useEffect(() => {
    // Already showing one — don't stack or churn.
    if (placementId) return;

    const timer = setTimeout(() => {
      const decision = canPrompt(monetization, Date.now(), REWARDED_ADS_USABLE);
      if (!decision.allowed) return;
      const next = pickPlacement();
      if (next) setPlacementId(next);
    }, SETTLE_MS);

    return () => clearTimeout(timer);
  }, [screen, placementId, monetization, pickPlacement]);

  const handleGranted = useCallback(
    (id: AdPlacementId) => {
      const def = AD_PLACEMENTS[id];
      // Record against the per-season ledger so limits still apply, then grant.
      if (def.rewardType) claimAdReward(def.rewardType);

      switch (id) {
        case 'transfer_budget':
          applyTransferBudgetBonus();
          successToast('Budget boosted', 'Funds added to your transfer budget.');
          break;
        case 'scout_potential':
          boostScoutReports();
          successToast('Potential revealed', 'Your scout reports now show hidden potential.');
          break;
        case 'youth_preview':
          applyYouthPreview();
          successToast('Intake preview unlocked', 'Take a look at your next academy class.');
          break;
        default:
          break;
      }
      setPlacementId(null);
    },
    [claimAdReward, applyTransferBudgetBonus, boostScoutReports, applyYouthPreview],
  );

  const handleDismissed = useCallback(() => setPlacementId(null), []);

  return (
    <AdOfferModal
      placementId={placementId}
      onGranted={handleGranted}
      onDismissed={handleDismissed}
    />
  );
}
