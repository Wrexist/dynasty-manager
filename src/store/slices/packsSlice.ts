import * as Sentry from '@sentry/react';
import type { OpenedPackRecord, OpenPackResult, PackTierKey, PackUnlockMethod, Player, QuickSellPackedPlayerResult, ReleasePackedPlayerResult } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg, safeRandomUUID } from '@/utils/helpers';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE, FFP_WAGE_RATIO_WARNING } from '@/config/gameBalance';
import {
  PACK_TIER_MAP,
  RECENT_PULLS_LIMIT,
  isFreeOpenMethod,
  resolvePackTier,
  getFeaturedPackTier,
  WEEKLY_BONUS_CARDS,
  PACK_QUICK_SELL_RATE,
  packFrameFor,
  packVersionBoostFor,
} from '@/config/packs';
import { evaluateDailyStreak } from '@/utils/dailyStreak';
import { generateAiCounterSignings, generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import { CHALLENGES } from '@/data/challenges';
import { grantXP, XP_REWARDS } from '@/utils/managerPerks';
import { LEGENDARY_OVR_THRESHOLD, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
import { STAT_MAX as CAREER_STAT_MAX, GROWTH_NEGOTIATION_PER_TRANSFER as CAREER_STAT_GROWTH } from '@/config/managerCareer';
import { playPackSfx } from '@/utils/packAudio';
import {
  autoPlaceClubLineup,
  buildAutoFillContext,
  candidatesCanCrackSquad,
} from '@/utils/autoFillContext';
import { purgePlayerReferences } from '../helpers/rosterOps';
import {
  readDailyPackOpens,
  writeDailyPackOpens,
  currentDayIndex,
  readDailyStreak,
  readWeeklyPackBonus,
  writeWeeklyPackBonus,
  currentWeekIndex,
} from '../helpers/persistence';

/**
 * Transient (non-persisted) snapshot of the state slices a quick-sell touches,
 * captured just before the sale so it can be reverted by `undoLastQuickSell`.
 * Lives in module scope (not the save) because undo is only meaningful for a
 * few seconds while the "Undo" toast is on screen. Cleared on undo, on the next
 * pack open, or when the guard detects the world has moved on.
 */
type QuickSellSnapshot = { playerId: string; week: number; season: number; patch: Partial<GameState> };
let lastQuickSellSnapshot: QuickSellSnapshot | null = null;

/** Match transferSlice's challenge gate. Packs count as signings — respect
 *  noTransfers and youthOnly scenario flags. Returns a blocking message or
 *  null when allowed. */
function challengeBlockReason(state: GameState): string | null {
  const ch = state.activeChallenge;
  if (!ch || ch.completed || ch.failed) return null;
  const scenario = CHALLENGES.find(c => c.id === ch.scenarioId);
  if (!scenario) return null;
  if (scenario.noTransfers) return 'Packs are disabled in this challenge.';
  // Packs can roll any age; youth-only challenges can't safely allow them.
  if (scenario.youthOnly) return 'Challenge restricts signings to players aged 23 or under — packs are disabled.';
  return null;
}

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

// OpenedPackRecord, OpenPackResult, ReleasePackedPlayerResult all live in
// `@/types/game` (single source of truth for domain types).

/** Real-world date key (YYYY-MM-DD, device-local) used to LABEL the in-state
 *  mirror of the daily bucket. Display only — the allowance itself is judged
 *  against `currentDayIndex()`, which is monotonic. */
function todayDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export type CanOpenPackResult = { ok: true } | { ok: false; message: string };

/** Read today's free/ad open count for a given tier from state, defaulting
 *  to 0 if the bucket date no longer matches the device's current day. */
function todayCounts(_state: GameState, tierKey: PackTierKey): { free: number; ad: number } {
  // Read the DEVICE-global record, not the save. The bucket used to live only
  // in the save payload, which made a "daily" free pack per-slot (three saves =
  // three free Gold packs a day) and rerollable by force-quitting after a bad
  // pull. It also reset on date INEQUALITY, so winding the clock back — or just
  // changing timezone — re-armed it. `readDailyPackOpens` fixes both: one
  // device-wide record, keyed on a monotonic day index that only moves forward.
  const record = readDailyPackOpens();
  return {
    free: record.free[tierKey] || 0,
    ad: record.ad[tierKey] || 0,
  };
}

/** The player's consecutive-login streak, as the Daily Pack sees it.
 *
 *  Read from the DEVICE-global streak record rather than passed in by the page:
 *  the streak selects the Daily Pack's odds band, so a caller that could supply
 *  it could supply the day-7 pack on day one. Same reason the daily allowance
 *  is device-global and not per-save.
 *
 *  `evaluateDailyStreak(...).current` is today's run length whether or not the
 *  daily XP reward has been claimed — opening the free pack should not require
 *  first dismissing a modal. */
export function currentLoginStreak(): number {
  try {
    return Math.max(1, evaluateDailyStreak(readDailyStreak()).current);
  } catch {
    // A corrupt streak record must never block the free pack; fall back to the
    // weakest band, which is what a brand-new player gets anyway.
    return 1;
  }
}

/** Extra cards this open earns from the weekly featured bonus.
 *
 *  Granted only for a REAL-MONEY open of the currently featured tier, and only
 *  once per real week. Free and ad opens are excluded on purpose: the bonus is
 *  the reason to come back and buy this week's pack, and stapling it to the
 *  free pack would make it a weekly free upgrade instead.
 *
 *  Both `evaluateOpenPack` (squad-space check) and `openPack` (generation) call
 *  this, so the space we reserve is always the space we fill. */
export function weeklyBonusCardsFor(
  tierKey: PackTierKey,
  method: PackUnlockMethod | null,
): number {
  if (method !== 'iap') return 0;
  const tier = PACK_TIER_MAP[tierKey];
  if (!tier?.weeklyEligible) return 0;
  const weekIndex = currentWeekIndex();
  if (getFeaturedPackTier(weekIndex) !== tierKey) return 0;
  const claim = readWeeklyPackBonus();
  if (claim && claim.weekIndex === weekIndex) return 0;
  return WEEKLY_BONUS_CARDS;
}

/** Pick the cheapest available method for the user given their current
 *  daily usage. Page consumes this when no explicit method was passed.
 *  Order: free → ad → iap → currency. Returns null if nothing is
 *  available right now (e.g. all caps hit and no IAP/currency fallback). */
export function defaultMethodFor(
  state: GameState,
  tierKey: PackTierKey,
): PackUnlockMethod | null {
  const tier = PACK_TIER_MAP[tierKey];
  if (!tier) return null;
  const used = todayCounts(state, tierKey);
  if ((tier.freeDailyLimit ?? 0) > used.free) return 'free';
  if ((tier.adDailyLimit ?? 0) > used.ad) return 'ad';
  if (tier.productId) return 'iap';
  if ((tier.price ?? 0) > 0) return 'currency';
  return null;
}

/** Pure eligibility check for a specific method. The page MUST call this
 *  before kicking off any out-of-band cost (rewarded ad or consumable IAP)
 *  so the user can never pay real money or watch a full ad and then get
 *  rejected by `openPack`. Same checks `openPack` runs internally. */
function evaluateOpenPack(
  state: GameState,
  tierKey: PackTierKey,
  method?: PackUnlockMethod,
): CanOpenPackResult {
  const tier = PACK_TIER_MAP[tierKey];
  if (!tier) return { ok: false, message: 'Unknown pack tier.' };

  const club = state.clubs[state.playerClubId];
  if (!club) return { ok: false, message: 'No active club.' };

  const blocked = challengeBlockReason(state);
  if (blocked) return { ok: false, message: blocked };

  const resolvedMethod = method ?? defaultMethodFor(state, tierKey);
  if (!resolvedMethod) {
    return {
      ok: false,
      message: `No opens available — daily allowance used and no purchase option for ${tier.label}.`,
    };
  }

  const used = todayCounts(state, tierKey);

  if (resolvedMethod === 'free') {
    const cap = tier.freeDailyLimit ?? 0;
    if (cap === 0) return { ok: false, message: `${tier.label} has no free opens.` };
    if (used.free >= cap) {
      return {
        ok: false,
        message: `Today's free ${tier.label} already opened — come back tomorrow or watch an ad / buy more.`,
      };
    }
  } else if (resolvedMethod === 'ad') {
    const cap = tier.adDailyLimit ?? 0;
    if (cap === 0) return { ok: false, message: `${tier.label} doesn't support ad opens.` };
    if (used.ad >= cap) {
      return {
        ok: false,
        message: `Daily ad limit reached — ${cap} ad opens per day for ${tier.label}.`,
      };
    }
  } else if (resolvedMethod === 'iap') {
    if (!tier.productId) return { ok: false, message: `${tier.label} has no in-app purchase option.` };
  } else if (resolvedMethod === 'currency') {
    if ((tier.price ?? 0) <= 0) return { ok: false, message: `${tier.label} can't be bought with in-game money.` };
    if (club.budget < tier.price) return { ok: false, message: 'Insufficient funds for this pack.' };
  }

  // Reserve space for the weekly bonus card too. Checking only `tier.cards`
  // would let a bonus-carrying purchase pass pre-flight and then be rejected by
  // the same rule after the store had already charged for it.
  const packCards = tier.cards + weeklyBonusCardsFor(tierKey, resolvedMethod);
  const slotsAvailable = MAX_SQUAD_SIZE - club.playerIds.length;
  if (slotsAvailable < packCards) {
    return {
      ok: false,
      message: `Not enough squad space — this pack delivers ${packCards} player(s). Release players first.`,
    };
  }

  return { ok: true };
}

export const createPacksSlice = (set: Set, get: Get) => ({
  openedPacks: [] as OpenedPackRecord[],
  packPityCounter: 0,
  lastPackWeek: 0,
  lastPackSeason: 0,
  dailyPackOpens: { date: '', free: {}, ad: {} } as {
    date: string;
    free: Partial<Record<PackTierKey, number>>;
    ad: Partial<Record<PackTierKey, number>>;
  },
  /** Mirror of the device-global weekly-bonus claim, kept in state purely so
   *  the Market re-renders the moment the bonus is spent. The authority is
   *  `readWeeklyPackBonus()`; never gate on this field. */
  weeklyPackBonus: null as { weekIndex: number; tier: PackTierKey } | null,

  /** Eligibility pre-flight. Optional `method` lets the page check a
   *  specific path (e.g. "is the IAP path open?"); without it the slice
   *  evaluates the cheapest auto-picked method. Run this BEFORE charging
   *  real money so the user can't pay and then be blocked by a challenge
   *  or squad-cap rule. */
  canOpenPack: (tierKey: PackTierKey, method?: PackUnlockMethod): CanOpenPackResult =>
    evaluateOpenPack(get(), tierKey, method),

  openPack: (
    tierKey: PackTierKey,
    opts?: { method?: PackUnlockMethod; skipPayment?: boolean; suppressPaidRejectSentry?: boolean },
  ): OpenPackResult => {
    // Opening a new pack invalidates any pending quick-sell undo — the
    // snapshot would otherwise revert this fresh pack if restored.
    lastQuickSellSnapshot = null;
    const state = get();
    const tier = PACK_TIER_MAP[tierKey];
    if (!tier) return { success: false, message: 'Unknown pack tier.' };

    const skipPayment = opts?.skipPayment === true;
    const method = opts?.method ?? defaultMethodFor(state, tierKey);

    if (!method) {
      return {
        success: false,
        message: `No opens available — daily allowance used and no purchase option for ${tier.label}.`,
      };
    }

    // Out-of-band methods (ad, iap) require the page to have completed
    // the cost OUTSIDE this call. The page must pass skipPayment=true.
    // Without it we refuse to grant the pack — it's a misuse, not a
    // user-facing error path. The page is the single gatekeeper for ad
    // playback and consumable IAP completion.
    if ((method === 'ad' || method === 'iap') && !skipPayment) {
      return {
        success: false,
        message: method === 'ad'
          ? 'This pack requires watching a rewarded ad first.'
          : 'This pack requires an in-app purchase.',
      };
    }

    // Run the same eligibility checks the page used to pre-validate. If
    // anything has changed between pre-flight and now (challenge flipped,
    // squad cap exceeded), we still refuse to grant the pack — defense in
    // depth against pages that bypass `canOpenPack`. The page is the
    // single gatekeeper for ad playback and consumable IAP completion.
    //
    // For paid `iap` opens, surface a `paidButRejected` flag so the page
    // can route the user to support instead of just showing a generic
    // error toast — they paid real money and deserve a clear next step.
    // We also fire a Sentry alert because this scenario should be
    // impossible in practice (the UI's `busy` flag prevents any state-
    // mutating action during the IAP flight); if it ever fires in
    // production, that's a bug we need to know about.
    const eligible = evaluateOpenPack(state, tierKey, method);
    if (eligible.ok === false) {
      const paidButRejected = method === 'iap' && skipPayment === true;
      // The crash-recovery reconciler retries this every mount while the block
      // persists (e.g. squad full). It throttles the alert to once per marker
      // via `suppressPaidRejectSentry`, so we don't re-report an already-known
      // stranded pack on every visit to the Packs page.
      if (paidButRejected && !opts?.suppressPaidRejectSentry) {
        Sentry.captureMessage(
          `[openPack] Paid IAP rejected at re-validation — investigate. tier=${tierKey} reason=${eligible.message}`,
          'error',
        );
      }
      return {
        success: false,
        message: eligible.message,
        ...(paidButRejected ? { paidButRejected: true } : {}),
      };
    }

    const club = state.clubs[state.playerClubId]!;
    const today = todayDateKey();
    // Authoritative allowance is the device record; the state field is a mirror
    // kept purely so the UI re-renders when a count changes.
    const deviceBucket = readDailyPackOpens();
    const usedToday = { date: today, free: { ...deviceBucket.free }, ad: { ...deviceBucket.ad } };

    const pityTriggered = shouldPityTrigger(state.packPityCounter || 0);
    // A free daily / rewarded-ad open uses the tier's weaker odds where it has
    // them (currently Gold). Paid opens are unaffected.
    const freeOpen = isFreeOpenMethod(method);
    const streak = currentLoginStreak();
    const bonusCards = weeklyBonusCardsFor(tierKey, method);
    // Boost and frame (below) resolve from the SAME week on purpose: the frame
    // is the claim ("this is a Dynasty card") and the boost is what the claim
    // is worth. If they ever came apart, a promo frame would sit on a
    // standard-issue card or vice versa.
    const versionBoost = packVersionBoostFor(tierKey, currentWeekIndex());
    const players = generatePackContents(tierKey, state.season, {
      pityTriggered, freeOpen, streak, extraCards: bonusCards, versionBoost,
    });

    // Claim players onto the club roster. Generators created them with
    // clubId = ''; we finalize ownership here.
    const newPlayers = { ...state.players };
    // Frame for cards that cleared this pack's guaranteed floor. Resolved with
    // the CURRENT week so a featured pack stamps its promo frame — that is what
    // makes a promo frame dated rather than farmable. Cosmetic only.
    const earnedFrame = packFrameFor(tierKey, currentWeekIndex());
    const frameFloor = resolvePackTier(tier, { freeOpen, streak }).guaranteedMinOvr;

    const finalizedPlayers: Player[] = players.map(p => {
      const owned: Player = { ...p, clubId: state.playerClubId, joinedSeason: state.season };
      if (earnedFrame && p.overall >= frameFloor) owned.packFrame = earnedFrame;
      newPlayers[owned.id] = owned;
      return owned;
    });

    // Only `currency` opens charge club budget. Free/ad opens are
    // zero-cost; IAP opens are paid in real money outside the simulation.
    const budgetDeduction = method === 'currency' ? (tier.price ?? 0) : 0;
    const updatedClub = {
      ...club,
      budget: Math.max(0, club.budget - budgetDeduction),
      playerIds: [...club.playerIds, ...finalizedPlayers.map(p => p.id)],
      wageBill: club.wageBill + finalizedPlayers.reduce((s, p) => s + p.wage, 0),
    };

    const record: OpenedPackRecord = {
      id: safeRandomUUID(),
      tier: tierKey,
      season: state.season,
      week: state.week,
      timestamp: Date.now(),
      playerIds: finalizedPlayers.map(p => p.id),
      topOvr: finalizedPlayers.reduce((m, p) => Math.max(m, p.overall), 0),
    };

    const newPity = updatedPityCounter(state.packPityCounter || 0, finalizedPlayers);
    const topPlayer = finalizedPlayers.reduce((best, p) => p.overall > best.overall ? p : best, finalizedPlayers[0]);

    const costLabel = method === 'currency'
      ? `cost £${(tier.price / 1e6).toFixed(1)}M`
      : method === 'ad'
        ? 'opened with a rewarded ad'
        : method === 'iap'
          ? 'unlocked via in-app purchase'
          : 'opened with today\'s free allowance';
    let newMessages = addMsg(state.messages, {
      week: state.week,
      season: state.season,
      type: 'transfer',
      title: `${tier.label} Opened`,
      body: `${tier.label} ${costLabel}. Top pull: ${topPlayer.firstName} ${topPlayer.lastName} (${topPlayer.overall} OVR, ${topPlayer.position}). ${tier.cards} player(s) added to your squad.`,
    });

    // FFP wage-ratio warning — mirrors renewContract. A stack of Icon/Rare
    // pack wages can push the ratio above the threshold in a single open.
    const lastFinance = state.financeHistory[state.financeHistory.length - 1];
    if (lastFinance && lastFinance.income > 0) {
      const staffWages = state.staff.members.reduce((s, m) => s + m.wage, 0);
      const projectedExpenses = updatedClub.wageBill + staffWages;
      const wageRatio = projectedExpenses / lastFinance.income;
      if (wageRatio >= FFP_WAGE_RATIO_WARNING) {
        newMessages = addMsg(newMessages, {
          week: state.week,
          season: state.season,
          type: 'board',
          title: 'FFP: Wage Bill Warning',
          body: `Opening the ${tier.label} pushed your wage-to-revenue ratio to ${Math.round(wageRatio * 100)}%. The board may penalise you if spending is not reduced.`,
        });
      }
    }

    // Finance ledger: mirror transferSlice's approach — don't write a
    // mid-week financeHistory row (those are created at week-end by
    // advanceWeek with balance = club.budget). Writing one here with
    // `balance: -tier.price` produced a false negative entry on the
    // Finance chart. We still bump the season-level running total so
    // season summaries reflect the spend.
    const newOpenedPacks = [record, ...(state.openedPacks || [])].slice(0, 200);

    // AI counter-signings + lineup re-optimization are NOT needed for the
    // reveal and are the heavy part of opening a pack (player generation +
    // an O(n³) Hungarian solve per affected club). They run in
    // `runPostProcess` below, scheduled AFTER the reveal overlay mounts, so
    // the tap → animation never blocks on them. The pulled players ARE
    // written synchronously in the first set() (paid-pack safety + the
    // quick-sell/undo handlers depend on them existing immediately).

    // ── Manager XP for rare pulls ──
    // Walkout-tier pulls grant career XP, scaling with OVR. Standard pulls
    // get nothing — they're already a reward via the player itself.
    let xpEarned = 0;
    if (topPlayer.overall >= LEGENDARY_OVR_THRESHOLD) xpEarned = XP_REWARDS.packLegendaryPull;
    else if (topPlayer.overall >= WALKOUT_OVR_THRESHOLD) xpEarned = XP_REWARDS.packRarePull;
    const newProgression = xpEarned > 0
      ? grantXP(state.managerProgression, xpEarned)
      : state.managerProgression;

    // ── Career-mode scoutingEye growth ──
    // Mirrors transferSlice growing `negotiation` on a successful transfer.
    // Opening packs is a talent-spotting decision, so it grows scoutingEye
    // (smaller per-pack growth than per-transfer since packs are cheaper).
    let newCareerManager = state.careerManager;
    if (state.gameMode === 'career' && state.careerManager) {
      newCareerManager = {
        ...state.careerManager,
        attributes: {
          ...state.careerManager.attributes,
          scoutingEye: Math.min(CAREER_STAT_MAX, state.careerManager.attributes.scoutingEye + CAREER_STAT_GROWTH * 0.5),
        },
      };
    }

    // Audio cue (no-op until assets are wired).
    playPackSfx(topPlayer.overall >= WALKOUT_OVR_THRESHOLD ? 'rare-pull' : 'standard-pull');

    // Bump the matching per-day bucket so daily caps survive save reloads.
    // The date rolls over the moment a new ISO-day starts; existing
    // buckets fall away with it.
    let nextDailyOpens: GameState['dailyPackOpens'] = usedToday;
    if (method === 'free') {
      nextDailyOpens = {
        date: today,
        free: { ...usedToday.free, [tierKey]: (usedToday.free[tierKey] || 0) + 1 },
        ad: usedToday.ad,
      };
    } else if (method === 'ad') {
      nextDailyOpens = {
        date: today,
        free: usedToday.free,
        ad: { ...usedToday.ad, [tierKey]: (usedToday.ad[tierKey] || 0) + 1 },
      };
    }
    // Burn the weekly featured bonus. Written OUTSIDE the save and immediately,
    // for the same reason the daily bucket is: deferring it to the next autosave
    // would make the bonus a best-of-N reroll (force-quit after a bad pull and
    // the bonus comes back). It is recorded only once the pack has actually been
    // generated, so a rejected open never consumes the week's bonus.
    if (bonusCards > 0) {
      writeWeeklyPackBonus({ weekIndex: currentWeekIndex(), tier: tierKey });
    }

    if (nextDailyOpens !== usedToday) {
      // Persist outside the save, immediately. Deferring this to the next
      // autosave is what made the free daily pack a best-of-N reroll: quit
      // after a bad pull and the allowance came back with the old save.
      writeDailyPackOpens({
        dayIndex: currentDayIndex(),
        free: nextDailyOpens.free as Record<string, number>,
        ad: nextDailyOpens.ad as Record<string, number>,
      });
    }

    // ── Phase 1: synchronous core write ──
    // Writes the pulled players into the squad immediately so the reveal,
    // paid-pack saveGame(), and quick-sell/undo handlers are all correct.
    // AI backfill + lineup re-optimization are NOT here — they run deferred.
    set({
      players: newPlayers,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      openedPacks: newOpenedPacks,
      packPityCounter: newPity,
      lastPackWeek: state.week,
      lastPackSeason: state.season,
      dailyPackOpens: nextDailyOpens,
      ...(bonusCards > 0
        ? { weeklyPackBonus: { weekIndex: currentWeekIndex(), tier: tierKey } }
        : {}),
      messages: newMessages,
      seasonTotalExpenses: (state.seasonTotalExpenses || 0) + budgetDeduction,
      managerProgression: newProgression,
      careerManager: newCareerManager,
      lastMatchXPGain: xpEarned > 0 ? xpEarned : state.lastMatchXPGain,
    });

    // ── Phase 2: deferred post-processing ──
    // The heavy, reveal-irrelevant work: AI counter-signings and the
    // Hungarian lineup re-optimization (user + affected AI clubs). Reads
    // FRESH state via get() and merges functionally so it can never clobber
    // an interleaving quick-sell. The placement badges shown at the summary
    // (seconds away) read the live, re-optimized lineup via a reactive memo
    // in PacksPage, so they stay correct without blocking the reveal.
    const packPlayerIds = finalizedPlayers.map(p => p.id);
    const runPostProcess = () => {
      const s = get();
      const pid = s.playerClubId;
      const userClub = s.clubs[pid];
      if (!userClub) return;

      // AI counter-signings at strictly lower OVR (league keeps pace). Passes
      // the same `freeOpen` resolution as the pull itself — the AI ceiling is
      // derived from the user's guarantee, so a free Gold open must lower the
      // AI ceiling too or the counter-signings would out-rate the user's card.
      const aiBackfill = generateAiCounterSignings(tierKey, s.clubs, pid, s.playerDivision, s.season, freeOpen, streak);
      let clubsAcc = s.clubs;
      const playersAcc = { ...s.players };
      for (const [aiClubId, aiPlayers] of Object.entries(aiBackfill.perClub)) {
        const aiClub = clubsAcc[aiClubId];
        if (!aiClub) continue;
        const aiNewIds: string[] = [];
        let aiAddedWages = 0;
        for (const p of aiPlayers) { playersAcc[p.id] = p; aiNewIds.push(p.id); aiAddedWages += p.wage; }
        clubsAcc = {
          ...clubsAcc,
          [aiClubId]: { ...aiClub, playerIds: [...aiClub.playerIds, ...aiNewIds], wageBill: aiClub.wageBill + aiAddedWages },
        };
      }

      // Auto-place the user's pulls into lineup/subs (fast-path skip when
      // they clearly can't crack the squad).
      let clubsFinal = clubsAcc;
      const playerClub = clubsAcc[pid];
      if (playerClub && candidatesCanCrackSquad(playerClub, playersAcc, packPlayerIds)) {
        const context = buildAutoFillContext(s, pid, { clubs: clubsAcc, players: playersAcc });
        const optimized = autoPlaceClubLineup(playerClub, playersAcc, s.week, s.season, context);
        if (optimized !== playerClub) clubsFinal = { ...clubsAcc, [pid]: optimized };
      }

      // Re-optimize AI clubs that received counter-signings.
      for (const aiClubId of Object.keys(aiBackfill.perClub)) {
        if (aiClubId === pid) continue;
        const aiClub = clubsFinal[aiClubId];
        if (!aiClub) continue;
        const optimized = autoPlaceClubLineup(aiClub, playersAcc, s.week, s.season);
        if (optimized !== aiClub) clubsFinal = { ...clubsFinal, [aiClubId]: optimized };
      }

      const postLineup = clubsFinal[pid]?.lineup || [];
      const lineupChanges = postLineup.filter((id, i) => id !== (userClub.lineup || [])[i]).length;

      set({
        players: playersAcc,
        clubs: clubsFinal,
        ...(lineupChanges > 0 ? {
          messages: addMsg(s.messages, {
            week: s.week, season: s.season, type: 'transfer',
            title: 'Lineup Updated',
            body: `Auto-placed pack players: ${lineupChanges} lineup change${lineupChanges > 1 ? 's' : ''} applied.`,
          }),
        } : {}),
      });
    };
    // Schedule after the overlay paints. iOS WKWebView has no
    // requestIdleCallback, so the setTimeout fallback is the device path.
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') ric(runPostProcess, { timeout: 600 });
    else setTimeout(runPostProcess, 0);

    return {
      success: true,
      message: `${tier.label} opened — ${tier.cards} player(s) signed.`,
      players: finalizedPlayers,
      record,
      pityTriggered,
      method,
    };
  },

  /** Lightweight escape hatch for the pack summary — releases a player that
   *  was just revealed with only 1 week's wage severance (vs. full-contract
   *  severance in `releasePlayer`). Only works on the most recent open's
   *  roster AND only during the same in-game season/week the pack was
   *  opened, so it can't be abused to dump veterans cheaply after the fact. */
  releasePackedPlayer: (playerId: string): ReleasePackedPlayerResult => {
    // Any roster-mutating pack action invalidates a pending quick-sell undo
    // (mirrors openPack) — restoring the snapshot would silently revert this
    // release while keeping its severance charge.
    lastQuickSellSnapshot = null;
    const state = get();
    const last = (state.openedPacks || [])[0];
    if (
      !last
      || last.season !== state.season
      || last.week !== state.week
      || !last.playerIds.includes(playerId)
    ) {
      return { success: false, message: 'Can only quick-release players from the pack you just opened.' };
    }
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) {
      return { success: false, message: 'Not your player.' };
    }
    const club = state.clubs[state.playerClubId];
    if (club.playerIds.length <= MIN_SQUAD_SIZE) {
      return { success: false, message: `Cannot release — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
    }
    const severance = Math.round(player.wage);
    if (club.budget < severance) {
      return { success: false, message: `Need £${severance.toLocaleString()} for one week's severance.` };
    }

    const strippedClub = {
      ...club,
      budget: club.budget - severance,
      playerIds: club.playerIds.filter(id => id !== playerId),
      lineup: club.lineup.filter(id => id !== playerId),
      subs: club.subs.filter(id => id !== playerId),
      wageBill: Math.max(0, club.wageBill - player.wage),
    };

    // Refill the vacated lineup/sub slot so the user doesn't end up
    // with 10 starters after a quick-release. Uses the same optimizer
    // as openPack; the released player is excluded because their clubId
    // is now '' in the updated players map we build below.
    const nextPlayers = {
      ...state.players,
      [playerId]: { ...player, clubId: '' },
    };
    const updatedClub = autoPlaceClubLineup(
      strippedClub,
      nextPlayers,
      state.week,
      state.season,
      buildAutoFillContext(state, state.playerClubId, {
        clubs: { ...state.clubs, [state.playerClubId]: strippedClub },
        players: nextPlayers,
      }),
    );

    const releasedPlayer = {
      ...player,
      clubId: '',
      contractEnd: state.season,
      listedForSale: false,
      sellOnPercentage: undefined,
      sellOnClubId: undefined,
    };

    // Remove from the record so the summary re-renders without this card
    const updatedRecord: OpenedPackRecord = {
      ...last,
      playerIds: last.playerIds.filter(id => id !== playerId),
    };
    const remainingPackPlayers = updatedRecord.playerIds
      .map(id => state.players[id])
      .filter(Boolean) as Player[];
    updatedRecord.topOvr = remainingPackPlayers.reduce((m, p) => Math.max(m, p.overall), 0);

    const newOpenedPacks = [...state.openedPacks];
    newOpenedPacks[0] = updatedRecord;

    const newMessages = addMsg(state.messages, {
      week: state.week,
      season: state.season,
      type: 'transfer',
      title: `${player.lastName} Released`,
      body: `${player.firstName} ${player.lastName} was dismissed from the pack line-up. Severance: £${severance.toLocaleString()}.`,
    });

    set({
      players: { ...state.players, [playerId]: releasedPlayer },
      clubs: { ...state.clubs, [state.playerClubId]: updatedClub },
      freeAgents: [...state.freeAgents, playerId],
      openedPacks: newOpenedPacks,
      messages: newMessages,
      // Severance counts as a season-level expense so the Finance summary
      // reflects the true cost of pack churn.
      seasonTotalExpenses: (state.seasonTotalExpenses || 0) + severance,
      // Reference cleanup — pack release uses the same surface area as
      // a regular release (a freshly-packed player can have a pending
      // transfer talk, scout note, or farewell entry if they were a
      // re-pack of a former squad member).
      ...purgePlayerReferences(state, playerId),
    });

    return { success: true, message: `${player.firstName} ${player.lastName} released.` };
  },

  /** Quick-sell a just-packed player for 65% of their market value. Same
   *  freshness guard as {@link releasePackedPlayer} — only the latest
   *  pack's roster, same (season, week). Unlike release, this credits the
   *  club budget instead of charging severance: it's a liquidity escape
   *  for dupes and low-OVR pulls. */
  quickSellPackedPlayer: (playerId: string): QuickSellPackedPlayerResult => {
    const state = get();
    const last = (state.openedPacks || [])[0];
    if (
      !last
      || last.season !== state.season
      || last.week !== state.week
      || !last.playerIds.includes(playerId)
    ) {
      return { success: false, message: 'Can only quick-sell players from the pack you just opened.' };
    }
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) {
      return { success: false, message: 'Not your player.' };
    }
    const club = state.clubs[state.playerClubId];
    if (club.playerIds.length <= MIN_SQUAD_SIZE) {
      return { success: false, message: `Cannot quick-sell — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
    }
    const amount = Math.max(0, Math.round((player.value || 0) * PACK_QUICK_SELL_RATE));

    const strippedClub = {
      ...club,
      budget: club.budget + amount,
      playerIds: club.playerIds.filter(id => id !== playerId),
      lineup: club.lineup.filter(id => id !== playerId),
      subs: club.subs.filter(id => id !== playerId),
      wageBill: Math.max(0, club.wageBill - player.wage),
    };

    // Same refill pass the release flow does — avoids ending up with
    // a 10-man lineup when the quick-sold card was auto-placed as a starter.
    const nextPlayers = {
      ...state.players,
      [playerId]: { ...player, clubId: '' },
    };
    const updatedClub = autoPlaceClubLineup(
      strippedClub,
      nextPlayers,
      state.week,
      state.season,
      buildAutoFillContext(state, state.playerClubId, {
        clubs: { ...state.clubs, [state.playerClubId]: strippedClub },
        players: nextPlayers,
      }),
    );

    const soldPlayer = {
      ...player,
      clubId: '',
      contractEnd: state.season,
      listedForSale: false,
      sellOnPercentage: undefined,
      sellOnClubId: undefined,
    };

    const updatedRecord: OpenedPackRecord = {
      ...last,
      playerIds: last.playerIds.filter(id => id !== playerId),
    };
    const remainingPackPlayers = updatedRecord.playerIds
      .map(id => state.players[id])
      .filter(Boolean) as Player[];
    updatedRecord.topOvr = remainingPackPlayers.reduce((m, p) => Math.max(m, p.overall), 0);

    const newOpenedPacks = [...state.openedPacks];
    newOpenedPacks[0] = updatedRecord;

    const newMessages = addMsg(state.messages, {
      week: state.week,
      season: state.season,
      type: 'transfer',
      title: `${player.lastName} Quick-Sold`,
      body: `${player.firstName} ${player.lastName} was quick-sold for £${amount.toLocaleString()} (65% of market value).`,
    });

    // Snapshot every slice this sale mutates so the "Undo" toast can revert it
    // exactly (rather than recomputing a fragile inverse). References are safe
    // to keep: the store updates immutably, so these point at the pre-sale data.
    lastQuickSellSnapshot = {
      playerId,
      week: state.week,
      season: state.season,
      patch: {
        players: state.players,
        clubs: state.clubs,
        freeAgents: state.freeAgents,
        openedPacks: state.openedPacks,
        messages: state.messages,
        seasonTotalIncome: state.seasonTotalIncome,
        transferMarket: state.transferMarket,
        incomingOffers: state.incomingOffers,
        incomingLoanOffers: state.incomingLoanOffers,
        outgoingLoanRequests: state.outgoingLoanRequests,
        activeLoans: state.activeLoans,
        shortlist: state.shortlist,
        scoutWatchList: state.scoutWatchList,
        negotiationStrikes: state.negotiationStrikes,
        contractStrikes: state.contractStrikes,
        pendingFarewell: state.pendingFarewell,
        pendingTransferTalk: state.pendingTransferTalk,
        merchandise: state.merchandise,
      },
    };

    set({
      players: { ...state.players, [playerId]: soldPlayer },
      clubs: { ...state.clubs, [state.playerClubId]: updatedClub },
      // NOT added to freeAgents: the player is SOLD (treated as transferred
      // abroad, like the storyline saga sale). Free-agenting him enabled a
      // value loop — quick-sell for 65% of value, then re-sign from free
      // agency for only a signing bonus. The orphan record (clubId '') is
      // purged at season end.
      openedPacks: newOpenedPacks,
      messages: newMessages,
      // Mirror `releasePackedPlayer`'s tracking of severance into expenses:
      // quick-sell credits the budget so it MUST also bump seasonTotalIncome,
      // otherwise the SeasonSummary shows a stealth cash surplus (money
      // arrives with no Income line). Now that this field survives save/load,
      // the under-reporting is permanent.
      seasonTotalIncome: (state.seasonTotalIncome || 0) + amount,
      // Reference cleanup parity with regular release flows.
      ...purgePlayerReferences(state, playerId),
    });

    return {
      success: true,
      message: `${player.firstName} ${player.lastName} sold for £${amount.toLocaleString()}.`,
      amount,
    };
  },

  /** Revert the most recent quick-sell. Only valid immediately (before the week
   *  advances or the player is re-claimed); returns false if it's too late. */
  undoLastQuickSell: (): boolean => {
    const snap = lastQuickSellSnapshot;
    if (!snap) return false;
    const state = get();
    if (
      state.week !== snap.week
      || state.season !== snap.season
      || state.players[snap.playerId]?.clubId !== ''
    ) {
      lastQuickSellSnapshot = null;
      return false;
    }
    set({ ...snap.patch });
    lastQuickSellSnapshot = null;
    return true;
  },
});

export { RECENT_PULLS_LIMIT };
