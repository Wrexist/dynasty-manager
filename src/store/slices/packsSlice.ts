import type { OpenedPackRecord, OpenPackResult, PackTierKey, Player, ReleasePackedPlayerResult } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { MAX_SQUAD_SIZE, FFP_WAGE_RATIO_WARNING } from '@/config/gameBalance';
import { PACK_TIER_MAP, RECENT_PULLS_LIMIT } from '@/config/packs';
import { generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import { CHALLENGES } from '@/data/challenges';

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

    // Once-per-week throttle, keyed by (season, week) so advancing a week
    // re-enables opening. Skips the first-ever open (both fields start at 0).
    if (
      (state.lastPackSeason || 0) === state.season
      && (state.lastPackWeek || 0) === state.week
      && ((state.openedPacks || []).length > 0)
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

    set({
      players: newPlayers,
      clubs: { ...state.clubs, [club.id]: updatedClub },
      openedPacks: newOpenedPacks,
      packPityCounter: newPity,
      lastPackWeek: state.week,
      lastPackSeason: state.season,
      messages: newMessages,
      seasonTotalExpenses: (state.seasonTotalExpenses || 0) + tier.price,
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
