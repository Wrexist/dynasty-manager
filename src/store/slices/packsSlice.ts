import type { OpenedPackRecord, OpenPackResult, PackTierKey, Player, QuickSellPackedPlayerResult, ReleasePackedPlayerResult } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { MAX_SQUAD_SIZE, FFP_WAGE_RATIO_WARNING } from '@/config/gameBalance';
import { PACK_TIER_MAP, RECENT_PULLS_LIMIT } from '@/config/packs';
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

/** Real-world date key (YYYY-MM-DD, device-local) used to bucket
 *  daily ad-pack opens. Lives in the slice so tests can stub `Date`
 *  without touching production timezone logic. */
function todayDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export type CanOpenPackResult = { ok: true } | { ok: false; message: string };

/** Pure eligibility check. The page MUST call this before kicking off any
 *  out-of-band cost (rewarded ad or consumable IAP) so the user can never
 *  pay real money or watch a full ad and then get rejected by `openPack`.
 *  Mirrors the validation block at the top of `openPack` exactly — keep
 *  the two in sync. The IAP-without-skipPayment branch is intentionally
 *  skipped here because the page knows it'll pass skipPayment after a
 *  successful purchase. */
function evaluateOpenPack(state: GameState, tierKey: PackTierKey): CanOpenPackResult {
  const tier = PACK_TIER_MAP[tierKey];
  if (!tier) return { ok: false, message: 'Unknown pack tier.' };

  const club = state.clubs[state.playerClubId];
  if (!club) return { ok: false, message: 'No active club.' };

  const blocked = challengeBlockReason(state);
  if (blocked) return { ok: false, message: blocked };

  const unlock = tier.unlock || 'currency';

  const today = todayDateKey();
  const adOpens = state.adPackOpens || { date: '', counts: {} };
  const adOpensToday = adOpens.date === today ? (adOpens.counts[tierKey] || 0) : 0;
  if (unlock === 'ad' && tier.dailyLimit != null && adOpensToday >= tier.dailyLimit) {
    return { ok: false, message: `Daily limit reached — ${tier.dailyLimit} ${tier.label}s per day. Come back tomorrow.` };
  }

  if (unlock === 'currency' && club.budget < tier.price) {
    return { ok: false, message: 'Insufficient funds for this pack.' };
  }

  const slotsAvailable = MAX_SQUAD_SIZE - club.playerIds.length;
  if (slotsAvailable < tier.cards) {
    return {
      ok: false,
      message: `Not enough squad space — this pack delivers ${tier.cards} player(s). Release players first.`,
    };
  }

  return { ok: true };
}

export const createPacksSlice = (set: Set, get: Get) => ({
  openedPacks: [] as OpenedPackRecord[],
  packPityCounter: 0,
  lastPackWeek: 0,
  lastPackSeason: 0,
  adPackOpens: { date: '', counts: {} } as { date: string; counts: Partial<Record<PackTierKey, number>> },

  /** Eligibility pre-flight. Returns `{ ok: true }` only if `openPack`
   *  would succeed *given that payment will be provided* (currency
   *  funds, rewarded ad watched, or consumable IAP completed). Run this
   *  before charging real money so the user can't pay and then be
   *  blocked by a challenge or squad-cap rule. */
  canOpenPack: (tierKey: PackTierKey): CanOpenPackResult => evaluateOpenPack(get(), tierKey),

  openPack: (tierKey: PackTierKey, opts?: { skipPayment?: boolean }): OpenPackResult => {
    const state = get();
    const tier = PACK_TIER_MAP[tierKey];
    if (!tier) return { success: false, message: 'Unknown pack tier.' };

    const skipPayment = opts?.skipPayment === true;
    const unlock = tier.unlock || 'currency';

    // IAP packs require a successful real-money purchase from the page
    // before openPack is invoked. Checked early so the daily/funds gates
    // below don't accidentally produce a misleading error message for
    // an IAP-tier call.
    if (unlock === 'iap' && !skipPayment) {
      return { success: false, message: 'This pack requires an in-app purchase.' };
    }

    // Run the same eligibility checks the page used to pre-validate. If
    // anything has changed between pre-flight and now (state changed
    // mid-ad, etc.), we still refuse to grant the pack — the page is
    // responsible for refunding/handling on its end.
    const eligible = evaluateOpenPack(state, tierKey);
    if (!eligible.ok) {
      return { success: false, message: eligible.message };
    }

    const club = state.clubs[state.playerClubId]!;
    const today = todayDateKey();
    const adOpens = state.adPackOpens || { date: '', counts: {} };
    const adOpensToday = adOpens.date === today ? (adOpens.counts[tierKey] || 0) : 0;

    const pityTriggered = shouldPityTrigger(state.packPityCounter || 0);
    const players = generatePackContents(tierKey, state.season, { pityTriggered });

    // Claim players onto the club roster. Generators created them with
    // clubId = ''; we finalize ownership here.
    const newPlayers = { ...state.players };
    const finalizedPlayers: Player[] = players.map(p => {
      const owned: Player = { ...p, clubId: state.playerClubId, joinedSeason: state.season };
      newPlayers[owned.id] = owned;
      return owned;
    });

    // Only `currency` packs charge club budget. Ad packs are free; IAP
    // packs are paid in real money outside the simulation.
    const budgetDeduction = unlock === 'currency' ? tier.price : 0;
    const updatedClub = {
      ...club,
      budget: Math.max(0, club.budget - budgetDeduction),
      playerIds: [...club.playerIds, ...finalizedPlayers.map(p => p.id)],
      wageBill: club.wageBill + finalizedPlayers.reduce((s, p) => s + p.wage, 0),
    };

    const record: OpenedPackRecord = {
      id: crypto.randomUUID(),
      tier: tierKey,
      season: state.season,
      week: state.week,
      timestamp: Date.now(),
      playerIds: finalizedPlayers.map(p => p.id),
      topOvr: finalizedPlayers.reduce((m, p) => Math.max(m, p.overall), 0),
    };

    const newPity = updatedPityCounter(state.packPityCounter || 0, finalizedPlayers);
    const topPlayer = finalizedPlayers.reduce((best, p) => p.overall > best.overall ? p : best, finalizedPlayers[0]);

    const costLabel = unlock === 'currency'
      ? `cost £${(tier.price / 1e6).toFixed(1)}M`
      : unlock === 'ad'
        ? 'opened with a rewarded ad'
        : 'unlocked via in-app purchase';
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

    // ── AI counter-signings ──
    // Each user pack triggers a small set of AI signings at strictly
    // lower OVR so the league quality keeps pace without out-pacing
    // the user. See AI_BACKFILL_* in config/packs.ts for the calibration.
    const allClubsAfterPlayer = { ...state.clubs, [club.id]: updatedClub };
    const aiBackfill = generateAiCounterSignings(
      tierKey,
      allClubsAfterPlayer,
      state.playerClubId,
      state.playerDivision,
      state.season,
    );
    let clubsWithAi = allClubsAfterPlayer;
    const playersWithAi = newPlayers;
    for (const [aiClubId, aiPlayers] of Object.entries(aiBackfill.perClub)) {
      const aiClub = clubsWithAi[aiClubId];
      if (!aiClub) continue;
      const aiNewIds: string[] = [];
      let aiAddedWages = 0;
      for (const p of aiPlayers) {
        playersWithAi[p.id] = p;
        aiNewIds.push(p.id);
        aiAddedWages += p.wage;
      }
      clubsWithAi = {
        ...clubsWithAi,
        [aiClubId]: {
          ...aiClub,
          playerIds: [...aiClub.playerIds, ...aiNewIds],
          wageBill: aiClub.wageBill + aiAddedWages,
        },
      };
    }

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

    // ── Auto-place pack players into lineup/subs ──
    // Pack players are in playerIds but club.lineup / subs still point at
    // the pre-pack 11/7. Run the same optimizer Optimize Lineup uses so
    // new pulls appear in the XI or bench immediately. Use the full
    // match-aware context so designated takers stay in place and
    // opponent-aware scoring applies if a fixture is this week.
    let clubsWithLineup = clubsWithAi;
    const playerClub = clubsWithAi[state.playerClubId];
    const packPlayerIds = finalizedPlayers.map(p => p.id);

    // Fast-path: if pack pulls clearly can't reach bench (all OVR below
    // the weakest current squad member), skip the rebuild. Saves Hungarian
    // work on depth-tier bronze pulls into a strong squad.
    const shouldRePlace = playerClub
      && candidatesCanCrackSquad(playerClub, playersWithAi, packPlayerIds);

    if (shouldRePlace && playerClub) {
      const context = buildAutoFillContext(state, state.playerClubId, {
        clubs: clubsWithAi,
        players: playersWithAi,
      });
      const optimized = autoPlaceClubLineup(
        playerClub,
        playersWithAi,
        state.week,
        state.season,
        context,
      );
      if (optimized !== playerClub) {
        clubsWithLineup = { ...clubsWithAi, [state.playerClubId]: optimized };
      }
    }

    // ── Re-optimize AI clubs that received counter-signings ──
    // Without this, AI lineups silently drift until match day (when
    // orchestration rebuilds via selectBestLineup). Optimizing now
    // keeps squad views consistent between weeks. Bounded: at most
    // AI_BACKFILL_PER_TIER[tier] clubs (0-3) per pack open.
    for (const aiClubId of Object.keys(aiBackfill.perClub)) {
      if (aiClubId === state.playerClubId) continue;
      const aiClub = clubsWithLineup[aiClubId];
      if (!aiClub) continue;
      const optimized = autoPlaceClubLineup(
        aiClub,
        playersWithAi,
        state.week,
        state.season,
      );
      if (optimized !== aiClub) {
        clubsWithLineup = { ...clubsWithLineup, [aiClubId]: optimized };
      }
    }

    // Count lineup changes for user feedback. Only compares the 11
    // starters — bench churn is expected and low-signal for the user.
    const postLineup = clubsWithLineup[state.playerClubId]?.lineup || [];
    const lineupChanges = postLineup.filter((id, i) => id !== (club.lineup || [])[i]).length;

    if (lineupChanges > 0) {
      newMessages = addMsg(newMessages, {
        week: state.week,
        season: state.season,
        type: 'transfer',
        title: 'Lineup Updated',
        body: `Auto-placed pack players: ${lineupChanges} lineup change${lineupChanges > 1 ? 's' : ''} applied.`,
      });
    }

    // Bump per-day ad-pack counter on ad-unlock opens so the daily limit
    // is enforced even after a save reload. `date` rolls over the moment
    // a new ISO-day starts; existing buckets fall away with it.
    const nextAdPackOpens = unlock === 'ad'
      ? {
          date: today,
          counts: adOpens.date === today
            ? { ...adOpens.counts, [tierKey]: adOpensToday + 1 }
            : { [tierKey]: 1 },
        }
      : adOpens;

    set({
      players: playersWithAi,
      clubs: clubsWithLineup,
      openedPacks: newOpenedPacks,
      packPityCounter: newPity,
      lastPackWeek: state.week,
      lastPackSeason: state.season,
      adPackOpens: nextAdPackOpens,
      messages: newMessages,
      seasonTotalExpenses: (state.seasonTotalExpenses || 0) + budgetDeduction,
      managerProgression: newProgression,
      careerManager: newCareerManager,
      lastMatchXPGain: xpEarned > 0 ? xpEarned : state.lastMatchXPGain,
    });

    // Classify each pulled player so the reveal modal can badge them.
    const placement: Record<string, 'starter' | 'bench' | 'squad'> = {};
    const finalClub = clubsWithLineup[state.playerClubId];
    const starterSet = new Set(finalClub?.lineup || []);
    const benchSet = new Set(finalClub?.subs || []);
    for (const p of finalizedPlayers) {
      if (starterSet.has(p.id)) placement[p.id] = 'starter';
      else if (benchSet.has(p.id)) placement[p.id] = 'bench';
      else placement[p.id] = 'squad';
    }

    return {
      success: true,
      message: `${tier.label} opened — ${tier.cards} player(s) signed.`,
      players: finalizedPlayers,
      record,
      pityTriggered,
      placement,
      lineupChanges,
    };
  },

  /** Lightweight escape hatch for the pack summary — releases a player that
   *  was just revealed with only 1 week's wage severance (vs. full-contract
   *  severance in `releasePlayer`). Only works on the most recent open's
   *  roster AND only during the same in-game season/week the pack was
   *  opened, so it can't be abused to dump veterans cheaply after the fact. */
  releasePackedPlayer: (playerId: string): ReleasePackedPlayerResult => {
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
    const amount = Math.max(0, Math.round((player.value || 0) * 0.65));

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

    set({
      players: { ...state.players, [playerId]: soldPlayer },
      clubs: { ...state.clubs, [state.playerClubId]: updatedClub },
      freeAgents: [...state.freeAgents, playerId],
      openedPacks: newOpenedPacks,
      messages: newMessages,
    });

    return {
      success: true,
      message: `${player.firstName} ${player.lastName} sold for £${amount.toLocaleString()}.`,
      amount,
    };
  },
});

export { RECENT_PULLS_LIMIT };
