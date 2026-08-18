/**
 * Sunday League — the event catalogue.
 *
 * The rule this file exists to enforce: **an event may not be flavour text**.
 * Every entry has a `condition` that ties it to real state and an `effects`
 * payload that changes real state. If an event cannot say what it does to the
 * squad, the balance or the table, it does not belong here.
 *
 * Content is English game data, like the match engine's commentary — see the
 * note at the top of `src/i18n/index.ts`.
 *
 * ANTI-REPEAT. Every fired event writes a cooldown into
 * `SundayState.eventCooldowns`, and `pickSundayEvent` never offers one that is
 * still cooling down. `once: true` marks an event that may fire a single time
 * per save. Both are enforced in `src/utils/sunday/events.ts`, not here.
 */
import type {
  SundayChainId, SundayChainState, SundayEventInstance, SundayMemoryKind,
} from '@/types/game';
import {
  SUNDAY_CHAIN_DEBT_WEEKS, SUNDAY_CHAIN_PROSPECT_CEILING, SUNDAY_CHAIN_STAR_OVERALL,
  SUNDAY_CHAIN_VETERAN_AGE, SUNDAY_CHAIN_VETERAN_APPS, SUNDAY_CRISIS_SALE_FEE,
  SUNDAY_DERBY_BET, SUNDAY_MANAGER_LOAN,
  SUNDAY_SPONSOR_RENEGOTIATE_MULT, SUNDAY_SPONSOR_RENEGOTIATE_UPFRONT,
} from '@/config/sundayLeague';

/** State an event definition is allowed to read when deciding to fire. */
export interface SundayEventContext {
  season: number;
  week: number;
  balance: number;
  reputation: number;
  teamMorale: number;
  squadSize: number;
  availableCount: number;
  /** Result of the most recent match: 1 win, 0 draw, -1 loss, null none yet. */
  lastResult: 1 | 0 | -1 | null;
  /** Consecutive matches without a win. */
  winless: number;
  /** Consecutive wins. */
  winStreak: number;
  leaguePosition: number;
  leagueSize: number;
  hasRival: boolean;
  rivalHeat: number;
  hasSponsor: boolean;
  /** Total unpaid subs across the squad. */
  subsOwed: number;
  /** Consecutive weeks the books have been deep enough in the red to count
   *  toward folding. The financial crisis is triggered by this, not by a die. */
  weeksInDebt: number;
  /** Still in the cup, with a tie to come. */
  cupAlive: boolean;
  /** Cup ties won this season — one is a run, two is a story. */
  cupRoundsWon: number;
  /** English name of the next cup round the club is in ("Semi-Final"), or
   *  null. Substituted into copy as `{round}`. */
  cupRoundName: string | null;
  /** The captain's squad record, when one is appointed. */
  captain: SundayEventPerson | null;
  /** A squad member the event can be about — pre-picked by the selector so
   *  definitions never have to reach into the squad themselves. */
  subject: SundayEventPerson | null;
  /** An unhappy squad member, when there is one. */
  unhappy: SundayEventPerson | null;
  /** Short-lived story markers: name → week set. See `SundayState.flags`. */
  flags: Record<string, number>;
  /** Every live chain, so an OPENER can refuse to start a second story about
   *  the same kind of thing. Chained beats do not need to read this — the
   *  selector has already matched them against their chain. */
  chains: readonly SundayChainState[];
  /** True while a story about a PLAYER is already running. Every player-chain
   *  opener checks it: one man's situation at a time, or the mode is telling
   *  three tangled tales about the same fortnight. */
  playerStoryLive: boolean;
  /** True while a story about the CLUB is already running. */
  clubStoryLive: boolean;
  /** What earlier beats of THIS chain decided. Empty for an unchained event.
   *  A beat reads it so its text cannot contradict the choice that produced
   *  it — the whole reason a chain carries data at all. */
  chainData: Readonly<Record<string, string | number>>;
  /** Name of the player who defected to the rival, when one has. */
  defectorName: string | null;
}

/** The slice of a squad member an event definition can see. */
export interface SundayEventPerson {
  playerId: string;
  firstName: string;
  lastName: string;
  job: string;
  archetype: string;
  /** Where he plays. An event about the goalkeeper has to be about A
   *  goalkeeper — see `subjectFilter`. */
  position: string;
  age: number;
  /** Appearances for THIS club. A long server is a different story from an
   *  old signing who arrived in the summer. */
  clubApps: number;
  /** False when he is `out` for the coming Sunday. Most events are about
   *  somebody who will be there; a couple are explicitly about somebody who
   *  will not. */
  available: boolean;
  happiness: number;
  ego: number;
  commitment: number;
  temper: number;
  influence: number;
  overall: number;
  benchedStreak: number;
}

/** What resolving a choice does. All fields optional; all additive. */
export interface SundayEventEffects {
  /** Pounds. Negative spends. */
  money?: number;
  /** Squad-wide morale points. */
  morale?: number;
  /** Reputation points. */
  reputation?: number;
  /** Happiness for the event's subject. */
  subjectHappiness?: number;
  /** Happiness for everyone. */
  squadHappiness?: number;
  /** Permanent change to the subject's commitment. */
  subjectCommitment?: number;
  /** Permanent change to the subject's ego. */
  subjectEgo?: number;
  /** Rivalry heat. */
  rivalHeat?: number;
  /** Force the subject unavailable for the coming match. */
  subjectOut?: boolean;
  /** Remove the subject from the squad entirely — he has walked. */
  subjectLeaves?: boolean;
  /** Clear the squad's outstanding subs, banking a share of them. */
  collectSubs?: number;
  /** Add a recruit to the board from a specific source. */
  spawnRecruit?: 'mate' | 'work' | 'trial' | 'poached' | 'walk-up' | 'returning';
  /** Injure the subject for this many weeks. */
  subjectInjuryWeeks?: number;
  /** Attribute nudge for the subject, applied to every attribute. */
  subjectAttrDelta?: number;
  /** Wipe the coming match's home advantage — the pitch is unplayable. */
  pitchDamage?: number;
  /** Make the subject a REAL promise of a start — enforced by the match, and
   *  broken promises cost more than kept ones pay. */
  promiseStart?: boolean;
  /** The subject leaves FOR THE RIVAL: recorded on the rivalry (defector,
   *  story, heat) so the feud remembers him. The sharpest departure. */
  subjectLeavesForRival?: boolean;
  /** Set / clear a story marker. `{subject}` in the name is replaced with the
   *  event's subject id. */
  setFlag?: string;
  clearFlag?: string;
  /** Hand the armband to the subject, or take it off him. Stripping it moves
   *  the room in proportion to how much of the room he actually carried —
   *  see the influence weighting in `resolveSundayEvent`. */
  captaincy?: 'give' | 'strip';
  /** Write a moment into the subject's biography. The mode's storytelling
   *  spine: a decision that produced a memory is one the squad screen, the
   *  season retrospective and the legend citation can all still see. */
  subjectMemory?: { kind: SundayMemoryKind; text: string };
  /** Add weeks to the fold clock. Interacts with the EXISTING bankruptcy
   *  machinery — `weeksInDebt` is what `advanceSundayWeek` counts toward
   *  folding — rather than inventing a second way to die. */
  debtWeeks?: number;
  /** Take cash from the shirt sponsor now in exchange for a smaller weekly.
   *  A real change to a real deal, not a line of copy about one. */
  renegotiateSponsor?: { upfront: number; weeklyMult: number };
  /** Lose the shirt sponsor outright. */
  loseSponsor?: boolean;
  /** Pounds the manager puts in himself. The cash arrives via `money`; this
   *  records what the club owes him, which the weekly settlement pays back.
   *  Reaching into your own pocket is a LOAN, not a windfall. */
  managerLoan?: number;
  /** Stake the standing bet with the rival manager. Settled on the next
   *  decisive derby by `runSundayMatch` — the money is real either way. */
  stakeDerbyBet?: boolean;

  // ── Chains ────────────────────────────────────────────────────────────────
  /** Open a story. Only an UNCHAINED definition may do this: the chain starts
   *  waiting for step 2, and a player chain binds itself to this event's
   *  subject. `durationWeeks` overrides the chain's default deadline. */
  startChain?: { id: SundayChainId; durationWeeks?: number };
  /** Move the story to its next beat and reset the deadline. */
  advanceChain?: SundayChainId;
  /** Close the story. Every choice of a terminal beat must do this. */
  endChain?: SundayChainId;
  /** Merged into the live chain's `data`, so a later beat can be written to
   *  agree with the choice taken here. Applied alongside `startChain` or
   *  `advanceChain`; on its own it edits the live chain of the same kind. */
  chainData?: Record<string, string | number>;
}

export interface SundayEventChoiceDef {
  id: string;
  label: string;
  hint: string;
  /** Applied when this choice is taken. */
  effects: SundayEventEffects;
  /** English line describing what happened, shown after choosing. */
  outcome: string;
  /** When present, the choice succeeds with this probability and applies
   *  `effects`; otherwise `failEffects` and `failOutcome` apply. Kept explicit
   *  so no choice is ever a guaranteed right answer. */
  successChance?: (ctx: SundayEventContext) => number;
  failEffects?: SundayEventEffects;
  failOutcome?: string;
  /** Choice is hidden when this returns false (e.g. cannot afford it). */
  available?: (ctx: SundayEventContext) => boolean;
  /**
   * Marks a choice that DELIBERATELY changes no state — a decline.
   *
   * Declining is a real decision (it forgoes whatever the event offered), but
   * from the outside it is indistinguishable from a choice whose effects were
   * forgotten. The flag makes the intent explicit, and
   * `sundayEvents.test.ts` requires every effect-free choice to carry it.
   */
  declines?: boolean;
}

export interface SundayEventDef {
  id: string;
  category: SundayEventInstance['category'];
  /**
   * Which way this event pulls, for clustering protection.
   *
   * REQUIRED, so an author has to decide. The selector down-weights (never
   * zeroes) `negative` entries the week after something genuinely bad — a
   * forfeit, a walk-out, or a resolution that cost money or morale. Left alone,
   * a 0.55 weekly roll over a pool this negative produces runs of three and
   * four, which reads as the game piling on rather than as a season having a
   * bad month.
   *
   * `category` is what the modal's icon and colour come from; this is what the
   * pacing reads. They are not the same question.
   */
  tone: 'negative' | 'positive' | 'neutral';
  /** `{name}`, `{job}`, `{rival}`, `{club}` are substituted at fire time. */
  title: string;
  body: string;
  /** Relative likelihood once the condition passes. */
  weight: number;
  /** Must be true for the event to be offered. */
  condition: (ctx: SundayEventContext) => boolean;
  /** True when the event is about `ctx.subject` — the selector will not offer
   *  it unless a subject exists. */
  needsSubject?: boolean;
  /**
   * Marks this definition as one BEAT of a story.
   *
   * A chained definition is eligible only while that chain is live AND waiting
   * for exactly this step, and — for a player chain — it is about the person
   * the chain named rather than a fresh random subject. That binding replaced
   * the old global one, where a single live flag made every subject-bearing
   * event in the catalogue be about the same man for six weeks.
   *
   * Cooldowns do not apply to a beat: the chain itself rations it, and a
   * cooldown left over from the last time the story ran would strand this one.
   */
  chain?: { id: SundayChainId; step: number };
  /** The event is about the CAPTAIN, whoever that currently is. */
  subjectIsCaptain?: boolean;
  /**
   * Who this event is allowed to be about. Defaults to "anybody who will
   * actually be there on Sunday".
   *
   * Without it the selector picked any squad member at random, so the
   * goalkeeper who was in no state to play could be a centre-half, and the
   * event condition was judged against whoever the single pre-pick happened to
   * land on rather than against anyone who fits. Override it to widen the pool
   * (an event ABOUT an absentee) or to narrow it (an event about a keeper).
   */
  subjectFilter?: (person: SundayEventPerson) => boolean;
  /** Fires at most once per save. */
  once?: boolean;
  /** Override the default cooldown, in weeks. */
  cooldown?: number;
  /** Empty for an informational event with a single Acknowledge. */
  choices: SundayEventChoiceDef[];
}

const ack = (outcome: string, effects: SundayEventEffects = {}): SundayEventChoiceDef[] => [
  { id: 'ok', label: 'Right then', hint: '', effects, outcome },
];

/**
 * How a story closes when it cannot be told any further.
 *
 * Two ways that happens, and they read differently:
 *
 *   `gone`  — the man it was about is off the books. The arc has an ending,
 *             it just is not the one anybody chose.
 *   `faded` — the premise evaporated (knocked out of the cup, the books came
 *             good) and the deadline passed with no beat left that is true.
 *
 * Either way the week log SAYS SO. A story that stops without a line is
 * indistinguishable from a bug, and it is the thing the old flag-based chain
 * did roughly a third of the time.
 */
export interface SundayChainClosingText { gone: string; faded: string }

export const SUNDAY_CHAIN_CLOSINGS: Readonly<Record<SundayChainId, SundayChainClosingText>> = {
  'rival-defection': {
    gone: 'The {name} situation resolved itself — he is gone.',
    faded: 'Nothing more was said about {name} and the other lot. It has gone quiet.',
  },
  'captain-conflict': {
    gone: '{name} is no longer here, and neither is the argument about him.',
    faded: 'Whatever {name} was unhappy about, he has stopped saying it.',
  },
  'star-arc': {
    gone: '{name} has moved on. The dressing room is noticeably quieter.',
    faded: '{name} has gone off the boil and stopped mentioning bigger clubs.',
  },
  wonderkid: {
    gone: '{name} has left. Somebody else will have to be the future.',
    faded: 'The fuss about {name} has died down. He is just one of the lads again.',
  },
  'veteran-farewell': {
    gone: '{name} has finished. No do, no speech — he just stopped coming.',
    faded: '{name} has said no more about packing it in. Give him another year.',
  },
  'financial-crisis': {
    gone: 'The committee have stopped ringing.',
    faded: 'There is money in the account again. Nobody mentions the meeting.',
  },
  'cup-run': {
    gone: 'The cup run is over.',
    faded: 'The cup run is over, and Sunday is a league game like any other.',
  },
};

/** Fill a closing line with what the chain remembered about its subject. */
export function sundayChainClosingLine(
  id: SundayChainId,
  reason: keyof SundayChainClosingText,
  name: string | null,
): string {
  const text = SUNDAY_CHAIN_CLOSINGS[id]?.[reason] ?? 'That story has run its course.';
  return text.replace(/\{name\}/g, name ?? 'he');
}

export const SUNDAY_EVENTS: readonly SundayEventDef[] = [
  // ── Player events ─────────────────────────────────────────────────────────
  {
    id: 'captain-furious',
    category: 'player',
    tone: 'negative',
    title: 'The captain is not having it',
    body: '{name} has pulled you aside. He knows he was only on the bench last week, he knows he is carrying a knock, and he wants you to know that he has played through worse than this and that the lads notice these things.',
    weight: 8,
    needsSubject: true,
    subjectIsCaptain: true,
    // OPENER of `captain-conflict`. Two of the three answers leave it hanging,
    // and a hanging armband row is the start of a story rather than the end
    // of a conversation.
    condition: ctx => !!ctx.captain && ctx.captain.benchedStreak >= 1 && !ctx.playerStoryLive,
    choices: [
      {
        id: 'start', label: 'Tell him he starts', hint: 'A real promise. Break it and he will know.',
        effects: { subjectHappiness: 8, morale: -2, squadHappiness: -2, promiseStart: true },
        outcome: 'He gets his way, and everyone within earshot knows it.',
      },
      {
        id: 'bench', label: 'He is on the bench', hint: 'Hold the line. He will not let it go.',
        effects: { subjectHappiness: -14, morale: 2, startChain: { id: 'captain-conflict' } },
        outcome: 'He takes it badly and says almost nothing all afternoon. The rest of them respect it.',
      },
      {
        id: 'explain', label: 'Explain the decision properly', hint: 'Depends on how reasonable he is.',
        successChance: ctx => 0.35 + (ctx.captain ? (20 - ctx.captain.ego) * 0.03 : 0),
        effects: { subjectHappiness: 5, morale: 3 },
        outcome: 'He does not like it, but he gets it. He is first on the touchline when it kicks off.',
        failEffects: { subjectHappiness: -10, morale: -3, startChain: { id: 'captain-conflict' } },
        failOutcome: 'He listens to about nine words of it and walks off mid-sentence.',
      },
    ],
  },
  {
    id: 'captain-showdown',
    category: 'player',
    tone: 'negative',
    title: '{name} has taken it to the group',
    body: 'It is not a private grievance any more. {name} raised the whole thing in front of everybody before training — the bench, the armband, who actually runs this club — and now the room is standing about waiting to see what you do.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'captain-conflict', step: 2 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'back', label: 'Put him straight back in the side', hint: 'He gets what he wanted. Some of them are counting.',
        effects: {
          subjectHappiness: 12, squadHappiness: -3, morale: -2, promiseStart: true,
          advanceChain: 'captain-conflict', chainData: { stance: 'backed' },
        },
        outcome: 'He is named in the XI before the meeting has broken up. Two of them exchange a look.',
      },
      {
        id: 'strip', label: 'Take the armband off him', hint: 'The room will feel this in proportion to how much of it he carried.',
        effects: {
          captaincy: 'strip', subjectHappiness: -16,
          advanceChain: 'captain-conflict', chainData: { stance: 'stripped' },
        },
        outcome: 'You hand it to somebody else in front of everyone. Nobody says a word, which is worse.',
      },
      {
        id: 'hold', label: 'Say your piece and end it there', hint: 'Finishes it, well or badly.',
        successChance: ctx => 0.4 + (ctx.subject ? (20 - ctx.subject.ego) * 0.025 : 0),
        effects: { morale: 3, subjectHappiness: -4, endChain: 'captain-conflict' },
        outcome: 'It lands. He is not happy about it, but he is finished talking about it.',
        failEffects: { morale: -4, subjectHappiness: -10, squadHappiness: -2, endChain: 'captain-conflict' },
        failOutcome: 'He hears none of it and the meeting breaks up badly. That is the end of the conversation, at least.',
      },
    ],
  },
  {
    id: 'captain-backed-fallout',
    category: 'player',
    tone: 'neutral',
    title: 'The armband had a price',
    body: 'You backed {name} in front of the group and he has been the best thing about the last few weeks. The trouble is the two lads who have not started since: one has begun arriving at ten past, and the other has stopped arriving.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'captain-conflict', step: 3 },
    subjectFilter: () => true,
    condition: ctx => ctx.chainData.stance === 'backed',
    choices: [
      {
        id: 'mend', label: 'Go and see the two you lost', hint: 'Two phone calls and an honest hour.',
        successChance: ctx => 0.4 + ctx.teamMorale * 0.005,
        effects: { squadHappiness: 7, morale: 4, endChain: 'captain-conflict' },
        outcome: 'Both of them turn up on Sunday. One of them even says thanks, in his own way.',
        failEffects: { squadHappiness: -4, morale: -3, endChain: 'captain-conflict' },
        failOutcome: 'One is polite and unmoved. The other does not pick up. That is a squad number gone.',
      },
      {
        id: 'settle', label: 'Let it settle on its own', hint: 'It might. He is worth it either way.',
        effects: { morale: -2, subjectHappiness: 5, subjectCommitment: 1, endChain: 'captain-conflict' },
        outcome: 'It does not blow up and it does not go away. {name} plays like a man who owes you one.',
      },
    ],
  },
  {
    id: 'captain-stripped-fallout',
    category: 'player',
    tone: 'neutral',
    title: '{name} has gone quiet',
    body: '{name} has said almost nothing since you took the armband off him. He turns up, he plays, he goes home. The new captain is doing fine. Nobody has mentioned it once, which is how you know it is still going on.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'captain-conflict', step: 3 },
    subjectFilter: () => true,
    condition: ctx => ctx.chainData.stance === 'stripped',
    choices: [
      {
        id: 'job', label: 'Give him something that matters', hint: 'Set pieces, the subs tin, the young lads.',
        effects: {
          subjectHappiness: 12, subjectCommitment: 1, morale: 3, endChain: 'captain-conflict',
          subjectMemory: { kind: 'talked-round', text: 'Lost the armband and was given a job that mattered more. Never mentioned it again.' },
        },
        outcome: 'He takes it seriously, because of course he does. That is why he had the armband.',
      },
      {
        id: 'leave', label: 'Leave him to it', hint: 'He is a grown man. Costs nothing today.',
        effects: { subjectHappiness: -7, morale: 1, endChain: 'captain-conflict' },
        outcome: 'He gets on with it. He is a little further away every week, and nobody can point to when it started.',
      },
    ],
  },
  {
    id: 'play-me',
    category: 'player',
    tone: 'negative',
    title: '"When am I actually playing?"',
    body: '{name} has been available every week and has watched every minute of it from a folding chair. He is not angry. He is worse than angry — he is asking reasonable questions.',
    weight: 10,
    needsSubject: true,
    condition: ctx => !!ctx.subject && ctx.subject.benchedStreak >= 3,
    choices: [
      {
        id: 'promise', label: 'Promise him a start', hint: 'A real promise. The game will hold you to it.',
        effects: { subjectHappiness: 6, subjectCommitment: 1, promiseStart: true },
        outcome: 'He is visibly relieved. He will remember this, one way or the other.',
      },
      {
        id: 'honest', label: 'Tell him the truth', hint: 'He is not good enough right now.',
        successChance: ctx => 0.4 + (ctx.subject ? ctx.subject.commitment * 0.02 : 0),
        effects: { subjectHappiness: -4, subjectCommitment: 2 },
        outcome: 'He takes it on the chin and asks what he needs to work on. Good lad.',
        failEffects: { subjectHappiness: -18 },
        failOutcome: 'He does not take it well. He has already texted someone about a Saturday team.',
      },
      {
        id: 'ignore', label: 'Say nothing', hint: 'Costs nothing today.',
        effects: { subjectHappiness: -9 },
        outcome: 'You mean to get back to him. You do not get back to him.',
      },
    ],
  },
  {
    id: 'kit-forgotten',
    category: 'matchday',
    tone: 'negative',
    title: 'Nobody has the kit',
    // The event roll happens at the END of the week, so the framing is the
    // Sunday COMING rather than a car park forty minutes before kick-off.
    body: '{name} took the kit home to wash it three weeks ago and has not answered his phone since. Unless something changes before Sunday, eleven men will be turning out in various shades of grey.',
    weight: 9,
    needsSubject: true,
    // The man with the kit is very often the man who has stopped turning up.
    subjectFilter: () => true,
    condition: ctx => ctx.availableCount >= 7,
    choices: [
      {
        id: 'buy', label: 'Emergency bibs from the leisure centre (£25)', hint: 'Solves it. Looks ridiculous.',
        available: ctx => ctx.balance >= 25,
        effects: { money: -25, morale: -1 },
        outcome: 'Bibs it is. The opposition will find this extremely funny for the full ninety.',
      },
      {
        id: 'borrow', label: 'Ask the other lot to lend you theirs', hint: 'Free, if they are decent about it.',
        successChance: ctx => 0.5 + ctx.reputation * 0.004,
        effects: { reputation: 1, morale: 1 },
        outcome: 'They have a spare set in the van and are happy to bring it. Genuinely nice people.',
        failEffects: { morale: -4, reputation: -1 },
        failOutcome: 'They enjoy saying no far too much. You will play in whatever you arrive in.',
      },
      {
        id: 'fine', label: 'Fine him and make do', hint: 'Recovers £15. He will not forget.',
        effects: { money: 15, subjectHappiness: -12, morale: -2 },
        outcome: 'He pays up eventually and mentions it every week until Christmas.',
      },
    ],
  },
  {
    id: 'keeper-hungover',
    category: 'matchday',
    tone: 'negative',
    title: 'The goalkeeper is in no state',
    body: 'Word has got back that {name} is still going at two in the morning, and Sunday is a nine-thirty kick-off. He has already asked, twice, what time it is.',
    weight: 7,
    needsSubject: true,
    // A goalkeeper, or it is not this event. If nobody who can go in goal is
    // available, the week simply produces something else.
    subjectFilter: p => p.available && p.position === 'GK',
    condition: ctx => ctx.availableCount >= 8,
    cooldown: 8,
    choices: [
      {
        id: 'play', label: 'Put him in goal anyway', hint: 'He might be fine. He might not.',
        successChance: () => 0.4,
        effects: { morale: 2 },
        outcome: 'He turns up, makes two outstanding saves, and remembers none of it.',
        failEffects: { morale: -5, subjectHappiness: -4 },
        failOutcome: 'He is beaten at his near post twice and apologises to everybody individually.',
      },
      {
        id: 'outfield', label: 'Someone else goes in goal', hint: 'Safe, and nobody wants to.',
        effects: { subjectHappiness: -6, morale: -1 },
        outcome: 'A centre-half volunteers with the air of a man being sent over the top.',
      },
      {
        id: 'coffee', label: 'Coffee and a bacon roll waiting for him (£8)', hint: 'Might just work.',
        available: ctx => ctx.balance >= 8,
        successChance: () => 0.68,
        effects: { money: -8, subjectHappiness: 6 },
        outcome: 'Twenty minutes and a bacon roll later he is a different man. Mostly.',
        failEffects: { money: -8, morale: -3 },
        failOutcome: 'He eats the roll. It does not help.',
      },
    ],
  },
  {
    id: 'ex-pro-attitude',
    category: 'player',
    tone: 'negative',
    title: '{name} has some feedback',
    body: 'After Sunday, {name} explained to the group — at length, in the car park, unprompted — how things were done at the academy he was released from in 2011.',
    weight: 7,
    needsSubject: true,
    condition: ctx => !!ctx.subject && ctx.subject.ego >= 15,
    choices: [
      {
        id: 'back', label: 'Back him publicly', hint: 'He is your best player, after all.',
        effects: { subjectHappiness: 10, squadHappiness: -3, morale: -2 },
        outcome: 'He is delighted. Two of the lads exchange a look you are not supposed to see.',
      },
      {
        id: 'shut-down', label: 'Shut it down in front of everyone', hint: 'Popular. Risky.',
        successChance: ctx => 0.45 + ctx.teamMorale * 0.004,
        effects: { subjectHappiness: -10, squadHappiness: 5, morale: 4 },
        outcome: 'The dressing room enjoys that enormously. He is quiet, and he is better for it.',
        failEffects: { subjectHappiness: -20, morale: -2, subjectEgo: 1 },
        failOutcome: 'He does not back down and it turns into a genuine row. Two people leave early.',
      },
      {
        id: 'quiet-word', label: 'Have a quiet word after', hint: 'Slower, safer.',
        effects: { subjectHappiness: -2, subjectEgo: -1, morale: 1 },
        outcome: 'He half-listens, but he is noticeably less loud the following week.',
      },
    ],
  },
  {
    id: 'star-ego',
    category: 'player',
    tone: 'negative',
    title: '{name} has started saying it out loud',
    body: '{name} is comfortably the best player at this club, and he has begun mentioning — to anyone in earshot, in the car park, at some length — that he is playing at the wrong level. He is not wrong. That is the problem.',
    weight: 7,
    needsSubject: true,
    // OPENER of `star-arc`. The old catalogue had three separate events saying
    // "somebody wants your best player" (`better-offer`, `rival-poach`,
    // `rival-sniffing`) with no relationship between them. Now the offer is
    // the END of an arc that starts here, and `rival-poach` is retired.
    subjectFilter: p => p.available && p.overall >= SUNDAY_CHAIN_STAR_OVERALL,
    condition: ctx => !!ctx.subject && ctx.subject.ego >= 12 && !ctx.playerStoryLive,
    cooldown: 14,
    choices: [
      {
        id: 'indulge', label: 'Build the side around him', hint: 'He will love it. They will notice.',
        effects: {
          subjectHappiness: 10, squadHappiness: -3, subjectEgo: 1,
          startChain: { id: 'star-arc' }, chainData: { gave: 'nothing', handled: 'indulged' },
        },
        outcome: 'Everything goes through him from Sunday on. He is brilliant, and the room is a degree colder.',
      },
      {
        id: 'level', label: 'Remind him where he is playing', hint: 'Depends how far gone he is.',
        successChance: ctx => 0.55 - (ctx.subject ? ctx.subject.ego * 0.02 : 0),
        effects: { subjectEgo: -2, morale: 3, squadHappiness: 2 },
        outcome: 'He laughs, admits it, and buys the first round. That is the end of that.',
        failEffects: {
          subjectHappiness: -10,
          startChain: { id: 'star-arc' }, chainData: { gave: 'nothing', handled: 'challenged' },
        },
        failOutcome: 'He does not laugh. He says very little for the rest of the evening.',
      },
      {
        id: 'ignore', label: 'Say nothing and keep picking him', hint: 'It is only talk. For now.',
        effects: {
          subjectHappiness: 2,
          startChain: { id: 'star-arc' }, chainData: { gave: 'nothing', handled: 'ignored' },
        },
        outcome: 'You let it go. He keeps saying it, and one or two of them have started agreeing.',
      },
    ],
  },
  {
    id: 'star-demands',
    category: 'player',
    tone: 'neutral',
    title: '{name} wants something',
    body: 'He has been straight with you, which you can at least respect. He will stay, and he would like something for it: his subs covered for the season, or the armband, or a straight answer about why neither.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'star-arc', step: 2 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'subs', label: 'Cover his subs for the season (£40)', hint: 'Crude. Works on some.',
        available: ctx => ctx.balance >= 40,
        effects: {
          money: -40, subjectHappiness: 8, squadHappiness: -2,
          advanceChain: 'star-arc', chainData: { gave: 'money' },
        },
        outcome: 'Done, quietly. Two of them work it out within a fortnight anyway.',
      },
      {
        id: 'armband', label: 'Give him the captaincy', hint: 'Costs whoever has it now.',
        effects: {
          captaincy: 'give', subjectHappiness: 12, squadHappiness: -4,
          advanceChain: 'star-arc', chainData: { gave: 'armband' },
        },
        outcome: 'He has the armband and he is visibly delighted. The man who had it says nothing at all.',
      },
      {
        id: 'nothing', label: 'He gets what everybody gets', hint: 'Popular. Risky.',
        effects: {
          subjectHappiness: -12, morale: 3, squadHappiness: 3,
          advanceChain: 'star-arc', chainData: { gave: 'nothing' },
        },
        outcome: 'You tell him in front of two other people, which they enjoy enormously and he does not.',
      },
    ],
  },
  {
    id: 'better-offer',
    category: 'player',
    tone: 'negative',
    title: 'Somebody else wants {name}',
    body: 'A team two divisions up have been in touch with {name}. They train. They have a proper pitch. They have, he mentions, a physio. He has told you rather than not told you, which is something.',
    weight: 20,
    needsSubject: true,
    // The TERMINAL beat of `star-arc`. What you gave him at step two is what
    // you have to work with here — see `chainData.gave` in the odds below.
    chain: { id: 'star-arc', step: 3 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'match', label: 'Tell him what he means to this club', hint: 'Words are free. They are also all you have left.',
        successChance: ctx => 0.3
          + (ctx.subject ? ctx.subject.commitment * 0.025 : 0)
          + ctx.teamMorale * 0.003
          + (ctx.chainData.gave === 'nothing' ? -0.1 : 0.12),
        effects: { subjectHappiness: 10, endChain: 'star-arc' },
        outcome: 'He stays. He says he would rather play with his mates, and he means it.',
        failEffects: { subjectLeaves: true, morale: -6, endChain: 'star-arc' },
        failOutcome: 'He is gone. He was polite about it, which somehow makes it worse.',
      },
      {
        id: 'pay', label: 'Put money on the table (£40)', hint: 'Crude, but it works on some.',
        available: ctx => ctx.balance >= 40,
        successChance: ctx => 0.5 + (ctx.subject ? ctx.subject.commitment * 0.015 : 0)
          + (ctx.chainData.gave === 'money' ? -0.15 : 0),
        effects: { money: -40, subjectHappiness: 8, endChain: 'star-arc' },
        outcome: 'He takes the deal and shakes on it. Do not tell the others.',
        failEffects: { money: -40, subjectLeaves: true, morale: -6, endChain: 'star-arc' },
        failOutcome: 'He takes the money for this week and leaves anyway. Outstanding.',
      },
      {
        id: 'let-go', label: 'Wish him well', hint: 'He goes. The squad notices you did not fight.',
        effects: { subjectLeaves: true, morale: -3, reputation: 1, endChain: 'star-arc' },
        outcome: 'He leaves on good terms. He says he will come back for the cup games. He will not.',
      },
    ],
  },
  {
    id: 'warm-up-injury',
    category: 'player',
    tone: 'negative',
    title: 'Injured in the warm-up',
    body: '{name} has gone down in the warm-up. Not in a challenge. Not even under pressure. He was doing a stretch he saw on the internet.',
    weight: 6,
    needsSubject: true,
    condition: () => true,
    cooldown: 12,
    choices: ack(
      'He is out for a fortnight and the group chat is merciless.',
      { subjectInjuryWeeks: 2, subjectOut: true, morale: -2 },
    ),
  },
  {
    id: 'ghost-returns',
    category: 'comedy',
    tone: 'positive',
    title: '{name} has resurfaced',
    body: '{name} has appeared in the group chat after several weeks of total silence, with no explanation and a thumbs up emoji.',
    weight: 6,
    needsSubject: true,
    // This one is ABOUT an absentee, so it deliberately widens the pool.
    subjectFilter: () => true,
    condition: ctx => !!ctx.subject && ctx.subject.commitment <= 8,
    choices: [
      { id: 'welcome', label: 'Welcome him back', hint: 'No questions asked.', effects: { subjectHappiness: 8, subjectCommitment: 1 }, outcome: 'He is back, briefly, and scores. Obviously.' },
      { id: 'question', label: 'Ask where he has been', hint: 'Everyone wants to know.', successChance: () => 0.5, effects: { subjectCommitment: 2, morale: 2 }, outcome: 'The explanation is so mundane that everyone forgives him instantly.', failEffects: { subjectHappiness: -8 }, failOutcome: 'He goes quiet again. That is probably that.' },
    ],
  },

  // ── The wonderkid ─────────────────────────────────────────────────────────
  {
    id: 'wonderkid-spotted',
    category: 'player',
    tone: 'positive',
    title: 'Somebody has noticed {name}',
    body: '{name} is the youngest name on the sheet, he is raw as anything, and on Sunday he did something in the warm-up that made two of the older lads stop and look at each other. He has no idea he did it.',
    weight: 7,
    needsSubject: true,
    subjectFilter: p => p.available && p.archetype === 'prospect' && p.overall < SUNDAY_CHAIN_PROSPECT_CEILING,
    condition: ctx => !!ctx.subject && !ctx.playerStoryLive,
    cooldown: 14,
    choices: [
      {
        id: 'coach', label: 'Stay behind the extra half hour with him', hint: 'Slow, and it actually works.',
        effects: {
          subjectAttrDelta: 1, subjectHappiness: 5,
          startChain: { id: 'wonderkid' }, chainData: { care: 'coached' },
        },
        outcome: 'Forty minutes of crossing and finishing in the dark. He is there before you the following week.',
      },
      {
        id: 'throw', label: 'Throw him straight in', hint: 'A real promise of a start. He is nowhere near ready.',
        effects: {
          promiseStart: true, subjectHappiness: 8, squadHappiness: -2,
          startChain: { id: 'wonderkid' }, chainData: { care: 'thrown' },
        },
        outcome: 'He is in the side. Somebody who has been here six years is not, and has views.',
      },
      {
        id: 'leave', label: 'Leave him alone and let him find it', hint: 'Free. Nothing happens on its own.',
        effects: { morale: 1, subjectHappiness: -2, startChain: { id: 'wonderkid' }, chainData: { care: 'left' } },
        outcome: 'You say nothing to him about it. He carries on being nineteen.',
      },
    ],
  },
  {
    id: 'wonderkid-first-start',
    category: 'player',
    tone: 'neutral',
    title: '{name} is ready, or he is not',
    body: 'It has stopped being theoretical. {name} is fit, he is available, and the man in front of him has done nothing for a month. Everybody can see it. Nobody wants to be the one who says it.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'wonderkid', step: 2 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'start', label: 'Name him and mean it', hint: 'A real promise. The game holds you to it.',
        effects: {
          promiseStart: true, subjectHappiness: 6, squadHappiness: -2,
          advanceChain: 'wonderkid', chainData: { debut: 'started' },
        },
        outcome: 'He is on the teamsheet in ink. His mum is coming.',
      },
      {
        id: 'hold', label: 'Not yet — bring him on when it is safe', hint: 'Protects him. He will not see it that way.',
        effects: { subjectHappiness: -8, morale: 1, advanceChain: 'wonderkid', chainData: { debut: 'held' } },
        outcome: 'Twenty minutes at the end of a game already won. He knows exactly what that is.',
      },
      {
        id: 'ask', label: 'Ask the senior lads what they think', hint: 'They will tell you. You may not like it.',
        successChance: ctx => 0.45 + ctx.teamMorale * 0.004,
        effects: { morale: 4, subjectHappiness: 4, advanceChain: 'wonderkid', chainData: { debut: 'backed' } },
        outcome: 'They say play him, and two of them say they will look after him. That is the club working properly.',
        failEffects: { morale: -3, subjectHappiness: -6, advanceChain: 'wonderkid', chainData: { debut: 'held' } },
        failOutcome: 'They close ranks. He is not playing, and now he knows whose decision that was.',
      },
    ],
  },
  {
    id: 'wonderkid-scouted',
    category: 'player',
    tone: 'negative',
    title: 'A proper club have sent somebody',
    body: 'There was a man on the touchline on Sunday in a good coat with a notebook, and he was not there for the football. He has left a number for {name}, who has not stopped looking at it.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'wonderkid', step: 3 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'blessing', label: 'Drive him to the trial yourself', hint: 'You lose him. You do it properly.',
        effects: { subjectLeaves: true, reputation: 4, morale: -3, endChain: 'wonderkid' },
        outcome: 'He signs on the Tuesday and rings you after his first game. That is worth more than the player was.',
      },
      {
        id: 'keep', label: 'Tell him he owes this club a season', hint: 'Depends entirely on the lad.',
        successChance: ctx => 0.35 + (ctx.subject ? ctx.subject.commitment * 0.03 : 0),
        effects: {
          subjectHappiness: 6, subjectCommitment: 2, endChain: 'wonderkid',
          subjectMemory: { kind: 'milestone', text: 'Turned down a proper club to see the season out here. Nobody made him.' },
        },
        outcome: 'He stays. He tells them he has got something on here first, which is one way of putting it.',
        failEffects: { subjectLeaves: true, morale: -6, squadHappiness: -3, endChain: 'wonderkid' },
        failOutcome: 'He goes anyway, and he goes badly — no goodbye, and two of the lads think you handled it wrong.',
      },
    ],
  },

  // ── The long server ───────────────────────────────────────────────────────
  {
    id: 'veteran-hints',
    category: 'player',
    tone: 'neutral',
    title: '{name} has started talking about his knees',
    body: '{name} has played {apps} games for this club and spent most of Sunday afternoon with a bag of frozen peas on something. He mentioned, twice, that his lad has started playing on Saturdays and he would quite like to watch.',
    weight: 6,
    needsSubject: true,
    subjectFilter: p => p.age >= SUNDAY_CHAIN_VETERAN_AGE && p.clubApps >= SUNDAY_CHAIN_VETERAN_APPS,
    condition: ctx => !!ctx.subject && !ctx.playerStoryLive,
    cooldown: 16,
    choices: [
      {
        id: 'persuade', label: 'Tell him you need one more year out of him', hint: 'Depends what is left in the legs and the head.',
        successChance: ctx => 0.4 + (ctx.subject ? ctx.subject.commitment * 0.02 : 0),
        effects: {
          subjectCommitment: 2, subjectHappiness: 6,
          startChain: { id: 'veteran-farewell' }, chainData: { mood: 'persuaded' },
        },
        outcome: 'He grumbles the whole way through and then says he will see how it goes. That is a yes.',
        failEffects: {
          subjectHappiness: -2,
          startChain: { id: 'veteran-farewell' }, chainData: { mood: 'tired' },
        },
        failOutcome: 'He says he will think about it in the voice men use when they have already thought about it.',
      },
      {
        id: 'respect', label: 'Tell him nobody would blame him', hint: 'Honest. It makes it real.',
        effects: {
          subjectHappiness: 8, morale: 2,
          startChain: { id: 'veteran-farewell' }, chainData: { mood: 'ready' },
        },
        outcome: 'He looks relieved, which tells you he had been carrying it for a while.',
      },
    ],
  },
  {
    id: 'veteran-decision',
    category: 'player',
    tone: 'neutral',
    title: 'How {name} finishes',
    body: 'It is going to happen this season one way or the other, and how is your call. A proper send-off with a bucket at the gate, one more year on the sheet, or nothing at all and one Sunday he simply is not there.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'veteran-farewell', step: 2 },
    subjectFilter: () => true,
    condition: () => true,
    choices: [
      {
        id: 'testimonial', label: 'Put on a testimonial', hint: 'A bucket at the gate and a night in the club. It pays.',
        effects: {
          money: 55, morale: 6, reputation: 2,
          advanceChain: 'veteran-farewell', chainData: { send: 'testimonial' },
        },
        outcome: 'A date goes in the calendar and somebody\'s sister does a poster. It is happening.',
      },
      {
        id: 'again', label: 'Ask him for one more season', hint: 'You keep him. His knees do not get a vote.',
        effects: {
          subjectCommitment: 2, subjectHappiness: 8,
          advanceChain: 'veteran-farewell', chainData: { send: 'again' },
        },
        outcome: 'He signs on for another year on the understanding that nobody mentions the knees again.',
      },
      {
        id: 'quiet', label: 'Let it end quietly', hint: 'No fuss. Everybody notices the no fuss.',
        effects: { subjectLeaves: true, morale: -4, squadHappiness: -3, endChain: 'veteran-farewell' },
        outcome: 'He stops being on the sheet. Nobody organises anything. It is exactly what everybody was afraid of.',
      },
    ],
  },
  {
    id: 'veteran-testimonial-day',
    category: 'club',
    tone: 'positive',
    title: '{name}\'s afternoon',
    body: 'Two hundred people, most of whom have never watched a Sunday league game in their lives, are stood round the pitch in coats. He has the armband whether he wants it or not, and his lad is a mascot.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'veteran-farewell', step: 3 },
    subjectFilter: () => true,
    condition: ctx => ctx.chainData.send === 'testimonial',
    choices: [
      {
        id: 'ninety', label: 'He plays the full ninety', hint: 'What he wants. His hamstring may disagree.',
        successChance: () => 0.6,
        effects: {
          morale: 9, squadHappiness: 6, reputation: 2, subjectHappiness: 14, endChain: 'veteran-farewell',
          subjectMemory: { kind: 'milestone', text: 'His testimonial. Ninety minutes, and the whole touchline sang his name at the end.' },
        },
        outcome: 'He lasts the ninety, sets one up, and is carried off by people who were not born when he signed.',
        failEffects: {
          morale: 4, squadHappiness: 3, subjectInjuryWeeks: 3, subjectOut: true, endChain: 'veteran-farewell',
          subjectMemory: { kind: 'injury', text: 'Went at the hour mark of his own testimonial and laughed about it all the way off.' },
        },
        failOutcome: 'His hamstring goes on the hour in front of everyone he knows. He is still laughing about it in the bar.',
      },
      {
        id: 'cameo', label: 'Ten minutes and a standing ovation', hint: 'Safe, and the moment still lands.',
        effects: {
          morale: 6, squadHappiness: 4, subjectHappiness: 9, reputation: 1, endChain: 'veteran-farewell',
          subjectMemory: { kind: 'milestone', text: 'Came on for the last ten of his testimonial to a standing ovation from both sides.' },
        },
        outcome: 'Ten minutes, one heavy touch, and an ovation that goes on longer than the cameo did.',
      },
    ],
  },
  {
    id: 'veteran-last-season',
    category: 'player',
    tone: 'positive',
    title: '{name} has signed on for one more',
    body: 'He is back for another year, and everybody knows what it cost him to say yes. He wants to know what you actually want from him, because he is not going to be running about like he did.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'veteran-farewell', step: 3 },
    subjectFilter: () => true,
    condition: ctx => ctx.chainData.send === 'again',
    choices: [
      {
        id: 'armband', label: 'Give him the armband for the year', hint: 'Costs whoever has it now.',
        effects: {
          captaincy: 'give', subjectHappiness: 10, morale: 4, endChain: 'veteran-farewell',
          subjectMemory: { kind: 'milestone', text: 'Given the armband for a last season and led the club through all of it.' },
        },
        outcome: 'He takes it seriously, runs the dressing room, and does about nine miles less a game. Worth it.',
      },
      {
        id: 'coach', label: 'Ask him to bring the young ones on', hint: 'Spreads what he knows before it walks out.',
        effects: {
          subjectHappiness: 6, squadHappiness: 5, subjectCommitment: 1, endChain: 'veteran-farewell',
          subjectMemory: { kind: 'talked-round', text: 'Spent his last season teaching the young lads how to actually defend a corner.' },
        },
        outcome: 'Two of the younger ones start standing where he tells them to. It is noticeable within a month.',
      },
    ],
  },

  // ── Who they are ──────────────────────────────────────────────────────────
  //
  // Eleven archetypes are generated for every squad and, until these, exactly
  // ZERO events read one — the same was true of `temper`, `influence`,
  // `leaguePosition` and the cup. A Golden Retriever and a Hothead lived
  // identical lives. These six are gated on who the man actually is, so the
  // week a hothead gets sent off feels like a different week from the one the
  // glass ankle limps out of.
  {
    id: 'ex-pro-punditry',
    category: 'comedy',
    tone: 'neutral',
    title: '{name} has been on the radio',
    body: 'Local radio wanted forty seconds on the state of the county leagues. {name} gave them eleven minutes, named three referees, and described this division as "a graveyard for talent" while wearing the club\'s training top.',
    weight: 6,
    needsSubject: true,
    subjectFilter: p => p.archetype === 'ex-pro',
    condition: ctx => !!ctx.subject,
    cooldown: 14,
    choices: [
      {
        id: 'lean-in', label: 'Put him up for more of it', hint: 'He is good at it. It gets the club named.',
        effects: { reputation: 4, subjectHappiness: 8, subjectEgo: 1, squadHappiness: -2 },
        outcome: 'He becomes a minor local fixture. The club gets mentioned every fortnight, usually favourably.',
      },
      {
        id: 'quiet', label: 'Ask him to leave the club out of it', hint: 'Depends how much he listens to anybody.',
        successChance: ctx => 0.5 + (ctx.subject ? (20 - ctx.subject.ego) * 0.02 : 0),
        effects: { subjectEgo: -1, morale: 2 },
        outcome: 'He takes the point and keeps the badge out of shot from then on.',
        failEffects: { subjectHappiness: -8, reputation: -2 },
        failOutcome: 'He mentions on air that some people at his club cannot take honesty. Marvellous.',
      },
      {
        id: 'nothing', label: 'Leave him to it', hint: 'It is only local radio.', effects: {}, declines: true,
        outcome: 'You let it go. Somebody at the league office did not.',
      },
    ],
  },
  {
    id: 'hothead-row',
    category: 'matchday',
    tone: 'negative',
    title: '{name} and the touchline',
    body: 'There was a full and frank exchange with somebody\'s dad behind the goal on Sunday, and {name} was one half of it. The referee did not see it. Roughly forty other people did.',
    weight: 7,
    needsSubject: true,
    subjectFilter: p => p.available && (p.archetype === 'hothead' || p.temper >= 15),
    condition: ctx => !!ctx.subject && ctx.lastResult !== null,
    cooldown: 10,
    choices: [
      {
        id: 'sit', label: 'Sit him out on Sunday', hint: 'Costs you a player. Ends it here.',
        effects: { subjectOut: true, subjectHappiness: -10, morale: 2, reputation: 1 },
        outcome: 'He does not play, and he stands behind the goal all afternoon being extremely well behaved.',
      },
      {
        id: 'captain-word', label: 'Get the senior lads to have a word', hint: 'Works if the room actually carries.',
        successChance: ctx => 0.35 + (ctx.captain ? ctx.captain.influence * 0.025 : 0),
        effects: { subjectHappiness: 2, morale: 3, subjectCommitment: 1 },
        outcome: 'Two of them take him for a pint and it is dealt with the way these things should be dealt with.',
        failEffects: { subjectHappiness: -6, morale: -3 },
        failOutcome: 'It turns into a second row, this time inside the club. Nobody comes out of it well.',
      },
      {
        id: 'shrug', label: 'He is who he is', hint: 'Free. He plays. So does his temper.',
        effects: { subjectHappiness: 6, reputation: -2 },
        outcome: 'You back him without saying much. He is booked inside twenty minutes on Sunday.',
      },
    ],
  },
  {
    id: 'glass-scare',
    category: 'player',
    tone: 'negative',
    title: '{name} felt something in the warm-up',
    body: 'Nothing has gone, exactly. {name} has just gone very quiet and started walking it off in small circles, which anybody who has watched him for a season recognises immediately.',
    weight: 7,
    needsSubject: true,
    subjectFilter: p => p.available && p.archetype === 'glass',
    condition: ctx => !!ctx.subject,
    cooldown: 10,
    choices: [
      {
        id: 'risk', label: 'Start him and hope', hint: 'He is your best option. He is also made of glass.',
        successChance: () => 0.45,
        effects: { subjectHappiness: 6, morale: 2 },
        outcome: 'He gets through it and is outstanding, and does not train again until Thursday.',
        failEffects: { subjectInjuryWeeks: 3, subjectOut: true, morale: -4, subjectHappiness: -4 },
        failOutcome: 'Twenty-five minutes, and it goes properly. Three weeks, minimum, and everybody saw it coming.',
      },
      {
        id: 'rest', label: 'Stand him down for a fortnight', hint: 'Safe. Short-handed.',
        effects: { subjectOut: true, subjectHappiness: -5, subjectCommitment: 1 },
        outcome: 'He sulks about it for a week and is genuinely grateful for it by the third.',
      },
      {
        id: 'strap', label: 'Strap it and give him twenty minutes (£10)', hint: 'A compromise, and it costs.',
        available: ctx => ctx.balance >= 10,
        successChance: () => 0.72,
        effects: { money: -10, subjectHappiness: 4, morale: 1 },
        outcome: 'Twenty minutes off the bench, strapped to the eyeballs, and he comes through it fine.',
        failEffects: { money: -10, subjectInjuryWeeks: 2, subjectOut: true, morale: -2 },
        failOutcome: 'He goes in his fourth minute on the pitch. The strapping was decorative.',
      },
    ],
  },
  {
    id: 'prospect-trial',
    category: 'player',
    tone: 'neutral',
    title: 'The district side want a look at {name}',
    body: 'Somebody has put {name} forward for a district trial. It is on a Sunday morning, obviously, and it is the same Sunday morning as everybody else\'s Sunday morning.',
    weight: 6,
    needsSubject: true,
    subjectFilter: p => p.available && p.archetype === 'prospect',
    condition: ctx => !!ctx.subject && ctx.availableCount >= 9,
    cooldown: 12,
    choices: [
      {
        id: 'let-him', label: 'Let him go to it', hint: 'You lose him for a week. He will not forget it.',
        effects: {
          subjectOut: true, subjectHappiness: 12, subjectCommitment: 2, reputation: 1,
          subjectMemory: { kind: 'milestone', text: 'The club let him miss a Sunday for his district trial. He talks about it years later.' },
        },
        outcome: 'He goes. He does not get in, and he comes back convinced this club is the best one in the world.',
      },
      {
        id: 'need-him', label: 'You need him on Sunday', hint: 'Honest. He will take it badly.',
        effects: { subjectHappiness: -14, morale: 1 },
        outcome: 'He plays, and he plays well, and he does not say a word to you for a fortnight.',
      },
      {
        id: 'both', label: 'Trial in the morning, bench in the afternoon', hint: 'Two games in a day, at nineteen.',
        successChance: () => 0.55,
        effects: { subjectHappiness: 8, morale: 2, subjectCommitment: 1 },
        outcome: 'He does both, plays the last half hour, and sleeps for fourteen hours. Youth is wasted on them.',
        failEffects: { subjectInjuryWeeks: 2, subjectOut: true, subjectHappiness: -6, morale: -2 },
        failOutcome: 'His legs go halfway through the second game of the day. Entirely predictable, in hindsight.',
      },
    ],
  },
  {
    id: 'top-of-table-nerves',
    category: 'club',
    tone: 'positive',
    title: 'Top of the league, and everybody has noticed',
    body: 'The table has been screenshotted and sent to people who do not care. Two of them have started talking about the last day. It is the back half of the season and this club has never been here.',
    weight: 8,
    needsSubject: true,
    // The man the room listens to is the one who steadies it, or does not.
    subjectFilter: p => p.available && p.influence >= 13,
    condition: ctx => ctx.leaguePosition === 1 && ctx.week > 10 && !!ctx.subject,
    cooldown: 12,
    choices: [
      {
        id: 'name-it', label: 'Say it out loud: we can win this', hint: 'Frees some of them. Freezes others.',
        successChance: ctx => 0.4 + ctx.teamMorale * 0.005,
        effects: { morale: 8, squadHappiness: 4 },
        outcome: 'Saying it takes the weight off. They play the next one like it is a five-a-side.',
        failEffects: { morale: -5, squadHappiness: -3 },
        failOutcome: 'Saying it puts the weight ON. Two of them are unrecognisable on Sunday.',
      },
      {
        id: 'one-at-a-time', label: 'One game at a time, and mean it', hint: 'Dull, steady, occasionally correct.',
        effects: { morale: 2, subjectCommitment: 1, squadHappiness: -1 },
        outcome: 'You give them the oldest line in football with a straight face. It works about as well as it ever does.',
      },
      {
        id: 'lean-on-him', label: `Ask {name} to keep them level`, hint: 'He carries the room. Ask him to use it.',
        effects: { subjectHappiness: 8, morale: 4, squadHappiness: 2, subjectEgo: 1 },
        outcome: '{name} takes it on and the dressing room settles behind him. He enjoys the responsibility rather too much.',
      },
    ],
  },
  {
    id: 'giant-killing-hangover',
    category: 'club',
    tone: 'neutral',
    title: 'Nobody wants to play a league game',
    body: 'The cup tie is still being replayed in the group chat frame by frame. Sunday is a nine-thirty against a side in mid-table, and not one person has mentioned it.',
    weight: 8,
    // Reads the CUP, which no event did before the cup chain existed.
    condition: ctx => ctx.cupRoundsWon >= 1 && ctx.week > 4,
    cooldown: 12,
    choices: [
      {
        id: 'ban-it', label: 'Ban all talk of the cup until Monday', hint: 'Unpopular. Focuses them.',
        effects: { morale: -2, squadHappiness: -2, reputation: 1 },
        outcome: 'You get a professional, joyless performance out of them, which is exactly what you asked for.',
      },
      {
        id: 'ride-it', label: 'Ride the wave — they are enjoying themselves', hint: 'They might carry it into Sunday. Or not.',
        successChance: ctx => 0.45 + ctx.teamMorale * 0.004,
        effects: { morale: 6, squadHappiness: 4 },
        outcome: 'They play like a side who believe they are good, because for six days they have been told they are.',
        failEffects: { morale: -6, squadHappiness: -3 },
        failOutcome: 'They turn up half an hour late in cup-final moods and are two down before anybody wakes up.',
      },
    ],
  },

  // ── Money ─────────────────────────────────────────────────────────────────
  {
    id: 'subs-crisis',
    category: 'money',
    tone: 'negative',
    title: 'Nobody has paid their subs',
    body: 'The tab now stands at £{subsOwed}. Several people have promised to bring it "next week" for a month.',
    weight: 9,
    condition: ctx => ctx.subsOwed >= 30,
    cooldown: 8,
    choices: [
      {
        id: 'chase', label: 'Chase everyone, hard', hint: 'Recovers most of it. Nobody enjoys it.',
        effects: { collectSubs: 0.7, morale: -5, squadHappiness: -3 },
        outcome: 'Most of it comes in. The group chat is a hostile place for two days.',
      },
      {
        id: 'nudge', label: 'A polite reminder', hint: 'Recovers some of it.',
        effects: { collectSubs: 0.35, morale: -1 },
        outcome: 'A few people pay up immediately. The usual suspects do not.',
      },
      {
        id: 'absorb', label: 'Let it go for now', hint: 'Costs the club. Buys goodwill.',
        effects: { morale: 3, squadHappiness: 3 },
        outcome: 'You say nothing. They notice, and they like you for it, and the tab keeps growing.',
      },
    ],
  },
  {
    id: 'broke',
    category: 'money',
    tone: 'negative',
    title: 'There is nothing in the account',
    body: 'The balance is £{balance}. The referee wants paying in cash on Sunday, and he does not take excuses.',
    weight: 12,
    condition: ctx => ctx.balance < 40,
    // Eight, not five. At five this fired often enough to be a standing income
    // stream rather than a crisis.
    cooldown: 8,
    choices: [
      {
        id: 'raffle', label: 'Run a raffle', hint: 'Makes money out of nothing. Everyone has to sell tickets.',
        effects: { money: 90, morale: -4 },
        outcome: 'Ninety pounds and a bottle of whisky nobody wanted. It will do.',
      },
      {
        // THE FIX THE AUDIT ASKED FOR. This used to be +£60, +4 morale and
        // +1 reputation for nothing at all — free money on a five-week timer,
        // which is why bankruptcy never actually bit. It is a LOAN now: the
        // cash is real and immediate, and the club pays you back out of the
        // weekly settlement for the next six or seven weeks.
        id: 'own-pocket',
        label: `Put £${SUNDAY_MANAGER_LOAN} in yourself`,
        hint: 'Instant, and the biggest number here. The club owes you it back.',
        effects: { money: SUNDAY_MANAGER_LOAN, managerLoan: SUNDAY_MANAGER_LOAN, morale: 2 },
        outcome: 'You cover it out of your own account. It goes in the book, and the club starts paying it back on Sunday.',
      },
      {
        id: 'beg', label: 'Ask the pub for an advance', hint: 'Depends on the club’s standing.',
        successChance: ctx => 0.3 + ctx.reputation * 0.012,
        effects: { money: 120 },
        outcome: 'The landlord fronts you the money on the strength of a handshake.',
        failEffects: { reputation: -2 },
        failOutcome: 'The landlord laughs. Loudly. In front of other people.',
      },
    ],
  },
  {
    id: 'unexpected-bill',
    category: 'money',
    tone: 'negative',
    title: 'A bill you were not expecting',
    body: 'The council have written about "pitch reinstatement" following an incident in November that everyone had agreed not to mention again.',
    weight: 5,
    condition: ctx => ctx.week > 6,
    cooldown: 15,
    choices: [
      { id: 'pay', label: 'Pay it (£70)', hint: 'Done and dusted. No argument, no record.', available: ctx => ctx.balance >= 70, effects: { money: -70 }, outcome: 'Paid. Filed. Never spoken of again.' },
      // Rebalanced. At 45% of nothing versus 55% of −£100 the dispute was worth
      // −£55 against a certain −£70 and cost nothing else, so paying was never
      // the right answer. Losing an argument with the council now costs the
      // charge AND standing with the people who allocate the pitches.
      { id: 'dispute', label: 'Dispute it', hint: 'Cheaper on average. Losing it costs more than money.', successChance: () => 0.45, effects: { reputation: 1 }, outcome: 'They drop it entirely. Nobody knows why, and nobody is asking.', failEffects: { money: -110, reputation: -2 }, failOutcome: 'They add an administration charge and a paragraph about "the club\u2019s conduct". It is now £110.' },
      { id: 'ignore', label: 'Put it in the drawer', hint: 'Free today. It does not go away.', effects: { debtWeeks: 1, reputation: -1 }, outcome: 'You file it under the tin. It will be back, and it will have friends.' },
    ],
  },

  // ── The crisis ────────────────────────────────────────────────────────────
  //
  // Triggered by the books, not by a die: `weeksInDebt` is the same counter
  // `advanceSundayWeek` runs the fold clock off, so this story only ever opens
  // when the club is genuinely in trouble — and its beats push that same
  // counter rather than inventing a second way to die.
  {
    id: 'committee-ultimatum',
    category: 'money',
    tone: 'negative',
    title: 'The committee want a word',
    body: 'There is a meeting in the back room of the pub and it is about you. The account has been in the red for {weeks} weeks, the league have written twice, and somebody used the phrase "winding it up" without lowering his voice.',
    weight: 14,
    condition: ctx => ctx.weeksInDebt >= SUNDAY_CHAIN_DEBT_WEEKS && !ctx.clubStoryLive,
    cooldown: 12,
    choices: [
      {
        id: 'plan', label: 'Put an actual plan in front of them', hint: 'Numbers on a page. Depends how you are seen.',
        successChance: ctx => 0.35 + ctx.reputation * 0.01,
        effects: {
          morale: 3, reputation: 1,
          startChain: { id: 'financial-crisis' }, chainData: { standing: 'trusted' },
        },
        outcome: 'They read it, ask two sensible questions, and give you until the end of the season.',
        failEffects: {
          reputation: -2,
          startChain: { id: 'financial-crisis' }, chainData: { standing: 'watched' },
        },
        failOutcome: 'One of them reads it out loud in a particular voice. You have until they say otherwise.',
      },
      {
        id: 'plead', label: 'Ask them for time and nothing else', hint: 'Buys weeks. Costs standing.',
        effects: {
          reputation: -1,
          startChain: { id: 'financial-crisis' }, chainData: { standing: 'watched' },
        },
        outcome: 'You get the time. You also get the distinct impression this was your one ask.',
      },
    ],
  },
  {
    id: 'crisis-sacrifice',
    category: 'money',
    tone: 'negative',
    title: 'Something has to go',
    body: 'The maths does not work and everyone has stopped pretending it does. There are people who would take {name} off your hands and pay something for the privilege, the sponsor would talk about a different deal, or you go round the squad with your hand out again.',
    weight: 20,
    needsSubject: true,
    chain: { id: 'financial-crisis', step: 2 },
    // A CLUB chain, so this beat picks its own subject: somebody actually worth
    // money, not whoever the story happened to name earlier.
    subjectFilter: p => p.overall >= 44,
    condition: () => true,
    choices: [
      {
        id: 'sell', label: `Let {name} go for what they will pay (£${SUNDAY_CRISIS_SALE_FEE})`,
        hint: 'Real money. A real hole in the side.',
        effects: {
          money: SUNDAY_CRISIS_SALE_FEE, subjectLeaves: true, morale: -7, squadHappiness: -4,
          advanceChain: 'financial-crisis', chainData: { gave: 'player' },
        },
        outcome: 'Cash in an envelope and a set of match balls. He shakes hands with everyone on the way out.',
      },
      {
        id: 'sponsor', label: 'Go back to the sponsor for a worse deal', hint: 'Money now, less every week after.',
        available: ctx => ctx.hasSponsor,
        effects: {
          renegotiateSponsor: { upfront: SUNDAY_SPONSOR_RENEGOTIATE_UPFRONT, weeklyMult: SUNDAY_SPONSOR_RENEGOTIATE_MULT },
          morale: -1,
          advanceChain: 'financial-crisis', chainData: { gave: 'sponsor' },
        },
        outcome: 'They are happy to help, on their terms, and their terms are worse than the ones you had.',
      },
      {
        id: 'beg', label: 'Go round the squad with your hand out', hint: 'Every penny owed, today. They will remember.',
        effects: {
          collectSubs: 1, squadHappiness: -8, morale: -6,
          advanceChain: 'financial-crisis', chainData: { gave: 'squad' },
        },
        outcome: 'Everybody pays. Nobody enjoys it, and two of them make a point of paying in coins.',
      },
    ],
  },
  {
    id: 'crisis-survived',
    category: 'money',
    tone: 'positive',
    title: 'The committee have stopped ringing',
    body: 'There is money in the account, the league have been paid, and the man who said "winding it up" has bought you a drink and behaved as though he never said it.',
    weight: 20,
    chain: { id: 'financial-crisis', step: 3 },
    condition: ctx => ctx.balance >= 0,
    choices: ack(
      'It is over. The club exists, which two months ago was genuinely in question.',
      { morale: 5, reputation: 1, endChain: 'financial-crisis' },
    ),
  },
  {
    id: 'crisis-deepens',
    category: 'money',
    tone: 'negative',
    title: 'It has not worked',
    body: 'Whatever you sold and whoever you squeezed, the account is still red. The committee have written it down this time, and there is a date on it.',
    weight: 20,
    chain: { id: 'financial-crisis', step: 3 },
    condition: ctx => ctx.balance < 0,
    choices: [
      {
        id: 'throw', label: 'One last fundraiser, everything in it', hint: 'A big swing. It can also miss.',
        successChance: () => 0.55,
        effects: { money: 130, morale: -6, squadHappiness: -4, endChain: 'financial-crisis' },
        outcome: 'Raffle, race night, a bucket in the pub. It comes in, and it very nearly did not.',
        failEffects: { money: 25, morale: -8, debtWeeks: 2, endChain: 'financial-crisis' },
        failOutcome: 'Twenty-five pounds and an evening nobody will discuss. The clock has moved on two weeks.',
      },
      {
        id: 'accept', label: 'Take it on the chin and keep playing', hint: 'Costs you weeks you may not have.',
        effects: { debtWeeks: 2, morale: -3, endChain: 'financial-crisis' },
        outcome: 'You say nothing and put a fixture out. The date the committee wrote down is closer than it was.',
      },
    ],
  },

  // ── The cup run ───────────────────────────────────────────────────────────
  //
  // Reads the cup state, which until now NO event did — so a mode with a
  // knockout in it never once mentioned the knockout. Every beat checks
  // `cupAlive`, which is what stops the club being told about a semi-final it
  // went out of a fortnight ago.
  {
    id: 'cup-buzz',
    category: 'club',
    tone: 'positive',
    title: 'Nobody is talking about anything except the cup',
    body: 'The {round} is on the calendar and the club has not shut up about it since the draw. Two people who have not played since September have asked whether they are still registered.',
    weight: 10,
    condition: ctx => ctx.cupAlive && ctx.cupRoundsWon >= 1 && !ctx.clubStoryLive,
    cooldown: 20,
    choices: [
      {
        id: 'hype', label: 'Make it the biggest thing of the year (£30)', hint: 'Everybody turns up for a big one. Availability follows the mood.',
        available: ctx => ctx.balance >= 30,
        effects: {
          money: -30, morale: 6, squadHappiness: 5, reputation: 1,
          startChain: { id: 'cup-run' }, chainData: { mood: 'loud' },
        },
        outcome: 'Kit washed, a coach booked, a photo in the local paper. Everyone in the squad has replied to the message.',
      },
      {
        id: 'calm', label: 'Play it down — it is another Sunday', hint: 'Free. Keeps the lid on.',
        effects: { morale: 2, squadHappiness: 1, startChain: { id: 'cup-run' }, chainData: { mood: 'quiet' } },
        outcome: 'You treat it like a league game and say so. One or two are visibly deflated.',
      },
    ],
  },
  {
    id: 'cup-pressure',
    category: 'club',
    tone: 'neutral',
    title: 'The {round} is coming',
    body: 'It is close enough now that people have started driving past the pitch to look at it. The other lot have hired a coach. Somebody has asked about a team photo.',
    weight: 20,
    chain: { id: 'cup-run', step: 2 },
    // Only while there is actually a tie ahead. Knocked out between beats and
    // this cannot fire, which sends the story straight to its aftermath.
    condition: ctx => ctx.cupAlive,
    choices: [
      {
        id: 'spend', label: 'Do it properly — coach, kit, a real warm-up (£45)', hint: 'Costs money. They will feel like a team.',
        available: ctx => ctx.balance >= 45,
        effects: { money: -45, morale: 5, squadHappiness: 4, advanceChain: 'cup-run', chainData: { prep: 'proper' } },
        outcome: 'Everyone arrives together for once. It looks, briefly, like a football club.',
      },
      {
        id: 'normal', label: 'Same as any other week', hint: 'Free. Some of them prefer it.',
        effects: { morale: 1, advanceChain: 'cup-run', chainData: { prep: 'normal' } },
        outcome: 'Nothing special is done and nothing special is said. Kick-off is kick-off.',
      },
      {
        id: 'nerves', label: 'Tell them there is no pressure on them', hint: 'Lands or it does not.',
        successChance: ctx => 0.45 + ctx.teamMorale * 0.004,
        effects: { morale: 7, squadHappiness: 2, advanceChain: 'cup-run', chainData: { prep: 'loose' } },
        outcome: 'It lands. They go into it loose and enjoying themselves, which is the whole trick.',
        failEffects: { morale: -4, squadHappiness: -3, advanceChain: 'cup-run', chainData: { prep: 'tight' } },
        failOutcome: 'Saying it out loud puts the thought in their heads. Two of them barely sleep on Saturday.',
      },
    ],
  },
  {
    id: 'cup-still-standing',
    category: 'club',
    tone: 'positive',
    title: 'Still in it',
    body: 'The club is in the {round}. Nobody at this level expects to be in the {round}, which has not stopped three separate people telling you they always knew.',
    weight: 20,
    chain: { id: 'cup-run', step: 3 },
    condition: ctx => ctx.cupAlive,
    choices: [
      {
        id: 'enjoy', label: 'Let them enjoy it (£25 behind the bar)', hint: 'One night. It costs.',
        available: ctx => ctx.balance >= 25,
        effects: { money: -25, morale: 7, squadHappiness: 5, reputation: 1, endChain: 'cup-run' },
        outcome: 'A night that gets talked about for months, and a training turnout on Sunday that does not.',
      },
      {
        id: 'focus', label: 'Nothing is won yet', hint: 'Keeps their heads. Nobody thanks you.',
        effects: { morale: 2, reputation: 1, squadHappiness: -1, endChain: 'cup-run' },
        outcome: 'You say the sentence every manager says. They roll their eyes, and they turn up on time.',
      },
    ],
  },
  {
    id: 'cup-knocked-out',
    category: 'club',
    tone: 'negative',
    title: 'Out of the cup',
    body: 'That is the run over. It was the best thing that happened all season and it lasted about six weeks, which at this level is a long time to have something to look forward to.',
    weight: 20,
    chain: { id: 'cup-run', step: 3 },
    condition: ctx => !ctx.cupAlive,
    choices: [
      {
        id: 'night', label: 'Take them out anyway (£35)', hint: 'It was worth marking. It still costs.',
        available: ctx => ctx.balance >= 35,
        effects: { money: -35, morale: 6, squadHappiness: 5, endChain: 'cup-run' },
        outcome: 'Nobody mentions the score once. Two of them commit to next season before closing time.',
      },
      {
        id: 'league', label: 'Straight back to the league', hint: 'Cheap. Flat.',
        effects: { morale: -2, squadHappiness: -2, reputation: 1, endChain: 'cup-run' },
        outcome: 'The following Sunday is a nine-thirty against a team in eighth. It feels like it.',
      },
    ],
  },

  // ── Club ──────────────────────────────────────────────────────────────────
  {
    id: 'pitch-unplayable',
    category: 'club',
    tone: 'negative',
    title: 'The pitch is under water',
    body: 'There is standing water across most of the pitch and a man from the council is standing in the middle of it, shaking his head.',
    weight: 6,
    condition: ctx => ctx.week > 4,
    cooldown: 10,
    choices: [
      // Rebalanced now that `pitchDamage` is a real cost. Forking the pitch was
      // strictly better on every axis — less damage AND more morale — so it was
      // not a decision. It costs money now, which means a skint club genuinely
      // has to play on the bog and live with the surface for a month.
      { id: 'play', label: 'Talk him into letting you play on it', hint: 'Free. The surface will not forgive you.', successChance: () => 0.55, effects: { pitchDamage: 22, morale: 1 }, outcome: 'He relents. It is barely football, but it is a fixture off the list.', failEffects: { pitchDamage: 30, morale: -3 }, failOutcome: 'He makes everyone wait an hour before relenting anyway. Frozen, furious, and the pitch is ruined.' },
      { id: 'forks', label: 'Forks, sand and two hours of work (£18)', hint: 'Filthy, oddly bonding, and it costs.', available: ctx => ctx.balance >= 18, effects: { money: -18, pitchDamage: 10, morale: 5, squadHappiness: 2 }, outcome: 'Two hours of forking and a bag of sand off the builder. It plays, and everyone is caked before kick-off.' },
    ],
  },
  {
    id: 'trophy-night',
    category: 'club',
    tone: 'positive',
    title: 'End-of-season do',
    body: 'Somebody has suggested a proper night out with a trophy bought from the shop in town. Somebody else has already booked the function room.',
    weight: 6,
    condition: ctx => ctx.week > 10,
    cooldown: 30,
    choices: [
      { id: 'yes', label: 'Do it properly (£80)', hint: 'Expensive. Worth it.', available: ctx => ctx.balance >= 80, effects: { money: -80, morale: 10, squadHappiness: 8, reputation: 2 }, outcome: 'It is a genuinely great night. Three people commit to next season on the spot.' },
      { id: 'cheap', label: 'A few drinks in the Dog & Duck', hint: 'Cheap and cheerful.', effects: { money: -20, morale: 5, squadHappiness: 3 }, outcome: 'A good night, all told. Somebody makes a speech nobody asked for.' },
      { id: 'no', label: 'Not this year', hint: 'Saves money.', effects: { morale: -4, squadHappiness: -3 }, outcome: 'It quietly does not happen, and it is quietly noted.' },
    ],
  },

  // ── Rivalry ───────────────────────────────────────────────────────────────
  {
    id: 'rival-trash-talk',
    category: 'rivalry',
    tone: 'neutral',
    title: '{rival} have been talking',
    body: 'Word has got back from the pub. Their manager has been holding court about your team, at volume, to anyone who would listen.',
    weight: 8,
    condition: ctx => ctx.hasRival,
    cooldown: 8,
    choices: [
      { id: 'ignore', label: 'Rise above it', hint: 'Dignified. Dull.', effects: { morale: 1 }, outcome: 'You say nothing. It eats at two of your lads all week.' },
      { id: 'respond', label: 'Give it back', hint: 'Fires the squad up. Fires them up too.', effects: { morale: 6, rivalHeat: 2 }, outcome: 'The reply gets screenshotted and shared widely. It is on now.' },
      // The £50 is STAKED now. It used to be a line of dialogue: heat, morale,
      // and no money ever changed hands whatever happened in the derby. It is
      // settled on the next decisive meeting, in the ledger, either way.
      { id: 'bet', label: `Bet him £${SUNDAY_DERBY_BET} on the next meeting`, hint: 'Real money, settled on the derby. A draw leaves it standing.', effects: { rivalHeat: 3, morale: 4, stakeDerbyBet: true }, outcome: 'The bet is on, and everyone in both clubs knows the exact figure by Tuesday.' },
      // Inherited from the retired `rival-poach`: the one branch of that event
      // that was not a duplicate of the defection story.
      { id: 'poach-back', label: 'Go after one of theirs', hint: 'An eye for an eye. He will be expensive.', effects: { rivalHeat: 3, spawnRecruit: 'poached' }, outcome: 'You make a call of your own. Somebody in their squad is suddenly very interested indeed.' },
    ],
  },
  // NOTE: `rival-poach` was retired here. It said the same thing as
  // `rival-sniffing` ("their manager has been seen talking to your unhappy
  // player") with no relationship to it, so the two fired in either order and
  // contradicted each other. The premise now belongs to the defection chain,
  // and its one distinctive branch — going after one of theirs — moved onto
  // `rival-trash-talk`, which is the event about the feud itself.

  {
    id: 'rival-sniffing',
    category: 'rivalry',
    tone: 'negative',
    title: '{rival} are sniffing around {name}',
    body: '{name} has been quiet lately, and now their manager has been seen buying him a pint. Twice. He has not mentioned it, which is somehow worse.',
    weight: 8,
    needsSubject: true,
    // The OPENER of the rival-defection chain. It refuses to start while any
    // player story is already running — one man's situation at a time.
    condition: ctx => ctx.hasRival && ctx.rivalHeat >= 4 && !!ctx.subject && ctx.subject.happiness < 55
      && !ctx.chains.some(c => c.subjectId),
    cooldown: 12,
    choices: [
      {
        id: 'talk', label: 'Sit him down and talk it through', hint: 'Depends on what is left between you.',
        successChance: ctx => 0.4 + (ctx.subject ? ctx.subject.happiness * 0.005 : 0),
        effects: { subjectHappiness: 10 },
        outcome: 'He lays it all out — playing time, the drive, the pitch. You listen. It helps.',
        failEffects: { startChain: { id: 'rival-defection' }, subjectHappiness: -4 },
        failOutcome: 'He says the right words in the wrong tone. This is not finished.',
      },
      {
        id: 'confront-rival', label: 'Confront their manager about it', hint: 'Feels great. Fixes nothing.',
        effects: { rivalHeat: 2, morale: 2, startChain: { id: 'rival-defection' } },
        outcome: 'A frank exchange of views in a car park. Their manager loved every second of it.',
      },
      {
        id: 'ignore', label: 'Pretend you have not noticed', hint: 'Maybe it blows over.',
        effects: { startChain: { id: 'rival-defection' } },
        outcome: 'You say nothing. He notices that too.',
      },
    ],
  },
  {
    id: 'rival-bid',
    category: 'rivalry',
    tone: 'negative',
    title: 'They have actually asked for {name}',
    body: 'It is out in the open now: {rival} want {name}, {name} knows it, and the whole changing room is watching how you handle it.',
    weight: 20,
    needsSubject: true,
    // The TERMINAL beat of the chain, and it is about ONE man — the one the
    // chain named — whether or not he happens to be available this Sunday.
    // Picking anybody else would be a different story with the same title.
    chain: { id: 'rival-defection', step: 2 },
    subjectFilter: () => true,
    condition: ctx => ctx.hasRival,
    choices: [
      {
        id: 'fight', label: 'Fight for him', hint: 'A speech, his subs covered, first name on the sheet.',
        available: ctx => ctx.balance >= 30,
        successChance: ctx => 0.35 + (ctx.subject ? ctx.subject.commitment * 0.03 : 0),
        effects: { money: -30, subjectHappiness: 16, morale: 3, endChain: 'rival-defection' },
        outcome: 'He stays. The speech gets retold for weeks, improving each time.',
        failEffects: { money: -30, subjectLeavesForRival: true, endChain: 'rival-defection' },
        failOutcome: 'He hears you out, shakes your hand, and signs for them on Tuesday.',
      },
      {
        id: 'promise', label: 'Promise him a start every week he turns up', hint: 'A real promise. The game holds you to it.',
        effects: { promiseStart: true, subjectHappiness: 8, endChain: 'rival-defection' },
        outcome: 'That was all he wanted to hear. Now you have to mean it.',
      },
      {
        id: 'release', label: 'Let him go to them', hint: 'The feud gets a face.',
        effects: { subjectLeavesForRival: true, endChain: 'rival-defection' },
        outcome: 'Done. He will be in their colours on Sunday, and everyone knows what that fixture becomes now.',
      },
    ],
  },

  // ── Sponsor ───────────────────────────────────────────────────────────────
  {
    id: 'sponsor-unhappy',
    category: 'sponsor',
    tone: 'negative',
    title: 'Your sponsor has been in touch',
    body: 'They have seen the results. They were, they say, expecting rather more for their money.',
    weight: 6,
    condition: ctx => ctx.hasSponsor && ctx.winless >= 3,
    cooldown: 10,
    choices: [
      { id: 'promise', label: 'Promise them a turnaround', hint: 'Buys time. Costs standing.', effects: { reputation: -1 }, outcome: 'They give you until the end of the season. They will be checking.' },
      { id: 'invite', label: 'Invite them to a match and the pub after', hint: 'Costs a round.', available: ctx => ctx.balance >= 30, effects: { money: -30, reputation: 2 }, outcome: 'They have a great time and stop reading the results table.' },
      // The copy always promised branches that touched the sponsorship and no
      // branch touched it. These two do: one changes the deal, the other can
      // lose it.
      { id: 'renegotiate', label: 'Offer them a cheaper deal to stay', hint: 'Money up front, less every week from here.', effects: { renegotiateSponsor: { upfront: SUNDAY_SPONSOR_RENEGOTIATE_UPFRONT, weeklyMult: SUNDAY_SPONSOR_RENEGOTIATE_MULT }, reputation: 1 }, outcome: 'They take the new terms happily, which tells you what the old ones were worth to them.' },
      { id: 'honest', label: 'Tell them it is a Sunday league team', hint: 'Bold. They can walk.', successChance: () => 0.5, effects: { reputation: 2, morale: 3 }, outcome: 'They laugh, agree entirely, and double down on the sponsorship.', failEffects: { reputation: -3, loseSponsor: true }, failOutcome: 'They do not laugh. The logo is off the shirt by the end of the week.' },
    ],
  },

  // ── Comedy ────────────────────────────────────────────────────────────────
  {
    id: 'wrong-boots',
    category: 'comedy',
    tone: 'neutral',
    title: 'The wrong boots',
    body: '{name}, a {job}, has confirmed that the only footwear he owns is a pair of moulded studs he bought in 2014, and that Sunday\'s frozen pitch does not worry him in the slightest.',
    weight: 5,
    needsSubject: true,
    condition: () => true,
    cooldown: 12,
    choices: ack(
      'He will spend the first half on his backside and the second half in someone else’s trainers.',
      { morale: 2, subjectHappiness: -2 },
    ),
  },
  {
    id: 'ref-decision',
    category: 'comedy',
    tone: 'neutral',
    title: 'The referee has made a decision',
    body: 'A goal has been disallowed for a reason the referee has declined to share with anyone, including his own linesman, who is a substitute from the other team.',
    weight: 5,
    condition: ctx => ctx.lastResult !== null,
    cooldown: 9,
    choices: [
      // Made consequential. Complaining used to be +2 morale for −1 reputation
      // with no upside at all, which is a worse version of doing nothing
      // dressed up as agency. There is now something to win and something to
      // lose on both sides.
      { id: 'complain', label: 'Put it in writing to the league', hint: 'A small chance of the fee back. A real chance of a reputation.', successChance: () => 0.3, effects: { money: 15, reputation: 1, morale: 3 }, outcome: 'They uphold it, refund the match fee and quietly stop appointing him to your games.', failEffects: { reputation: -2, morale: 1 }, failOutcome: 'The league acknowledge receipt. You are now, formally, one of those clubs.' },
      { id: 'let-it-go', label: 'Let it go', hint: 'Costs a bit of steam. Buys you a name for it.', effects: { morale: -2, reputation: 2 }, outcome: 'You say nothing, shake his hand, and he remembers that in March.' },
    ],
  },
  {
    id: 'social-media',
    category: 'comedy',
    tone: 'positive',
    title: 'Somebody has made a club account',
    body: 'There is now an official club account posting match reports. They are extremely detailed, extremely biased, and getting a worrying amount of local engagement.',
    weight: 4,
    once: true,
    condition: ctx => ctx.season >= 1 && ctx.week > 5,
    choices: [
      { id: 'endorse', label: 'Make it official', hint: 'Reputation up. No control.', effects: { reputation: 5, morale: 3 }, outcome: 'The club has a public voice now. Nobody knows whose hands it is in.' },
      { id: 'shut', label: 'Ask them to stop', hint: 'Safe.', effects: { morale: -2 }, outcome: 'They stop. The final post is a passive-aggressive masterpiece.' },
    ],
  },
  {
    id: 'new-face',
    category: 'club',
    tone: 'positive',
    title: 'Somebody has asked for a game',
    body: 'A bloke watching from the touchline has asked, fairly directly, whether you need anyone.',
    // Weight and cooldown both pulled back. At 9/4 this and `thin-squad` were
    // measured firing four to six times a SEASON each: the touchline bloke
    // turned up so often he stopped being a moment and became a menu.
    weight: 6,
    condition: ctx => ctx.squadSize < 20,
    cooldown: 8,
    choices: [
      { id: 'look', label: 'Tell him to come to training', hint: 'You will see him properly first.', effects: { spawnRecruit: 'trial' }, outcome: 'He turns up, and you get a proper look at him before deciding.' },
      { id: 'straight-in', label: 'Sign him on the spot', hint: 'No idea what you are getting.', effects: { spawnRecruit: 'walk-up' }, outcome: 'He is registered before anyone has seen him kick a ball.' },
      { id: 'pass', label: 'Not right now', hint: 'You have enough people.', effects: {}, declines: true, outcome: 'He nods and wanders off. You will wonder about that in three weeks.' },
    ],
  },
  {
    id: 'thin-squad',
    category: 'club',
    tone: 'negative',
    title: 'You are running out of players',
    body: 'There are {squadSize} names on the sheet and at least three of them have not been seen since September.',
    // Still the heaviest thing in the pool when the squad is genuinely short —
    // it should crowd out the comedy — but not every fourth week. Recruitment
    // does not depend on it either way: the weekly recruit roll is boosted
    // separately while the squad is thin (see `SUNDAY_RECRUIT_CHANCE`).
    weight: 11,
    condition: ctx => ctx.squadSize <= 12,
    cooldown: 8,
    choices: [
      // Differentiated. Both branches used to produce a recruit and one of them
      // was free, so "ask at work" was the answer every time. Certainty costs
      // money and goodwill now; the free option is a coin flip.
      { id: 'ring', label: 'Two hours on the phone and a round of drinks (£8)', hint: 'Produces somebody. Guaranteed, and it costs.', available: ctx => ctx.balance >= 8, effects: { money: -8, spawnRecruit: 'mate', morale: -3 }, outcome: 'Two hours of calls, one round bought, and exactly one interested human being.' },
      { id: 'work', label: 'Ask around at work', hint: 'Free. He might not fancy it.', successChance: () => 0.55, effects: { spawnRecruit: 'work' }, outcome: 'Somebody from the depot says he used to play a bit. He is coming Sunday.' , failEffects: { morale: -1 }, failOutcome: 'Everybody says they know somebody. Nobody produces anybody.' },
    ],
  },
  {
    id: 'winning-run',
    category: 'club',
    tone: 'positive',
    title: 'People have started turning up',
    body: 'Three wins on the bounce and suddenly everyone is available, everyone is early, and two people have brought their dads.',
    weight: 7,
    condition: ctx => ctx.winStreak >= 3,
    cooldown: 12,
    choices: ack(
      'Nobody says the word "promotion" out loud, which is how you know everybody is thinking it.',
      { morale: 6, squadHappiness: 4, reputation: 2 },
    ),
  },
  {
    id: 'losing-run',
    category: 'club',
    tone: 'negative',
    title: 'This is not fun any more',
    body: 'Five without a win. The group chat has gone quiet in a way that group chats do not usually go quiet.',
    weight: 9,
    condition: ctx => ctx.winless >= 5,
    cooldown: 10,
    choices: [
      { id: 'meeting', label: 'Call a squad meeting', hint: 'Clears the air, or does not.', successChance: ctx => 0.45 + ctx.teamMorale * 0.005, effects: { morale: 8, squadHappiness: 4 }, outcome: 'It is a good, honest hour. Everyone leaves feeling better about it.', failEffects: { morale: -4 }, failOutcome: 'Four people turn up. One of them leaves early.' },
      { id: 'social', label: 'Forget football, go for a curry (£45)', hint: 'Costs money. Usually works.', available: ctx => ctx.balance >= 45, effects: { money: -45, morale: 9, squadHappiness: 6 }, outcome: 'Nobody mentions football once. It is exactly what was needed.' },
      { id: 'nothing', label: 'Say nothing and keep going', hint: 'Free.', effects: { morale: -2 }, outcome: 'You keep your head down. So does everybody else.' },
    ],
  },
];

/** Substitute the placeholders a definition may use. */
export function fillSundayEventText(
  text: string,
  vars: {
    name?: string; job?: string; rival?: string; club?: string;
    balance?: number; subsOwed?: number; squadSize?: number;
    apps?: number; weeks?: number; round?: string | null;
  },
): string {
  return text
    .replace(/\{name\}/g, vars.name ?? 'someone')
    .replace(/\{job\}/g, vars.job ?? 'a working man')
    .replace(/\{rival\}/g, vars.rival ?? 'the other lot')
    .replace(/\{club\}/g, vars.club ?? 'the club')
    .replace(/\{balance\}/g, String(Math.round(vars.balance ?? 0)))
    .replace(/\{subsOwed\}/g, String(Math.round(vars.subsOwed ?? 0)))
    .replace(/\{squadSize\}/g, String(vars.squadSize ?? 0))
    .replace(/\{apps\}/g, String(vars.apps ?? 0))
    .replace(/\{weeks\}/g, String(vars.weeks ?? 0))
    .replace(/\{round\}/g, vars.round ?? 'cup tie');
}
