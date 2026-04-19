import type { OpenedPackRecord, OpenPackResult, PackTierKey, Player, ReleasePackedPlayerResult } from '@/types/game';
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
import { autoFillBestTeam } from '@/utils/autoFillLineup';

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

export const createPacksSlice = (set: Set, get: Get) => ({
  openedPacks: [] as OpenedPackRecord[],
  packPityCounter: 0,
  lastPackWeek: 0,
  lastPackSeason: 0,

  openPack: (tierKey: PackTierKey): OpenPackResult => {
    const state = get();
    const tier = PACK_TIER_MAP[tierKey];
    if (!tier) return { success: false, message: 'Unknown pack tier.' };

    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No active club.' };

    const blocked = challengeBlockReason(state);
    if (blocked) return { success: false, message: blocked };

    if (club.budget < tier.price) {
      return { success: false, message: 'Insufficient funds for this pack.' };
    }

    const slotsAvailable = MAX_SQUAD_SIZE - club.playerIds.length;
    if (slotsAvailable < tier.cards) {
      return {
        success: false,
        message: `Not enough squad space — this pack delivers ${tier.cards} player(s). Release players first.`,
      };
    }

    // Once-per-week throttle, keyed solely by the cooldown fields
    // (season, week). Advancing a week re-enables opening. The `> 0` guards
    // skip the first-ever open (both fields start at 0). We deliberately
    // don't consult `openedPacks` so the cooldown survives log pruning or
    // any future migration that clears history.
    if (
      (state.lastPackSeason || 0) > 0
      && (state.lastPackWeek || 0) > 0
      && state.lastPackSeason === state.season
      && state.lastPackWeek === state.week
    ) {
      return { success: false, message: 'Only one pack per week — advance a week to open another.' };
    }

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

    const updatedClub = {
      ...club,
      budget: Math.max(0, club.budget - tier.price),
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

    let newMessages = addMsg(state.messages, {
      week: state.week,
      season: state.season,
      type: 'transfer',
      title: `${tier.label} Opened`,
      body: `${tier.label} cost £${(tier.price / 1e6).toFixed(1)}M. Top pull: ${topPlayer.firstName} ${topPlayer.lastName} (${topPlayer.overall} OVR, ${topPlayer.position}). ${tier.cards} player(s) added to your squad.`,
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
    // Pack players are already in playerIds above, but club.lineup / subs
    // still point at the pre-pack 11/7. Run the same optimizer the
    // Optimize Lineup button uses so new pulls appear in the XI or on
    // the bench immediately — what users expect after a pack reveal.
    // Pass undefined for match context: packs open any time in the week,
    // often outside match days; neutral scoring is the right default.
    let clubsWithLineup = clubsWithAi;
    const playerClub = clubsWithAi[state.playerClubId];
    if (playerClub && playerClub.formation) {
      const squad = playerClub.playerIds
        .map(id => playersWithAi[id])
        .filter(Boolean);
      if (squad.length > 0) {
        const result = autoFillBestTeam(
          squad,
          playerClub.formation,
          state.week,
          state.season,
          undefined,
        );
        if (result.lineup.length > 0) {
          clubsWithLineup = {
            ...clubsWithAi,
            [state.playerClubId]: {
              ...playerClub,
              lineup: result.lineup.map(p => p.id),
              subs: result.subs.map(p => p.id),
            },
          };
        }
      }
    }

    set({
      players: playersWithAi,
      clubs: clubsWithLineup,
      openedPacks: newOpenedPacks,
      packPityCounter: newPity,
      lastPackWeek: state.week,
      lastPackSeason: state.season,
      messages: newMessages,
      seasonTotalExpenses: (state.seasonTotalExpenses || 0) + tier.price,
      managerProgression: newProgression,
      careerManager: newCareerManager,
      lastMatchXPGain: xpEarned > 0 ? xpEarned : state.lastMatchXPGain,
    });

    return {
      success: true,
      message: `${tier.label} opened — ${tier.cards} player(s) signed.`,
      players: finalizedPlayers,
      record,
      pityTriggered,
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

    const updatedClub = {
      ...club,
      budget: club.budget - severance,
      playerIds: club.playerIds.filter(id => id !== playerId),
      lineup: club.lineup.filter(id => id !== playerId),
      subs: club.subs.filter(id => id !== playerId),
      wageBill: Math.max(0, club.wageBill - player.wage),
    };

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
});

export { RECENT_PULLS_LIMIT };
