import type { GameState } from '../storeTypes';
import type { SponsorDeal, SponsorOffer } from '@/types/game';
import { addMsg, formatMoney, clamp100 } from '@/utils/helpers';
import {
  SPONSOR_SLOTS,
  SPONSOR_OFFER_INTERVAL,
  SPONSOR_OFFERS_PER_CYCLE,
  SPONSOR_SLOT_COOLDOWN,
  SPONSOR_SATISFACTION_START,
  SPONSOR_SAT_WIN,
  SPONSOR_SAT_DRAW,
  SPONSOR_SAT_LOSS,
  SPONSOR_SAT_TERMINATE_THRESHOLD,
  SPONSOR_SAT_WARNING_THRESHOLD,
  SPONSOR_SAT_REP_UP,
  SPONSOR_SAT_REP_DOWN,
  SPONSOR_SAT_BONUS_MET,
  isSlotUnlocked,
  getSponsorById,
  generateOffer,
  getBonusConditionLabel,
} from '@/config/sponsorship';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createSponsorSlice = (set: Set, get: Get) => ({
  sponsorDeals: [] as SponsorDeal[],
  sponsorOffers: [] as SponsorOffer[],
  sponsorSlotCooldowns: {} as Record<string, number>,

  acceptSponsorOffer: (offerId: string) => {
    const state = get();
    const offer = state.sponsorOffers.find(o => o.id === offerId);
    if (!offer) return;

    // Validate offer hasn't expired
    if (offer.expiresWeek <= state.week) return;

    // Validate slot is empty
    const slotOccupied = state.sponsorDeals.some(d => d.slotId === offer.slotId);
    if (slotOccupied) return;

    // Validate slot is unlocked
    if (!isSlotUnlocked(offer.slotId, state.facilities)) return;

    // Validate no cooldown
    if ((state.sponsorSlotCooldowns[offer.slotId] || 0) > state.week) return;

    const deal: SponsorDeal = {
      id: crypto.randomUUID(),
      sponsorId: offer.sponsorId,
      slotId: offer.slotId,
      weeklyPayment: offer.weeklyPayment,
      seasonDuration: offer.seasonDuration,
      startSeason: state.season,
      performanceBonus: offer.performanceBonus,
      bonusCondition: offer.bonusCondition,
      bonusMet: false,
      satisfaction: SPONSOR_SATISFACTION_START,
      buyoutCost: offer.buyoutCost,
    };

    const sponsor = getSponsorById(offer.sponsorId);
    const sponsorName = sponsor?.name || 'Sponsor';

    set({
      sponsorDeals: [...state.sponsorDeals, deal],
      sponsorOffers: state.sponsorOffers.filter(o => o.id !== offerId),
      messages: addMsg(state.messages, {
        week: state.week,
        season: state.season,
        type: 'sponsorship',
        title: 'Sponsorship Deal Signed',
        body: `${sponsorName} has been signed as your ${SPONSOR_SLOTS.find(s => s.id === offer.slotId)?.label || 'sponsor'}. They will pay ${formatMoney(deal.weeklyPayment)}/week for ${deal.seasonDuration} season${deal.seasonDuration > 1 ? 's' : ''}.`,
      }),
    });
  },

  rejectSponsorOffer: (offerId: string) => {
    const state = get();
    set({ sponsorOffers: state.sponsorOffers.filter(o => o.id !== offerId) });
  },

  terminateSponsorDeal: (dealId: string) => {
    const state = get();
    const deal = state.sponsorDeals.find(d => d.id === dealId);
    if (!deal) return;

    const sponsor = getSponsorById(deal.sponsorId);
    const sponsorName = sponsor?.name || 'Sponsor';
    const club = state.clubs[state.playerClubId];
    if (!club) return;

    set({
      sponsorDeals: state.sponsorDeals.filter(d => d.id !== dealId),
      sponsorSlotCooldowns: {
        ...state.sponsorSlotCooldowns,
        [deal.slotId]: state.week + SPONSOR_SLOT_COOLDOWN,
      },
      clubs: {
        ...state.clubs,
        [state.playerClubId]: {
          ...club,
          budget: club.budget - deal.buyoutCost,
        },
      },
      messages: addMsg(state.messages, {
        week: state.week,
        season: state.season,
        type: 'sponsorship',
        title: 'Sponsorship Terminated',
        body: `You have terminated the ${sponsorName} deal. A buyout fee of ${formatMoney(deal.buyoutCost)} has been deducted. This slot has a ${SPONSOR_SLOT_COOLDOWN}-week cooldown.`,
      }),
    });
  },
});

// ── Processing functions (called from orchestrationSlice) ──

/** Process sponsor system each week: expire offers, update satisfaction, generate new offers */
export function processSponsorWeek(state: GameState): Partial<GameState> {
  const { week, season, sponsorDeals, sponsorOffers, sponsorSlotCooldowns, facilities, clubs, playerClubId } = state;
  const club = clubs[playerClubId];
  if (!club) return {};

  let updatedDeals = [...sponsorDeals];
  let updatedOffers = [...sponsorOffers];
  let msgs = [...state.messages];
  const updatedCooldowns = { ...sponsorSlotCooldowns };

  // 1. Expire old offers (notify player)
  const expiredOffers = updatedOffers.filter(o => o.expiresWeek <= week);
  for (const o of expiredOffers) {
    const sponsor = getSponsorById(o.sponsorId);
    msgs = addMsg(msgs, {
      week, season,
      type: 'sponsorship',
      title: 'Sponsor Offer Expired',
      body: `The offer from ${sponsor?.name || 'a sponsor'} for the ${SPONSOR_SLOTS.find(s => s.id === o.slotId)?.label || 'sponsor'} slot has expired.`,
    });
  }
  updatedOffers = updatedOffers.filter(o => o.expiresWeek > week);

  // 2. Update satisfaction based on last match result
  const lastMatch = state.currentMatchResult;
  if (lastMatch) {
    const isHome = lastMatch.homeClubId === playerClubId;
    const homeGoals = lastMatch.homeGoals;
    const awayGoals = lastMatch.awayGoals;
    const won = isHome ? homeGoals > awayGoals : awayGoals > homeGoals;
    const drew = homeGoals === awayGoals;

    const satDelta = won ? SPONSOR_SAT_WIN : drew ? SPONSOR_SAT_DRAW : SPONSOR_SAT_LOSS;

    updatedDeals = updatedDeals.map(d => ({
      ...d,
      satisfaction: clamp100(d.satisfaction + satDelta),
    }));
  }

  // 3. Check for terminations and warnings
  const terminatedIds: string[] = [];
  updatedDeals = updatedDeals.filter(d => {
    if (d.satisfaction < SPONSOR_SAT_TERMINATE_THRESHOLD) {
      const sponsor = getSponsorById(d.sponsorId);
      msgs = addMsg(msgs, {
        week, season,
        type: 'sponsorship',
        title: 'Sponsor Pulls Out!',
        body: `${sponsor?.name || 'A sponsor'} has terminated their deal due to poor performance. The ${SPONSOR_SLOTS.find(s => s.id === d.slotId)?.label} slot is now empty.`,
      });
      updatedCooldowns[d.slotId] = week + SPONSOR_SLOT_COOLDOWN;
      terminatedIds.push(d.id);
      return false;
    }
    if (d.satisfaction <= SPONSOR_SAT_WARNING_THRESHOLD && d.satisfaction > SPONSOR_SAT_TERMINATE_THRESHOLD) {
      // Only warn when satisfaction first drops below threshold (compare to pre-update value)
      const prevDeal = sponsorDeals.find(od => od.id === d.id);
      const prevSat = prevDeal?.satisfaction ?? 100;
      if (prevSat > SPONSOR_SAT_WARNING_THRESHOLD) {
        const sponsor = getSponsorById(d.sponsorId);
        msgs = addMsg(msgs, {
          week, season,
          type: 'general',
          title: 'Sponsor Unhappy',
          body: `${sponsor?.name || 'A sponsor'} is unhappy with recent results. Satisfaction is at ${d.satisfaction}%. Improve performance or risk losing the deal.`,
        });
      }
    }
    return true;
  });

  // 4. Generate new offers periodically for empty unlocked slots
  if (week % SPONSOR_OFFER_INTERVAL === 0) {
    const activeSponsorIds = updatedDeals.map(d => d.sponsorId);
    const offerSponsorIds = updatedOffers.map(o => o.sponsorId);
    const allUsedIds = [...activeSponsorIds, ...offerSponsorIds];

    const emptySlots = SPONSOR_SLOTS.filter(slot => {
      const occupied = updatedDeals.some(d => d.slotId === slot.id);
      const onCooldown = (updatedCooldowns[slot.id] || 0) > week;
      const unlocked = isSlotUnlocked(slot.id, facilities);
      const hasOffer = updatedOffers.some(o => o.slotId === slot.id);
      return !occupied && !onCooldown && unlocked && !hasOffer;
    });

    let offersGenerated = 0;
    for (const slot of emptySlots) {
      if (offersGenerated >= SPONSOR_OFFERS_PER_CYCLE) break;

      const offerData = generateOffer(slot.id, club.reputation, allUsedIds, week, season);
      if (offerData) {
        const offer: SponsorOffer = {
          id: crypto.randomUUID(),
          ...offerData,
        };
        updatedOffers.push(offer);
        allUsedIds.push(offer.sponsorId);
        offersGenerated++;

        const sponsor = getSponsorById(offer.sponsorId);
        msgs = addMsg(msgs, {
          week, season,
          type: 'sponsorship',
          title: 'Sponsor Offer Received',
          body: `${sponsor?.name || 'A company'} wants to become your ${SPONSOR_SLOTS.find(s => s.id === slot.id)?.label}. They offer ${formatMoney(offer.weeklyPayment)}/week for ${offer.seasonDuration} season${offer.seasonDuration > 1 ? 's' : ''}.`,
        });
      }
    }
  }

  return {
    sponsorDeals: updatedDeals,
    sponsorOffers: updatedOffers,
    sponsorSlotCooldowns: updatedCooldowns,
    messages: msgs,
  };
}

/** Evaluate bonus conditions at season end */
export function processSponsorSeasonEnd(state: GameState): Partial<GameState> {
  const { season, sponsorDeals, clubs, playerClubId, divisionTables, playerDivision, cup } = state;
  const club = clubs[playerClubId];
  if (!club) return {};

  const table = divisionTables[playerDivision] || [];
  const posIdx = table.findIndex(e => e.clubId === playerClubId);
  const position = posIdx >= 0 ? posIdx + 1 : table.length;
  const totalTeams = table.length;

  let msgs = [...state.messages];
  let budgetBonus = 0;
  const newClubs = { ...state.clubs };
  const updatedClub = { ...club };

  // Stats from the league table entry
  const entry = table.find(e => e.clubId === playerClubId);
  const wins = entry?.won || 0;
  const goalsFor = entry?.goalsFor || 0;
  const goalDiff = (entry?.goalsFor || 0) - (entry?.goalsAgainst || 0);
  const cleanSheets = entry?.cleanSheets || 0;

  // Determine relegation zone (bottom 3 for div-1, bottom 4 for others)
  const relegationZone = playerDivision === 'div-1' ? totalTeams - 3 : totalTeams - 4;
  const avoided = position <= relegationZone;
  const promoted = playerDivision !== 'div-1' && position <= 2;

  // Cup state
  const cupWon = cup.winner === playerClubId;
  const inFinal = cup.ties.some(t => t.round === 'F' && (t.homeClubId === playerClubId || t.awayClubId === playerClubId));
  const inSemi = cup.ties.some(t => t.round === 'SF' && (t.homeClubId === playerClubId || t.awayClubId === playerClubId));

  // Home unbeaten streak (approximate from fixtures)
  const homeUnbeaten = countHomeUnbeaten(state);

  const updatedDeals = sponsorDeals.map(deal => {
    const met = evaluateCondition(deal.bonusCondition, {
      position, wins, goalsFor, goalDiff, cleanSheets,
      avoided, promoted, cupWon, inFinal, inSemi, homeUnbeaten,
    });

    if (met) {
      budgetBonus += deal.performanceBonus;
      const sponsor = getSponsorById(deal.sponsorId);
      msgs = addMsg(msgs, {
        week: state.week, season,
        type: 'sponsorship',
        title: 'Sponsor Bonus Earned!',
        body: `${sponsor?.name || 'Sponsor'} has paid a bonus of ${formatMoney(deal.performanceBonus)} for achieving: ${getBonusConditionLabel(deal.bonusCondition)}.`,
      });
    }

    // Adjust satisfaction for promotion/relegation
    const repDelta = promoted ? SPONSOR_SAT_REP_UP : !avoided ? SPONSOR_SAT_REP_DOWN : 0;
    const newSat = clamp100(deal.satisfaction + (met ? SPONSOR_SAT_BONUS_MET : 0) + repDelta);

    return { ...deal, bonusMet: met, satisfaction: newSat };
  });

  // Remove expired deals
  const nextSeason = season + 1;
  const activeDeals: SponsorDeal[] = [];
  for (const deal of updatedDeals) {
    if (deal.startSeason + deal.seasonDuration <= nextSeason) {
      const sponsor = getSponsorById(deal.sponsorId);
      msgs = addMsg(msgs, {
        week: state.week, season,
        type: 'sponsorship',
        title: 'Sponsorship Expired',
        body: `Your deal with ${sponsor?.name || 'a sponsor'} has expired. The ${SPONSOR_SLOTS.find(s => s.id === deal.slotId)?.label} slot is now available.`,
      });
    } else {
      activeDeals.push({ ...deal, bonusMet: false }); // reset bonusMet for next season
    }
  }

  updatedClub.budget = club.budget + budgetBonus;
  newClubs[playerClubId] = updatedClub;

  return {
    sponsorDeals: activeDeals,
    clubs: newClubs,
    messages: msgs,
  };
}

/** Generate starter deals for a new game */
export function generateStarterDeals(reputation: number, season: number): SponsorDeal[] {
  const deals: SponsorDeal[] = [];
  const usedSponsorIds: string[] = [];

  // Kit main deal
  const kitOffer = generateOffer('kit_main', reputation, usedSponsorIds, 1, season);
  if (kitOffer) {
    usedSponsorIds.push(kitOffer.sponsorId);
    deals.push({
      id: crypto.randomUUID(),
      sponsorId: kitOffer.sponsorId,
      slotId: 'kit_main',
      weeklyPayment: kitOffer.weeklyPayment,
      seasonDuration: kitOffer.seasonDuration,
      startSeason: season,
      performanceBonus: kitOffer.performanceBonus,
      bonusCondition: kitOffer.bonusCondition,
      bonusMet: false,
      satisfaction: SPONSOR_SATISFACTION_START,
      buyoutCost: kitOffer.buyoutCost,
    });
  }

  // Digital deal
  const digitalOffer = generateOffer('digital', reputation, usedSponsorIds, 1, season);
  if (digitalOffer) {
    deals.push({
      id: crypto.randomUUID(),
      sponsorId: digitalOffer.sponsorId,
      slotId: 'digital',
      weeklyPayment: digitalOffer.weeklyPayment,
      seasonDuration: digitalOffer.seasonDuration,
      startSeason: season,
      performanceBonus: digitalOffer.performanceBonus,
      bonusCondition: digitalOffer.bonusCondition,
      bonusMet: false,
      satisfaction: SPONSOR_SATISFACTION_START,
      buyoutCost: digitalOffer.buyoutCost,
    });
  }

  return deals;
}

// ── Internal Helpers ──

function evaluateCondition(
  condition: string,
  stats: {
    position: number; wins: number; goalsFor: number; goalDiff: number;
    cleanSheets: number; avoided: boolean; promoted: boolean;
    cupWon: boolean; inFinal: boolean; inSemi: boolean; homeUnbeaten: number;
  }
): boolean {
  switch (condition) {
    case 'win_league': return stats.position === 1;
    case 'top_2': return stats.position <= 2;
    case 'top_4': return stats.position <= 4;
    case 'top_6': return stats.position <= 6;
    case 'avoid_relegation': return stats.avoided;
    case 'win_cup': return stats.cupWon;
    case 'cup_final': return stats.inFinal;
    case 'cup_semi': return stats.inSemi;
    case 'win_20_matches': return stats.wins >= 20;
    case 'score_80_goals': return stats.goalsFor >= 80;
    case 'clean_sheets_15': return stats.cleanSheets >= 15;
    case 'goal_diff_30': return stats.goalDiff >= 30;
    case 'promotion': return stats.promoted;
    case 'unbeaten_home_10': return stats.homeUnbeaten >= 10;
    default: return false;
  }
}

function countHomeUnbeaten(state: GameState): number {
  const { playerClubId, playerDivision, divisionFixtures } = state;
  const fixtures = divisionFixtures[playerDivision] || [];
  const homeMatches = fixtures
    .filter(m => m.homeClubId === playerClubId && m.played)
    .sort((a, b) => b.week - a.week);

  let streak = 0;
  for (const m of homeMatches) {
    if (m.homeGoals >= m.awayGoals) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

