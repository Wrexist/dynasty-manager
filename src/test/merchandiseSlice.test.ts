/**
 * merchandiseSlice — pricing, product-line toggles, campaign/signature-drop
 * lifecycle (184 LOC, previously untested). The launch *success* paths couple
 * to campaign-eligibility and player-marketability utils (which need match
 * history); this suite locks the deterministic surface: pricing, toggle,
 * cancel + cooldown, and every signature-drop guard branch.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getDefaultMerchState } from '@/utils/merchandise';
import { MERCH_CAMPAIGN_COOLDOWN_WEEKS, SIGNATURE_DROP_COOLDOWN_WEEKS } from '@/config/merchandise';
import type { MerchSignatureDrop } from '@/types/game';
import type { GameState } from '@/store/storeTypes';

const CLUB_ID = 'celtic';

type Merch = GameState['merchandise'];
function patchMerch(patch: Partial<Merch>) {
  const s = useGameStore.getState();
  useGameStore.setState({ merchandise: { ...s.merchandise, ...patch } });
}
const drop = (weeksRemaining: number): MerchSignatureDrop =>
  ({ playerId: 'p', playerName: 'P', weeksRemaining, totalWeeks: 4, weeklyBonus: 1000 });

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
  // Guarantee isolation — reset to a known merch baseline each test.
  useGameStore.setState({ merchandise: getDefaultMerchState() });
});

describe('merchandiseSlice — pricing & product lines', () => {
  it('setMerchPricing updates the tier', () => {
    expect(useGameStore.getState().merchandise.pricingTier).toBe('standard');
    useGameStore.getState().setMerchPricing('premium');
    expect(useGameStore.getState().merchandise.pricingTier).toBe('premium');
  });

  it('toggleProductLine deactivates then reactivates the default line', () => {
    // matchday_essentials is active by default and always unlocked.
    const off = useGameStore.getState().toggleProductLine('matchday_essentials');
    expect(off.success).toBe(true);
    expect(useGameStore.getState().merchandise.activeProductLines).not.toContain('matchday_essentials');

    const on = useGameStore.getState().toggleProductLine('matchday_essentials');
    expect(on.success).toBe(true);
    expect(useGameStore.getState().merchandise.activeProductLines).toContain('matchday_essentials');
  });
});

describe('merchandiseSlice — campaign cancel', () => {
  it('no-ops when there is no active campaign', () => {
    expect(() => useGameStore.getState().cancelCampaign()).not.toThrow();
    expect(useGameStore.getState().merchandise.activeCampaign).toBeNull();
    expect(useGameStore.getState().merchandise.campaignCooldownWeeks).toBe(0);
  });

  it('clears the active campaign and sets the cooldown', () => {
    patchMerch({ activeCampaign: { type: 'kit_launch', weeksRemaining: 3, totalWeeks: 4, revenueBoost: 0.2 } });
    useGameStore.getState().cancelCampaign();
    const m = useGameStore.getState().merchandise;
    expect(m.activeCampaign).toBeNull();
    expect(m.campaignCooldownWeeks).toBe(MERCH_CAMPAIGN_COOLDOWN_WEEKS);
  });
});

describe('merchandiseSlice — launchSignatureDrop guards', () => {
  it('rejects when a drop is already running', () => {
    patchMerch({ signatureDrop: drop(3) });
    const res = useGameStore.getState().launchSignatureDrop('anyone');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already running/i);
  });

  it('rejects during the cooldown', () => {
    patchMerch({ signatureDropCooldownWeeks: 2 });
    const res = useGameStore.getState().launchSignatureDrop('anyone');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cooldown/i);
  });

  it('rejects a player who already had a drop this season', () => {
    patchMerch({ signatureDropsUsedThisSeason: ['pUsed'] });
    const res = useGameStore.getState().launchSignatureDrop('pUsed');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already had a drop/i);
  });

  it('rejects an unknown player', () => {
    const res = useGameStore.getState().launchSignatureDrop('ghost');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });
});

describe('merchandiseSlice — cancelSignatureDrop', () => {
  it('no-ops when there is no drop', () => {
    expect(() => useGameStore.getState().cancelSignatureDrop()).not.toThrow();
    expect(useGameStore.getState().merchandise.signatureDrop).toBeNull();
  });

  it('clears the drop and sets the cooldown', () => {
    patchMerch({ signatureDrop: drop(2) });
    useGameStore.getState().cancelSignatureDrop();
    const m = useGameStore.getState().merchandise;
    expect(m.signatureDrop).toBeNull();
    expect(m.signatureDropCooldownWeeks).toBe(SIGNATURE_DROP_COOLDOWN_WEEKS);
  });
});
