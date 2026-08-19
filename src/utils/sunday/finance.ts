/**
 * Sunday League — the books.
 *
 * A club economy measured in tens of pounds. The design goal is that the
 * manager is always one bad decision away from not being able to pay the
 * referee, without ever being one bad WEEK away from the club folding: the
 * balance can go negative, and only stays negative long enough to fold if the
 * manager ignores it for `SUNDAY_BANKRUPT_GRACE_WEEKS` running.
 *
 * EVERY POUND LANDS IN A LINE, and there are exactly two ways it can:
 *
 *   1. The weekly settlement. `buildWeekLedger` is pure — it reads state and
 *      returns lines, the caller applies them — which is what makes the weekly
 *      economy testable without a store.
 *   2. A player action taken DURING the week (a fundraiser, an upgrade, a
 *      signing, an event payout). The action moves `balance` immediately and
 *      parks its line in `SundayState.pendingLedger`; `advanceSundayWeek`
 *      prepends those lines to the week it closes and clears the list.
 *
 * The invariant both halves exist to hold, checked in `validateSundayState`:
 * each completed `SundayWeekLedger` entry's `balance` equals the previous
 * entry's `balance` plus the sum of its own `lines`. A completed entry is
 * therefore immutable — before `pendingLedger` existed, `buySundayUpgrade` and
 * `runSundayFundraiser` reached backwards and appended a line to the PREVIOUS
 * week's entry without touching its `balance` field (and dropped the line
 * entirely when the ledger was empty), while five other actions moved the
 * balance with no line at all.
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
  SUNDAY_RINGER_COST, SUNDAY_UPGRADE_UPKEEP_PER_LEVEL,
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

  // The costs that used to be identical at every level. A County Premier
  // referee charges County Premier money and the away trips are further; see
  // `SundayDivisionInfo.costMult` for why promotion used to make the club
  // poorer per home match.
  if (fixture && !fixture.forfeited) {
    if (fixture.home) {
      lines.push({ kind: 'pitch', amount: -div.pitchHire, label: 'Pitch hire' });
    } else {
      const minibus = upgradeLevel(upgrades, 'minibus');
      const base = Math.round(SUNDAY_AWAY_TRAVEL * div.costMult);
      const travel = minibus > 0 ? Math.round(base / 2) : base;
      lines.push({ kind: 'travel', amount: -travel, label: minibus > 0 ? 'Diesel for the minibus' : 'Travel (three cars and a lot of moaning)' });
    }
    lines.push({ kind: 'referee', amount: -Math.round(SUNDAY_REFEREE_FEE * div.costMult), label: 'Referee' });
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

  lines.push({ kind: 'kit', amount: -Math.round(SUNDAY_UPKEEP * div.costMult), label: 'Kit wash and odds and ends' });

  // What the club owns, it pays for. Charged every week, fixture or not — the
  // meter runs on a free Sunday too — and the only way to stop paying it is to
  // sell the thing back (`mothballSundayUpgrade`).
  const ownedLevels = upgrades.reduce((n, u) => n + Math.max(0, u.level), 0);
  if (ownedLevels > 0) {
    const upkeep = ownedLevels * SUNDAY_UPGRADE_UPKEEP_PER_LEVEL;
    lines.push({
      kind: 'upkeep',
      amount: -upkeep,
      label: `Upkeep (${ownedLevels} thing${ownedLevels === 1 ? '' : 's'} to look after)`,
    });
  }

  const net = lines.reduce((n, l) => n + l.amount, 0);
  return { lines, net, subsCollected, subsOwed };
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
  const travel = SUNDAY_AWAY_TRAVEL * div.costMult;
  const avgTravel = minibus > 0 ? travel / 2 : travel;
  const ownedLevels = upgrades.reduce((n, u) => n + Math.max(0, u.level), 0);
  // Half the weeks are home (pitch hire) and half away (travel). Upkeep is
  // every week, which is exactly why it belongs in the figure the manager is
  // supposed to have in his head before he buys the floodlights.
  return Math.round(
    (SUNDAY_UPKEEP + SUNDAY_REFEREE_FEE) * div.costMult + (div.pitchHire + avgTravel) / 2
    + ownedLevels * SUNDAY_UPGRADE_UPKEEP_PER_LEVEL,
  );
}
