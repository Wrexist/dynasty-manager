/**
 * Advanced AI Simulation
 *
 * Handles weekly AI club management: income, transfers, loans,
 * contract renewals, free agent signings, and squad management.
 * Called from orchestrationSlice's advanceWeek() as a single function.
 */

import type { Club, Player, Message, TransferListing, LoanDeal, Position, LeagueId, LeagueTableEntry, Mentality, FormationType } from '@/types/game';
import type { TransferNewsEntry } from '@/types/game';
import { pick, shuffle, addMsg } from '@/utils/helpers';
import { formatMoney } from '@/utils/helpers';
import {
  MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, COMMERCIAL_INCOME_BASE,
  STADIUM_INCOME_PER_LEVEL, POSITION_PRIZE_PER_RANK, POSITION_PRIZE_MAX_RANK,
  MIN_SQUAD_SIZE,
} from '@/config/gameBalance';
import {
  AI_INCOME_MULTIPLIER, AI_STAFF_COST_PER_REP,
  AI_MAX_WAGE_TO_INCOME_RATIO, AI_EMERGENCY_SELL_WAGE_RATIO,
  AI_SQUAD_DEPTH_TARGETS, AI_POSITION_PRIORITY,
  AI_TRANSFER_WEEKLY_CHANCE, AI_TRANSFER_DEADLINE_WEEKS, AI_TRANSFER_DEADLINE_MULTIPLIER,
  AI_TRANSFER_MAX_PER_WEEK, AI_LOAN_MAX_PER_WEEK,
  AI_SELL_AGE_THRESHOLD, AI_SELL_DECLINE_OVERALL_DROP, AI_SELL_SURPLUS_THRESHOLD,
  AI_SELL_LISTING_CHANCE, AI_SELL_LISTING_PRICE_MIN, AI_SELL_LISTING_PRICE_RANGE,
  AI_BUY_MAX_BUDGET_RATIO, AI_BUY_FEE_BASE, AI_BUY_FEE_RANGE,
  AI_BUY_BIDDING_WAR_CHANCE, AI_BUY_BIDDING_INCREMENT,
  AI_RENEW_CHECK_WEEKS_BEFORE, AI_RENEW_CHANCE_PER_WEEK,
  AI_RENEW_KEY_PLAYER_OVERALL, AI_RENEW_YOUNG_AGE, AI_RENEW_OLD_AGE,
  AI_RENEW_EXCEPTIONAL_OVERALL, AI_RENEW_YEARS_YOUNG, AI_RENEW_YEARS_PEAK, AI_RENEW_YEARS_OLD,
  AI_FREE_AGENT_CHANCE, AI_FREE_AGENT_MAX_WAGE_RATIO, AI_FREE_AGENT_MIN_OVERALL_GAP,
  AI_LOAN_WEEKLY_CHANCE, AI_LOAN_TARGET_AGE_MAX, AI_LOAN_TARGET_OVERALL_GAP,
  AI_LOAN_DURATIONS, AI_LOAN_WAGE_SPLITS, AI_LOAN_RECALL_CHANCE,
  AI_LOAN_OBLIGATORY_BUY_CHANCE, AI_LOAN_OBLIGATORY_BUY_MULTIPLIER,
  AI_TRANSFER_NEWS_MIN_FEE, AI_LOAN_NEWS_MIN_OVERALL,
  AI_STYLE_PRIORITY_POSITIONS,
} from '@/config/aiSimulation';
import { TOTAL_WEEKS } from '@/config/gameBalance';

// ── Types ──

interface SquadNeed {
  position: Position;
  urgency: 'critical' | 'moderate' | 'low';
  currentCount: number;
  targetCount: number;
}

interface AIWeeklyResult {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  messages: Message[];
  transferMarket: TransferListing[];
  freeAgents: string[];
  activeLoans: LoanDeal[];
  transferNews: TransferNewsEntry[];
}

// ── Helpers ──

function getSquadAvgOverall(club: Club, players: Record<string, Player>): number {
  const squad = club.playerIds.map(id => players[id]).filter(Boolean);
  if (squad.length === 0) return 50;
  return Math.round(squad.reduce((sum, p) => sum + p.overall, 0) / squad.length);
}

function getPositionCount(club: Club, players: Record<string, Player>): Record<Position, number> {
  const counts = {} as Record<Position, number>;
  for (const pos of AI_POSITION_PRIORITY) counts[pos] = 0;
  club.playerIds.forEach(id => {
    const p = players[id];
    if (p && !p.onLoan) counts[p.position] = (counts[p.position] || 0) + 1;
  });
  return counts;
}

function estimateWeeklyIncome(club: Club, divisionTable: LeagueTableEntry[]): number {
  const matchday = Math.round(club.fanBase * MATCHDAY_INCOME_PER_FAN * AI_INCOME_MULTIPLIER);
  const commercial = Math.round((COMMERCIAL_INCOME_BASE + club.reputation * COMMERCIAL_INCOME_PER_REP) * AI_INCOME_MULTIPLIER);
  const stadium = Math.round(club.facilities * STADIUM_INCOME_PER_LEVEL * AI_INCOME_MULTIPLIER);
  const tableIdx = divisionTable.findIndex(e => e.clubId === club.id);
  const tablePos = tableIdx >= 0 ? tableIdx + 1 : divisionTable.length;
  const prize = Math.max(0, POSITION_PRIZE_MAX_RANK - tablePos) * POSITION_PRIZE_PER_RANK;
  return matchday + commercial + stadium + prize;
}

function isDeadlineWeek(week: number): boolean {
  return (AI_TRANSFER_DEADLINE_WEEKS as readonly number[]).includes(week);
}

// ── Squad Analysis ──

function evaluateSquadNeeds(club: Club, players: Record<string, Player>): SquadNeed[] {
  const posCounts = getPositionCount(club, players);
  const needs: SquadNeed[] = [];

  for (const pos of AI_POSITION_PRIORITY) {
    const target = AI_SQUAD_DEPTH_TARGETS[pos];
    const current = posCounts[pos] || 0;
    if (current < target) {
      const deficit = target - current;
      const urgency: SquadNeed['urgency'] = current === 0 ? 'critical' : deficit >= 2 ? 'critical' : 'moderate';
      needs.push({ position: pos, urgency, currentCount: current, targetCount: target });
    }
  }

  // Sort: critical first, then by position priority
  needs.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'critical' ? -1 : 1;
    return AI_POSITION_PRIORITY.indexOf(a.position) - AI_POSITION_PRIORITY.indexOf(b.position);
  });

  return needs;
}

function identifySellCandidates(
  club: Club,
  players: Record<string, Player>,
  youthFocus: number,
): string[] {
  const posCounts = getPositionCount(club, players);
  const avgOverall = getSquadAvgOverall(club, players);
  const candidates: string[] = [];

  for (const pid of club.playerIds) {
    const p = players[pid];
    if (!p || p.onLoan) continue;
    // Don't sell if it would break minimum squad
    if (club.playerIds.length <= MIN_SQUAD_SIZE) break;

    // Player wants to leave
    if (p.wantsToLeave) { candidates.push(pid); continue; }
    // Surplus position (3+ at same position)
    if ((posCounts[p.position] || 0) >= AI_SELL_SURPLUS_THRESHOLD) {
      // Sell the worst one
      const posPlayers = club.playerIds.map(id => players[id]).filter(Boolean).filter(pp => pp.position === p.position);
      const worst = posPlayers.sort((a, b) => a.overall - b.overall)[0];
      if (worst && worst.id === pid) { candidates.push(pid); continue; }
    }
    // Aging + declining
    if (p.age >= AI_SELL_AGE_THRESHOLD && p.overall < avgOverall - AI_SELL_DECLINE_OVERALL_DROP) {
      candidates.push(pid); continue;
    }
    // Youth-focused managers sell old players more aggressively
    if (youthFocus > 0.6 && p.age >= 30 && p.overall < avgOverall) {
      candidates.push(pid); continue;
    }
  }

  return candidates;
}

function identifyLoanCandidates(
  club: Club,
  players: Record<string, Player>,
): string[] {
  const avgOverall = getSquadAvgOverall(club, players);
  const candidates: string[] = [];

  for (const pid of club.playerIds) {
    const p = players[pid];
    if (!p || p.onLoan || p.injured) continue;
    if (club.playerIds.length <= MIN_SQUAD_SIZE) break;

    // Young player significantly below squad average, not in lineup
    if (p.age <= AI_LOAN_TARGET_AGE_MAX &&
        p.overall <= avgOverall - AI_LOAN_TARGET_OVERALL_GAP &&
        !club.lineup.includes(pid)) {
      candidates.push(pid);
    }
  }

  return candidates;
}

// ── Core Processing Functions ──

function processAIIncome(
  clubs: Record<string, Club>,
  playerClubId: string,
  divisionTables: Record<LeagueId, LeagueTableEntry[]>,
): Record<string, Club> {
  const updated = { ...clubs };

  for (const clubId of Object.keys(updated)) {
    if (clubId === playerClubId) continue;
    const club = updated[clubId];
    const table = divisionTables[club.divisionId] || [];
    const income = estimateWeeklyIncome(club, table);
    const expenses = club.wageBill + (club.reputation * AI_STAFF_COST_PER_REP);
    // Clamp budget: never let AI clubs go below -5M (prevents budget death spiral)
    const newBudget = Math.max(-5_000_000, club.budget + income - expenses);
    updated[clubId] = { ...club, budget: newBudget };
  }

  return updated;
}

function processAIContractRenewals(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  season: number,
  playerClubId: string,
): { clubs: Record<string, Club>; players: Record<string, Player> } {
  const updClubs = { ...clubs };
  const updPlayers = { ...players };

  for (const clubId of Object.keys(updClubs)) {
    if (clubId === playerClubId) continue;
    const club = updClubs[clubId];
    const profile = club.aiManagerProfile;
    const youthFocus = profile?.youthFocus ?? 0.5;

    for (const pid of club.playerIds) {
      const p = updPlayers[pid];
      if (!p || p.onLoan) continue;

      const weeksUntilExpiry = (p.contractEnd - season) * TOTAL_WEEKS;
      if (weeksUntilExpiry > AI_RENEW_CHECK_WEEKS_BEFORE || weeksUntilExpiry < 0) continue;
      if (Math.random() > AI_RENEW_CHANCE_PER_WEEK) continue;

      // Decide whether to renew
      let shouldRenew = false;
      let years = AI_RENEW_YEARS_PEAK;

      // Never renew players 36+ — they should retire naturally
      if (p.age >= 36) continue;

      if (p.overall >= AI_RENEW_KEY_PLAYER_OVERALL) {
        shouldRenew = true;
      } else if (p.age < AI_RENEW_YOUNG_AGE && youthFocus > 0.3) {
        shouldRenew = true;
        years = AI_RENEW_YEARS_YOUNG;
      } else if (p.age >= AI_RENEW_OLD_AGE) {
        // Only renew old players if exceptional
        shouldRenew = p.overall >= AI_RENEW_EXCEPTIONAL_OVERALL;
        years = AI_RENEW_YEARS_OLD;
      } else {
        // Mid-career: renew if above average for the squad
        const avg = getSquadAvgOverall(club, updPlayers);
        shouldRenew = p.overall >= avg - 3;
      }

      if (p.age >= 30 && p.age < AI_RENEW_OLD_AGE) years = AI_RENEW_YEARS_OLD;

      if (shouldRenew) {
        // Adjust wage slightly based on performance (±10%)
        const wageDelta = 1 + (Math.random() * 0.2 - 0.1);
        const newWage = Math.round(p.wage * wageDelta);
        updPlayers[pid] = { ...p, contractEnd: season + years, wage: newWage };
        // Update club wage bill
        const wageChange = newWage - p.wage;
        updClubs[clubId] = { ...updClubs[clubId], wageBill: updClubs[clubId].wageBill + wageChange };
      }
    }
  }

  return { clubs: updClubs, players: updPlayers };
}

function processAIListings(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  transferMarket: TransferListing[],
  playerClubId: string,
  week: number,
  season: number,
): { clubs: Record<string, Club>; players: Record<string, Player>; transferMarket: TransferListing[] } {
  const updPlayers = { ...players };
  const updMarket = [...transferMarket];

  for (const clubId of Object.keys(clubs)) {
    if (clubId === playerClubId) continue;
    const club = clubs[clubId];
    const profile = club.aiManagerProfile;
    const youthFocus = profile?.youthFocus ?? 0.5;

    // Check for emergency sell if wage bill too high
    const divIncome = estimateWeeklyIncome(club, []);
    const isWageCrisis = divIncome > 0 && club.wageBill / divIncome > AI_EMERGENCY_SELL_WAGE_RATIO;

    const candidates = identifySellCandidates(club, updPlayers, youthFocus);

    for (const pid of candidates) {
      const p = updPlayers[pid];
      if (!p) continue;
      // Already listed?
      if (updMarket.some(l => l.playerId === pid)) continue;

      const chance = isWageCrisis ? AI_SELL_LISTING_CHANCE * 3 : AI_SELL_LISTING_CHANCE;
      if (Math.random() > chance && !isDeadlineWeek(week)) continue;

      const askingPrice = Math.round(p.value * (AI_SELL_LISTING_PRICE_MIN + Math.random() * AI_SELL_LISTING_PRICE_RANGE));
      updMarket.push({ playerId: pid, askingPrice, sellerClubId: clubId, listedWeek: week, listedSeason: season, divisionId: clubs[clubId]?.divisionId });
      updPlayers[pid] = { ...p, listedForSale: true };
    }
  }

  return { clubs, players: updPlayers, transferMarket: updMarket };
}

function processAIBuying(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  transferMarket: TransferListing[],
  playerClubId: string,
  week: number,
  season: number,
  messages: Message[],
  transferNews: TransferNewsEntry[],
): {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  transferMarket: TransferListing[];
  messages: Message[];
  transferNews: TransferNewsEntry[];
} {
  const updClubs = { ...clubs };
  const updPlayers = { ...players };
  let updMarket = [...transferMarket];
  let updMessages = messages;
  const updNews = [...transferNews];
  let transfersDone = 0;

  const aiClubIds = shuffle(Object.keys(updClubs).filter(id => id !== playerClubId));

  for (const buyerClubId of aiClubIds) {
    if (transfersDone >= AI_TRANSFER_MAX_PER_WEEK) break;

    const buyer = updClubs[buyerClubId];
    const profile = buyer.aiManagerProfile;
    const aggression = profile?.transferAggression ?? 0.5;
    const youthFocus = profile?.youthFocus ?? 0.5;
    const style = profile?.style ?? 'balanced';

    // Check transfer activity chance (influenced by aggression + deadline rush)
    let chance = AI_TRANSFER_WEEKLY_CHANCE * (0.5 + aggression);
    if (isDeadlineWeek(week)) chance *= AI_TRANSFER_DEADLINE_MULTIPLIER;
    if (Math.random() > chance) continue;

    // Check budget constraints
    if (buyer.budget <= 0) continue;
    const weeklyIncome = estimateWeeklyIncome(buyer, []);
    if (weeklyIncome > 0 && buyer.wageBill / weeklyIncome > AI_MAX_WAGE_TO_INCOME_RATIO) continue;

    // Find needs
    const needs = evaluateSquadNeeds(buyer, updPlayers);
    if (needs.length === 0) continue;

    // Style-prioritised needs: boost positions the manager's style favours
    const stylePriority = AI_STYLE_PRIORITY_POSITIONS[style] || AI_POSITION_PRIORITY;
    const topNeed = needs.sort((a, b) => {
      // Critical always first
      if (a.urgency !== b.urgency) return a.urgency === 'critical' ? -1 : 1;
      // Then by style preference
      const aIdx = stylePriority.indexOf(a.position);
      const bIdx = stylePriority.indexOf(b.position);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    })[0];

    // Search transfer market first (includes both club-listed and external/generated players)
    const availableListings = updMarket.filter(l => {
      if (l.sellerClubId === buyerClubId) return false;
      const p = updPlayers[l.playerId];
      if (!p) return false;
      if (p.position !== topNeed.position) return false;
      if (p.clubId === playerClubId && !l.externalPlayer) return false; // Don't buy from player without negotiation
      // Youth focus filter
      if (youthFocus > 0.6 && p.age > 26) return false;
      if (youthFocus < 0.3 && p.overall < 65) return false;
      return true;
    });

    // Also search non-listed surplus from other AI clubs
    let target: Player | null = null;
    let askingPrice = 0;
    let sellerClubId = '';

    if (availableListings.length > 0) {
      // Pick best match from market
      const sorted = [...availableListings].sort((a, b) => {
        const pa = updPlayers[a.playerId];
        const pb = updPlayers[b.playerId];
        if (!pa || !pb) return 0;
        if (youthFocus > 0.6) return (pb.potential - pa.potential) || (pa.age - pb.age);
        return pb.overall - pa.overall;
      });
      const listing = sorted[0];
      target = updPlayers[listing.playerId];
      askingPrice = listing.askingPrice;
      sellerClubId = listing.sellerClubId;
    } else {
      // Try to find surplus player from another AI club
      for (const otherId of aiClubIds) {
        if (otherId === buyerClubId) continue;
        const other = updClubs[otherId];
        const otherSquad = other.playerIds.map(id => updPlayers[id]).filter(Boolean);
        const surplus = otherSquad.filter(p =>
          p.position === topNeed.position &&
          !other.lineup.includes(p.id) &&
          !p.onLoan &&
          !p.injured
        );
        if (surplus.length === 0) continue;

        const sorted = [...surplus].sort((a, b) => {
          if (youthFocus > 0.6) return (b.potential - a.potential) || (a.age - b.age);
          return b.overall - a.overall;
        });
        const candidate = sorted[0];
        if (youthFocus > 0.6 && candidate.age > 26) continue;
        if (youthFocus < 0.3 && candidate.overall < 65) continue;

        target = candidate;
        askingPrice = Math.round(candidate.value * (AI_SELL_LISTING_PRICE_MIN + Math.random() * AI_SELL_LISTING_PRICE_RANGE));
        sellerClubId = otherId;
        break;
      }
    }

    if (!target || !sellerClubId) continue;

    // Calculate fee
    const fee = Math.round(askingPrice * (AI_BUY_FEE_BASE + Math.random() * AI_BUY_FEE_RANGE));
    if (fee > buyer.budget * AI_BUY_MAX_BUDGET_RATIO) continue;
    if (fee <= 0) continue;

    // Bidding war: another club might counter-bid
    let finalFee = fee;
    let finalBuyerClubId = buyerClubId;
    if (Math.random() < AI_BUY_BIDDING_WAR_CHANCE) {
      const rivals = aiClubIds.filter(id => id !== buyerClubId && id !== sellerClubId);
      if (rivals.length > 0) {
        const rivalId = pick(rivals);
        const rival = updClubs[rivalId];
        const rivalNeeds = evaluateSquadNeeds(rival, updPlayers);
        const rivalNeedsPosition = rivalNeeds.some(n => n.position === target!.position);
        if (rivalNeedsPosition && rival.budget * AI_BUY_MAX_BUDGET_RATIO > fee * (1 + AI_BUY_BIDDING_INCREMENT)) {
          // Rival wins the bidding war
          finalFee = Math.round(fee * (1 + AI_BUY_BIDDING_INCREMENT));
          finalBuyerClubId = rivalId;
        }
      }
    }

    const finalBuyer = updClubs[finalBuyerClubId];
    if (finalFee > finalBuyer.budget * AI_BUY_MAX_BUDGET_RATIO) continue;

    // Seller minimum squad check (skip for external players with no club)
    const seller = updClubs[sellerClubId];
    const isExternalPlayer = !seller || !seller.playerIds?.includes(target.id);
    if (!isExternalPlayer && seller.playerIds.length <= MIN_SQUAD_SIZE) continue;

    // Execute transfer
    if (!isExternalPlayer) {
      const updSeller = { ...seller };
      updSeller.playerIds = updSeller.playerIds.filter(id => id !== target!.id);
      updSeller.lineup = updSeller.lineup.filter(id => id !== target!.id);
      updSeller.subs = updSeller.subs.filter(id => id !== target!.id);
      updSeller.budget += finalFee;
      updSeller.wageBill -= target.wage;
      updClubs[sellerClubId] = updSeller;
    }

    const updBuyer = { ...finalBuyer };
    updBuyer.playerIds = [...updBuyer.playerIds, target.id];
    updBuyer.budget -= finalFee;
    updBuyer.wageBill += target.wage;

    updPlayers[target.id] = { ...target, clubId: finalBuyerClubId, listedForSale: false };
    updClubs[finalBuyerClubId] = updBuyer;

    // Remove from market
    updMarket = updMarket.filter(l => l.playerId !== target!.id);

    // Generate transfer news
    const newsEntry: TransferNewsEntry = {
      id: crypto.randomUUID(),
      week,
      season,
      type: 'transfer',
      playerName: `${target.firstName} ${target.lastName}`,
      playerPosition: target.position,
      playerOverall: target.overall,
      playerAge: target.age,
      fromClubId: sellerClubId,
      toClubId: finalBuyerClubId,
      fee: finalFee,
    };
    updNews.push(newsEntry);

    // Generate inbox message for significant transfers
    if (finalFee >= AI_TRANSFER_NEWS_MIN_FEE) {
      const fromName = isExternalPlayer ? 'the transfer market' : (updClubs[sellerClubId]?.shortName || 'Unknown');
      updMessages = addMsg(updMessages, {
        week, season, type: 'transfer',
        title: `${target.lastName} → ${updBuyer.shortName}`,
        body: `${target.firstName} ${target.lastName} (${target.position}, ${target.overall} OVR) has moved from ${fromName} to ${updBuyer.shortName} for ${formatMoney(finalFee)}.`,
      });
    }

    transfersDone++;
  }

  return { clubs: updClubs, players: updPlayers, transferMarket: updMarket, messages: updMessages, transferNews: updNews };
}

function processAILoans(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  activeLoans: LoanDeal[],
  playerClubId: string,
  week: number,
  season: number,
  messages: Message[],
  transferNews: TransferNewsEntry[],
): {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  activeLoans: LoanDeal[];
  messages: Message[];
  transferNews: TransferNewsEntry[];
} {
  const updClubs = { ...clubs };
  const updPlayers = { ...players };
  const updLoans = [...activeLoans];
  let updMessages = messages;
  const updNews = [...transferNews];
  let loansDone = 0;

  const aiClubIds = shuffle(Object.keys(updClubs).filter(id => id !== playerClubId));

  for (const lendingClubId of aiClubIds) {
    if (loansDone >= AI_LOAN_MAX_PER_WEEK) break;

    const lender = updClubs[lendingClubId];
    if (Math.random() > AI_LOAN_WEEKLY_CHANCE) continue;

    const candidates = identifyLoanCandidates(lender, updPlayers);
    if (candidates.length === 0) continue;

    const candidateId = pick(candidates);
    const candidate = updPlayers[candidateId];
    if (!candidate) continue;

    // Find a borrowing club that needs this position
    const borrowerClubId = aiClubIds.find(id => {
      if (id === lendingClubId) return false;
      const borrower = updClubs[id];
      const needs = evaluateSquadNeeds(borrower, updPlayers);
      return needs.some(n => n.position === candidate.position);
    });

    if (!borrowerClubId) continue;

    // Check squad size minimums
    if (lender.playerIds.length <= MIN_SQUAD_SIZE) continue;

    const duration = pick([...AI_LOAN_DURATIONS]);
    const wageSplit = pick([...AI_LOAN_WAGE_SPLITS]);
    const recallClause = Math.random() < AI_LOAN_RECALL_CHANCE;
    const obligatoryBuyFee = Math.random() < AI_LOAN_OBLIGATORY_BUY_CHANCE
      ? Math.round(candidate.value * AI_LOAN_OBLIGATORY_BUY_MULTIPLIER)
      : undefined;

    const loan: LoanDeal = {
      id: crypto.randomUUID(),
      playerId: candidateId,
      fromClubId: lendingClubId,
      toClubId: borrowerClubId,
      startWeek: week,
      startSeason: season,
      durationWeeks: duration,
      wageSplit,
      recallClause,
      obligatoryBuyFee,
    };

    // Update player
    updPlayers[candidateId] = {
      ...candidate,
      onLoan: true,
      loanFromClubId: lendingClubId,
      loanToClubId: borrowerClubId,
      clubId: borrowerClubId,
    };

    // Update clubs
    const updLender = { ...updClubs[lendingClubId] };
    updLender.playerIds = updLender.playerIds.filter(id => id !== candidateId);
    updLender.lineup = updLender.lineup.filter(id => id !== candidateId);
    updLender.subs = updLender.subs.filter(id => id !== candidateId);
    updLender.wageBill -= Math.round(candidate.wage * wageSplit / 100);

    const updBorrower = { ...updClubs[borrowerClubId] };
    updBorrower.playerIds = [...updBorrower.playerIds, candidateId];
    updBorrower.wageBill += Math.round(candidate.wage * wageSplit / 100);

    updClubs[lendingClubId] = updLender;
    updClubs[borrowerClubId] = updBorrower;
    updLoans.push(loan);

    // Generate loan news for notable players
    if (candidate.overall >= AI_LOAN_NEWS_MIN_OVERALL) {
      const newsEntry: TransferNewsEntry = {
        id: crypto.randomUUID(),
        week,
        season,
        type: 'loan',
        playerName: `${candidate.firstName} ${candidate.lastName}`,
        playerPosition: candidate.position,
        playerOverall: candidate.overall,
        playerAge: candidate.age,
        fromClubId: lendingClubId,
        toClubId: borrowerClubId,
        loanDuration: duration,
      };
      updNews.push(newsEntry);

      updMessages = addMsg(updMessages, {
        week, season, type: 'transfer',
        title: `${candidate.lastName} → ${updBorrower.shortName} (Loan)`,
        body: `${candidate.firstName} ${candidate.lastName} (${candidate.position}, ${candidate.overall} OVR) has joined ${updBorrower.shortName} on loan from ${updLender.shortName} for ${duration} weeks.`,
      });
    }

    loansDone++;
  }

  return { clubs: updClubs, players: updPlayers, activeLoans: updLoans, messages: updMessages, transferNews: updNews };
}

function processAIFreeAgents(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  freeAgents: string[],
  playerClubId: string,
  season: number,
  transferNews: TransferNewsEntry[],
  week: number,
): {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  freeAgents: string[];
  transferNews: TransferNewsEntry[];
} {
  const updClubs = { ...clubs };
  const updPlayers = { ...players };
  let updFreeAgents = [...freeAgents];
  const updNews = [...transferNews];

  const aiClubIds = Object.keys(updClubs).filter(id => id !== playerClubId);

  for (const aiClubId of aiClubIds) {
    if (updFreeAgents.length === 0) break;
    if (Math.random() > AI_FREE_AGENT_CHANCE) continue;

    const club = updClubs[aiClubId];
    const avgOverall = getSquadAvgOverall(club, updPlayers);

    // Check budget
    if (club.budget <= 0) continue;

    const needs = evaluateSquadNeeds(club, updPlayers);
    if (needs.length === 0) continue;

    const topNeed = needs[0];

    // Find matching free agent
    const faPlayers = updFreeAgents
      .map(id => updPlayers[id])
      .filter(Boolean)
      .filter(p =>
        p.position === topNeed.position &&
        p.overall >= avgOverall - AI_FREE_AGENT_MIN_OVERALL_GAP &&
        p.wage <= club.budget * AI_FREE_AGENT_MAX_WAGE_RATIO
      )
      .sort((a, b) => b.overall - a.overall);

    const candidate = faPlayers[0];
    if (!candidate) continue;

    // Sign free agent
    const contractYears = candidate.age >= 30 ? 1 : 1 + Math.floor(Math.random() * 2);
    updPlayers[candidate.id] = {
      ...candidate,
      clubId: aiClubId,
      contractEnd: season + contractYears,
      listedForSale: false,
    };

    const updClub = { ...club };
    updClub.playerIds = [...updClub.playerIds, candidate.id];
    updClub.wageBill += candidate.wage;
    updClubs[aiClubId] = updClub;

    updFreeAgents = updFreeAgents.filter(id => id !== candidate.id);

    // News for notable signings
    if (candidate.overall >= AI_LOAN_NEWS_MIN_OVERALL) {
      updNews.push({
        id: crypto.randomUUID(),
        week,
        season,
        type: 'free_agent',
        playerName: `${candidate.firstName} ${candidate.lastName}`,
        playerPosition: candidate.position,
        playerOverall: candidate.overall,
        playerAge: candidate.age,
        fromClubId: '',
        toClubId: aiClubId,
      });
    }
  }

  return { clubs: updClubs, players: updPlayers, freeAgents: updFreeAgents, transferNews: updNews };
}

// ── AI Tactical Adaptation ──

const MENTALITY_OPTIONS: Mentality[] = ['defensive', 'cautious', 'balanced', 'attacking', 'all-out-attack'];
const FORMATION_OPTIONS: FormationType[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1', '5-3-2'];

/** AI clubs adapt tactics based on recent form — losing streaks trigger formation/mentality changes */
function processAITacticalAdaptation(
  clubs: Record<string, Club>,
  divisionTables: Record<LeagueId, LeagueTableEntry[]>,
  playerClubId: string,
): Record<string, Club> {
  const updClubs = { ...clubs };

  for (const [clubId, club] of Object.entries(updClubs)) {
    if (clubId === playerClubId || !club.aiManagerProfile) continue;
    const profile = club.aiManagerProfile;
    // Only adapt if adaptability roll succeeds (checked once per week, ~30% base)
    if (Math.random() > profile.adaptability * 0.4) continue;

    // Find this club's form in their division table
    let form: string[] = [];
    for (const entries of Object.values(divisionTables)) {
      const entry = entries.find(e => e.clubId === clubId);
      if (entry) { form = entry.form; break; }
    }
    if (form.length < 3) continue;

    const last3 = form.slice(-3);
    const losses = last3.filter(r => r === 'L').length;
    const wins = last3.filter(r => r === 'W').length;

    if (losses >= 3) {
      // 3-game losing streak: switch formation entirely and adjust mentality defensively
      const currentFormation = club.formation;
      const alternatives = FORMATION_OPTIONS.filter(f => f !== currentFormation);
      const newFormation = alternatives[Math.floor(Math.random() * alternatives.length)];
      const newMentality = MENTALITY_OPTIONS[Math.max(0, MENTALITY_OPTIONS.indexOf(profile.defaultTactics.mentality as Mentality) - 1)];
      updClubs[clubId] = {
        ...club,
        formation: newFormation,
        aiManagerProfile: {
          ...profile,
          defaultTactics: { ...profile.defaultTactics, mentality: newMentality },
        },
      };
    } else if (losses >= 2) {
      // 2 losses in 3: shift mentality more defensive
      const currentIdx = MENTALITY_OPTIONS.indexOf(profile.defaultTactics.mentality as Mentality);
      if (currentIdx > 0 && Math.random() < 0.3) {
        updClubs[clubId] = {
          ...club,
          aiManagerProfile: {
            ...profile,
            defaultTactics: { ...profile.defaultTactics, mentality: MENTALITY_OPTIONS[currentIdx - 1] },
          },
        };
      }
    } else if (wins >= 3) {
      // 3-game winning streak: become bolder
      const currentIdx = MENTALITY_OPTIONS.indexOf(profile.defaultTactics.mentality as Mentality);
      if (currentIdx >= 0 && currentIdx < MENTALITY_OPTIONS.length - 1 && Math.random() < 0.2) {
        updClubs[clubId] = {
          ...club,
          aiManagerProfile: {
            ...profile,
            defaultTactics: { ...profile.defaultTactics, mentality: MENTALITY_OPTIONS[currentIdx + 1] },
          },
        };
      }
    }
  }

  return updClubs;
}

// ── Main Entry Point ──

export function processAIWeekly(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  messages: Message[],
  transferMarket: TransferListing[],
  freeAgents: string[],
  activeLoans: LoanDeal[],
  transferNews: TransferNewsEntry[],
  divisionTables: Record<LeagueId, LeagueTableEntry[]>,
  week: number,
  season: number,
  playerClubId: string,
  transferWindowOpen: boolean,
): AIWeeklyResult {

  // 1. AI Income — every week
  let updClubs = processAIIncome(clubs, playerClubId, divisionTables);

  // 2. Contract Renewals — every week
  const renewResult = processAIContractRenewals(updClubs, players, season, playerClubId);
  updClubs = renewResult.clubs;
  let updPlayers = renewResult.players;
  let updMessages = messages;
  let updMarket = transferMarket;
  let updFreeAgents = freeAgents;
  let updLoans = activeLoans;
  let updNews = [...transferNews];

  // 3. Transfer Window activities
  if (transferWindowOpen) {
    // 3a. AI clubs list players for sale
    const listingResult = processAIListings(updClubs, updPlayers, updMarket, playerClubId, week, season);
    updPlayers = listingResult.players;
    updMarket = listingResult.transferMarket;

    // 3b. AI clubs buy players
    const buyResult = processAIBuying(updClubs, updPlayers, updMarket, playerClubId, week, season, updMessages, updNews);
    updClubs = buyResult.clubs;
    updPlayers = buyResult.players;
    updMarket = buyResult.transferMarket;
    updMessages = buyResult.messages;
    updNews = buyResult.transferNews;

    // 3c. AI clubs loan players between each other
    const loanResult = processAILoans(updClubs, updPlayers, updLoans, playerClubId, week, season, updMessages, updNews);
    updClubs = loanResult.clubs;
    updPlayers = loanResult.players;
    updLoans = loanResult.activeLoans;
    updMessages = loanResult.messages;
    updNews = loanResult.transferNews;
  }

  // 4. Free Agent signings — any time
  const faResult = processAIFreeAgents(updClubs, updPlayers, updFreeAgents, playerClubId, season, updNews, week);
  updClubs = faResult.clubs;
  updPlayers = faResult.players;
  updFreeAgents = faResult.freeAgents;
  updNews = faResult.transferNews;

  // 5. AI Tactical Adaptation — AI clubs adjust tactics based on recent form
  updClubs = processAITacticalAdaptation(updClubs, divisionTables, playerClubId);

  return {
    clubs: updClubs,
    players: updPlayers,
    messages: updMessages,
    transferMarket: updMarket,
    freeAgents: updFreeAgents,
    activeLoans: updLoans,
    transferNews: updNews,
  };
}
