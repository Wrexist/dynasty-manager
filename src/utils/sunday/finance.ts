/**
 * Sunday League — the books.
 *
 * A club economy measured in tens of pounds. The design goal is that the
 * manager is always one bad decision away from not being able to pay the
 * referee, without ever being one bad WEEK away from the club folding: the
 * balance can go negative, and only stays negative long enough to fold if the
 * manager ignores it for `SUNDAY_BANKRUPT_GRACE_WEEKS` running.
 *
 * Every pound that moves goes through `buildWeekLedger` and lands in a
 * `SundayLedgerLine`, so the Finances screen can always answer "where did it
 * go" line by line. No system may adjust `balance` directly.
 */
import type {
  SundayLedgerLine, SundaySponsorDeal, SundaySquadMember, SundayUpgradeState,
  SundayDivisionId,
} from '@/types/game';
import {
  SUNDAY_AWAY_TRAVEL, SUNDAY_FORFEIT_FINE, SUNDAY_GATE_PER_REPUTATION,
  SUNDAY_INJURY_COST, SUNDAY_RED_CARD_FINE, SUNDAY_REFEREE_FEE,
  SUNDAY_SUBS_PAID_BASE, SUNDAY_SUBS_PAID_PER_COMMITMENT, SUNDAY_SUBS_PER_PLAYER,
  SUNDAY_UPKEEP, getSundayDivision, getSundayPersonality, SUNDAY_DERBY_GATE_BONUS,
  SUNDAY_RINGER_COST,
} from '@/config/sundayLeague';
import type { SundayClubPersonalityId } from '@/types/game';
import type { SundayRng } from './rng';

export interface WeekLedgerInput {
  rng: SundayRng;
  divisionId: SundayDivisionId;
  personality: SundayClubPersonalityId;
  reputation: number;
  upgrades: readonly SundayUpgradeState[];
  sponsors: readonly SundaySponsorDeal[];
  /** Squad members who took the field, for subs collection. */
  playedIds: readonly string[];
  squad: readonly SundaySquadMember[];
  /** null when there was no fixture. */
  fixture: { home: boolean; derby: boolean; forfeited: boolean } | null;
  /** Red cards picked up by the club this week. */
  redCards: number;
  /** New injuries this week. */
  injuries: number;
  /** True in the season's opening week, when the league takes its fee. */
  chargeLeagueFee: boolean;
  /** Ringers drafted in, at `SUNDAY_RINGER_COST` each. */
  ringers: number;
}

export interface WeekLedgerResult {
  lines: SundayLedgerLine[];
  /** Net change to the balance. */
  net: number;
  /** Subs actually handed over. */
  subsCollected: number;
  /** playerId → amount added to his tab this week. */
  subsOwed: Record<string, number>;
}

const upgradeLevel = (upgrades: readonly SundayUpgradeState[], id: string): number =>
  upgrades.find(u => u.id === id)?.level ?? 0;

/**
 * Build this week's ledger.
 *
 * Pure: it reads state and returns lines. The caller applies them. That is what
 * makes the weekly economy testable without a store, and it is why the balance
 * can never drift from the sum of its ledger.
 */
export function buildWeekLedger(input: WeekLedgerInput): WeekLedgerResult {
  const {
    rng, divisionId, personality, reputation, upgrades, sponsors,
    playedIds, squad, fixture, redCards, injuries, chargeLeagueFee, ringers,
  } = input;
  const div = getSundayDivision(divisionId);
  const p = getSundayPersonality(personality);
  const lines: SundayLedgerLine[] = [];
  const subsOwed: Record<string, number> = {};
  const byId = new Map(squad.map(m => [m.playerId, m]));

  // ── Income ───────────────────────────────────────────────────────────────
  let subsCollected = 0;
  if (playedIds.length) {
    for (const id of playedIds) {
      const m = byId.get(id);
      // Ringers and guests do not pay subs; they were doing you a favour.
      if (!m) continue;
      const chance = SUNDAY_SUBS_PAID_BASE + m.commitment * SUNDAY_SUBS_PAID_PER_COMMITMENT;
      if (rng.chance(chance)) subsCollected += SUNDAY_SUBS_PER_PLAYER;
      else subsOwed[id] = (subsOwed[id] ?? 0) + SUNDAY_SUBS_PER_PLAYER;
    }
    if (subsCollected > 0) {
      lines.push({ kind: 'subs', amount: Math.round(subsCollected * p.incomeMult), label: `Match fees (${Object.keys(subsOwed).length ? 'some outstanding' : 'all paid'})` });
    }
  }

  if (fixture?.home && !fixture.forfeited) {
    const gate = Math.round(
      (div.gateBase + reputation * SUNDAY_GATE_PER_REPUTATION + (fixture.derby ? SUNDAY_DERBY_GATE_BONUS : 0))
      * p.incomeMult,
    );
    if (gate > 0) lines.push({ kind: 'subs', amount: gate, label: fixture.derby ? 'Bucket collection (derby crowd)' : 'Bucket collection' });
  }

  for (const s of sponsors) {
    if (s.weekly > 0) lines.push({ kind: 'sponsor', amount: s.weekly, label: `${s.name} (weekly)` });
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  if (chargeLeagueFee) {
    lines.push({ kind: 'league-fee', amount: -div.leagueFee, label: `${div.name} registration` });
  }

  if (fixture && !fixture.forfeited) {
    if (fixture.home) {
      lines.push({ kind: 'pitch', amount: -div.pitchHire, label: 'Pitch hire' });
    } else {
      const minibus = upgradeLevel(upgrades, 'minibus');
      const travel = minibus > 0 ? Math.round(SUNDAY_AWAY_TRAVEL / 2) : SUNDAY_AWAY_TRAVEL;
      lines.push({ kind: 'travel', amount: -travel, label: minibus > 0 ? 'Diesel for the minibus' : 'Travel (three cars and a lot of moaning)' });
    }
    lines.push({ kind: 'referee', amount: -SUNDAY_REFEREE_FEE, label: 'Referee' });
  }

  if (fixture?.forfeited) {
    lines.push({ kind: 'fine', amount: -SUNDAY_FORFEIT_FINE, label: 'League fine — unfulfilled fixture' });
  }

  if (ringers > 0) {
    lines.push({ kind: 'event', amount: -ringers * SUNDAY_RINGER_COST, label: `Looking after ${ringers} guest${ringers === 1 ? '' : 's'}` });
  }

  if (redCards > 0) {
    lines.push({ kind: 'fine', amount: -redCards * SUNDAY_RED_CARD_FINE, label: `Disciplinary fine (${redCards} red card${redCards === 1 ? '' : 's'})` });
  }

  const physio = upgradeLevel(upgrades, 'physio');
  if (injuries > 0 && physio === 0) {
    lines.push({ kind: 'medical', amount: -injuries * SUNDAY_INJURY_COST, label: `Treatment (${injuries} injur${injuries === 1 ? 'y' : 'ies'})` });
  }

  lines.push({ kind: 'kit', amount: -SUNDAY_UPKEEP, label: 'Kit wash and odds and ends' });

  const net = lines.reduce((n, l) => n + l.amount, 0);
  return { lines, net, subsCollected, subsOwed };
}

/** Total of a ledger's lines. */
export function ledgerNet(lines: readonly SundayLedgerLine[]): number {
  return lines.reduce((n, l) => n + l.amount, 0);
}

/** Income and expenses split out, for the finance screen's headline figures. */
export function splitLedger(lines: readonly SundayLedgerLine[]): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;
  for (const l of lines) {
    if (l.amount >= 0) income += l.amount; else expenses += -l.amount;
  }
  return { income, expenses };
}

/**
 * Weekly running cost with no fixture and no income — the number the manager
 * needs in their head when deciding whether to buy floodlights.
 */
export function sundayWeeklyBurn(divisionId: SundayDivisionId, upgrades: readonly SundayUpgradeState[]): number {
  const div = getSundayDivision(divisionId);
  const minibus = upgradeLevel(upgrades, 'minibus');
  const avgTravel = minibus > 0 ? SUNDAY_AWAY_TRAVEL / 2 : SUNDAY_AWAY_TRAVEL;
  // Half the weeks are home (pitch hire) and half away (travel).
  return Math.round(SUNDAY_UPKEEP + SUNDAY_REFEREE_FEE + (div.pitchHire + avgTravel) / 2);
}
