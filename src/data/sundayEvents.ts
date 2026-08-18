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
import type { SundayEventInstance } from '@/types/game';

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
  /** The captain's squad record, when one is appointed. */
  captain: SundayEventPerson | null;
  /** A squad member the event can be about — pre-picked by the selector so
   *  definitions never have to reach into the squad themselves. */
  subject: SundayEventPerson | null;
  /** An unhappy squad member, when there is one. */
  unhappy: SundayEventPerson | null;
  /** Chain flags currently set: name → week set. See `SundayState.flags`. */
  flags: Record<string, number>;
  /** The player a live chain flag points at, when one does. Chain steps use
   *  this instead of the random `subject` so a story stays about ONE person. */
  flagged: SundayEventPerson | null;
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
  /** Set / clear a chain flag. `{subject}` in the name is replaced with the
   *  event's subject id, which is how a chain stays about one player. */
  setFlag?: string;
  clearFlag?: string;
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

export const SUNDAY_EVENTS: readonly SundayEventDef[] = [
  // ── Player events ─────────────────────────────────────────────────────────
  {
    id: 'captain-furious',
    category: 'player',
    title: 'The captain is not having it',
    body: '{name} has pulled you aside. He knows he was only on the bench last week, he knows he is carrying a knock, and he wants you to know that he has played through worse than this and that the lads notice these things.',
    weight: 8,
    needsSubject: true,
    condition: ctx => !!ctx.captain && ctx.captain.benchedStreak >= 1,
    choices: [
      {
        id: 'start', label: 'Tell him he starts', hint: 'A real promise. Break it and he will know.',
        effects: { subjectHappiness: 8, morale: -2, squadHappiness: -2, promiseStart: true },
        outcome: 'He gets his way, and everyone within earshot knows it.',
      },
      {
        id: 'bench', label: 'He is on the bench', hint: 'Hold the line. He will sulk.',
        effects: { subjectHappiness: -14, morale: 2 },
        outcome: 'He takes it badly and says almost nothing all afternoon. The rest of them respect it.',
      },
      {
        id: 'explain', label: 'Explain the decision properly', hint: 'Depends on how reasonable he is.',
        successChance: ctx => 0.35 + (ctx.captain ? (20 - ctx.captain.ego) * 0.03 : 0),
        effects: { subjectHappiness: 5, morale: 3 },
        outcome: 'He does not like it, but he gets it. He is first on the touchline when it kicks off.',
        failEffects: { subjectHappiness: -10, morale: -3 },
        failOutcome: 'He listens to about nine words of it and walks off mid-sentence.',
      },
    ],
  },
  {
    id: 'play-me',
    category: 'player',
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
    title: 'Nobody has the kit',
    body: '{name} took the kit home to wash it three weeks ago. {name} is not answering his phone. Kick-off is in forty minutes and eleven men are standing in a car park in various shades of grey.',
    weight: 9,
    needsSubject: true,
    condition: ctx => ctx.availableCount >= 7,
    choices: [
      {
        id: 'buy', label: 'Emergency bibs from the leisure centre (£25)', hint: 'Solves it. Looks ridiculous.',
        available: ctx => ctx.balance >= 25,
        effects: { money: -25, morale: -1 },
        outcome: 'You play in bibs. The opposition find this extremely funny for the full ninety.',
      },
      {
        id: 'borrow', label: 'Ask the other lot to lend you theirs', hint: 'Free, if they are decent about it.',
        successChance: ctx => 0.5 + ctx.reputation * 0.004,
        effects: { reputation: 1, morale: 1 },
        outcome: 'They have a spare set in the van. Genuinely nice people. You buy them a drink after.',
        failEffects: { morale: -4, reputation: -1 },
        failOutcome: 'They enjoy saying no far too much. You play in whatever you arrived in.',
      },
      {
        id: 'fine', label: 'Fine him and play in what you have', hint: 'Recovers £15. He will not forget.',
        effects: { money: 15, subjectHappiness: -12, morale: -2 },
        outcome: 'He pays up eventually and mentions it every week until Christmas.',
      },
    ],
  },
  {
    id: 'keeper-hungover',
    category: 'matchday',
    title: 'The goalkeeper is in no state',
    body: '{name} has arrived. {name} is upright. Beyond that there is very little good news, and he has just asked what time it is twice.',
    weight: 7,
    needsSubject: true,
    condition: ctx => ctx.availableCount >= 8,
    cooldown: 8,
    choices: [
      {
        id: 'play', label: 'Stick him in goal anyway', hint: 'He might be fine. He might not.',
        successChance: () => 0.4,
        effects: { morale: 2 },
        outcome: 'He makes two outstanding saves and remembers none of it.',
        failEffects: { morale: -5, subjectHappiness: -4 },
        failOutcome: 'He is beaten at his near post twice and apologises to everybody individually.',
      },
      {
        id: 'outfield', label: 'Someone else goes in goal', hint: 'Safe, and nobody wants to.',
        effects: { subjectHappiness: -6, morale: -1 },
        outcome: 'A centre-half volunteers with the air of a man being sent over the top.',
      },
      {
        id: 'coffee', label: 'Buy him a coffee and a bacon roll (£8)', hint: 'Might just work.',
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
    id: 'better-offer',
    category: 'player',
    title: 'Somebody else wants {name}',
    body: 'A team two divisions up have been in touch with {name}. They train. They have a proper pitch. They have, he mentions, a physio.',
    weight: 8,
    needsSubject: true,
    condition: ctx => !!ctx.subject && ctx.subject.overall >= 44,
    choices: [
      {
        id: 'match', label: 'Tell him what he means to this club', hint: 'Words are free.',
        successChance: ctx => 0.35 + (ctx.subject ? ctx.subject.commitment * 0.025 : 0) + ctx.teamMorale * 0.003,
        effects: { subjectHappiness: 10 },
        outcome: 'He stays. He says he would rather play with his mates, and he means it.',
        failEffects: { subjectLeaves: true, morale: -6 },
        failOutcome: 'He is gone. He was polite about it, which somehow makes it worse.',
      },
      {
        id: 'pay', label: 'Cover his subs for the season (£40)', hint: 'Crude, but it works on some.',
        available: ctx => ctx.balance >= 40,
        successChance: ctx => 0.55 + (ctx.subject ? ctx.subject.commitment * 0.015 : 0),
        effects: { money: -40, subjectHappiness: 8 },
        outcome: 'He takes the deal and shakes on it. Do not tell the others.',
        failEffects: { money: -40, subjectLeaves: true, morale: -6 },
        failOutcome: 'He takes the money for this week and leaves anyway. Outstanding.',
      },
      {
        id: 'let-go', label: 'Wish him well', hint: 'He goes. The squad notices you did not fight.',
        effects: { subjectLeaves: true, morale: -3, reputation: 1 },
        outcome: 'He leaves on good terms. He says he will come back for the cup games. He will not.',
      },
    ],
  },
  {
    id: 'warm-up-injury',
    category: 'player',
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
    title: '{name} has resurfaced',
    body: '{name} has appeared in the group chat after several weeks of total silence, with no explanation and a thumbs up emoji.',
    weight: 6,
    needsSubject: true,
    condition: ctx => !!ctx.subject && ctx.subject.commitment <= 8,
    choices: [
      { id: 'welcome', label: 'Welcome him back', hint: 'No questions asked.', effects: { subjectHappiness: 8, subjectCommitment: 1 }, outcome: 'He is back, briefly, and scores. Obviously.' },
      { id: 'question', label: 'Ask where he has been', hint: 'Everyone wants to know.', successChance: () => 0.5, effects: { subjectCommitment: 2, morale: 2 }, outcome: 'The explanation is so mundane that everyone forgives him instantly.', failEffects: { subjectHappiness: -8 }, failOutcome: 'He goes quiet again. That is probably that.' },
    ],
  },

  // ── Money ─────────────────────────────────────────────────────────────────
  {
    id: 'subs-crisis',
    category: 'money',
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
    title: 'There is nothing in the account',
    body: 'The balance is £{balance}. The referee wants paying in cash on Sunday, and he does not take excuses.',
    weight: 12,
    condition: ctx => ctx.balance < 40,
    cooldown: 5,
    choices: [
      {
        id: 'raffle', label: 'Run a raffle', hint: 'Raises something. Everyone has to sell tickets.',
        effects: { money: 90, morale: -4 },
        outcome: 'Ninety pounds and a bottle of whisky nobody wanted. It will do.',
      },
      {
        id: 'own-pocket', label: 'Put your hand in your own pocket', hint: 'Instant. Yours.',
        effects: { money: 60, morale: 4, reputation: 1 },
        outcome: 'You cover it. Two of them find out and insist on buying the drinks after.',
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
    title: 'A bill you were not expecting',
    body: 'The council have written about "pitch reinstatement" following an incident in November that everyone had agreed not to mention again.',
    weight: 5,
    condition: ctx => ctx.week > 6,
    cooldown: 15,
    choices: [
      { id: 'pay', label: 'Pay it (£70)', hint: 'Done and dusted.', available: ctx => ctx.balance >= 70, effects: { money: -70 }, outcome: 'Paid. Filed. Never spoken of again.' },
      { id: 'dispute', label: 'Dispute it', hint: 'Might work. Might make it worse.', successChance: () => 0.45, effects: {}, outcome: 'They drop it entirely. Nobody knows why.', failEffects: { money: -100 }, failOutcome: 'They add an administration charge. It is now £100.' },
    ],
  },

  // ── Club ──────────────────────────────────────────────────────────────────
  {
    id: 'pitch-unplayable',
    category: 'club',
    title: 'The pitch is under water',
    body: 'There is standing water across most of the pitch and a man from the council is standing in the middle of it, shaking his head.',
    weight: 6,
    condition: ctx => ctx.week > 4,
    cooldown: 10,
    choices: [
      { id: 'play', label: 'Talk him into letting you play', hint: 'It will be a swamp.', successChance: () => 0.55, effects: { pitchDamage: 25 }, outcome: 'He relents. It is barely football, but it is a fixture off the list.', failEffects: { morale: -2 }, failOutcome: 'Called off. Everyone drove here for nothing.' },
      { id: 'forks', label: 'Everyone brings a fork and gets to work', hint: 'Free, filthy, oddly bonding.', effects: { pitchDamage: 12, morale: 5, squadHappiness: 2 }, outcome: 'Two hours of forking the surface. It plays. Everyone is caked in mud before kick-off.' },
    ],
  },
  {
    id: 'trophy-night',
    category: 'club',
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
    title: '{rival} have been talking',
    body: 'Word has got back from the pub. Their manager has been holding court about your team, at volume, to anyone who would listen.',
    weight: 8,
    condition: ctx => ctx.hasRival,
    cooldown: 8,
    choices: [
      { id: 'ignore', label: 'Rise above it', hint: 'Dignified. Dull.', effects: { morale: 1 }, outcome: 'You say nothing. It eats at two of your lads all week.' },
      { id: 'respond', label: 'Give it back', hint: 'Fires the squad up. Fires them up too.', effects: { morale: 6, rivalHeat: 2 }, outcome: 'The reply gets screenshotted and shared widely. It is on now.' },
      { id: 'bet', label: 'Bet him £50 on the next meeting', hint: 'High stakes for a Sunday.', effects: { rivalHeat: 3, morale: 4 }, outcome: 'The bet is on and everyone in both clubs knows about it by Tuesday.' },
    ],
  },
  {
    id: 'rival-poach',
    category: 'rivalry',
    title: '{rival} are circling {name}',
    body: 'Their manager has been seen talking to {name} outside the changing rooms. Twice.',
    weight: 7,
    needsSubject: true,
    condition: ctx => ctx.hasRival && !!ctx.subject && ctx.subject.happiness < 55,
    choices: [
      { id: 'confront', label: 'Confront their manager', hint: 'Satisfying. Escalates things.', effects: { rivalHeat: 2, morale: 3 }, outcome: 'It gets heated in a car park. Nothing is resolved and everyone enjoys it.' },
      { id: 'talk', label: 'Talk to {name} instead', hint: 'Deals with the actual problem.', successChance: ctx => 0.45 + (ctx.subject ? ctx.subject.commitment * 0.02 : 0), effects: { subjectHappiness: 12 }, outcome: 'He tells you exactly what was said, and that he told them where to go.' , failEffects: { subjectHappiness: -6 }, failOutcome: 'He is non-committal, which tells you everything.' },
      { id: 'poach-back', label: 'Go after one of theirs', hint: 'An eye for an eye.', effects: { rivalHeat: 3, spawnRecruit: 'poached' }, outcome: 'You make a call of your own. Somebody from their squad is suddenly very interested.' },
    ],
  },

  {
    id: 'rival-sniffing',
    category: 'rivalry',
    title: '{rival} are sniffing around {name}',
    body: '{name} has been quiet lately, and now their manager has been seen buying him a pint. Twice. He has not mentioned it, which is somehow worse.',
    weight: 8,
    needsSubject: true,
    condition: ctx => ctx.hasRival && ctx.rivalHeat >= 4 && !!ctx.subject && ctx.subject.happiness < 55
      && !Object.keys(ctx.flags).some(f => f.startsWith('wants-out:')),
    cooldown: 12,
    choices: [
      {
        id: 'talk', label: 'Sit him down and talk it through', hint: 'Depends on what is left between you.',
        successChance: ctx => 0.4 + (ctx.subject ? ctx.subject.happiness * 0.005 : 0),
        effects: { subjectHappiness: 10 },
        outcome: 'He lays it all out — playing time, the drive, the pitch. You listen. It helps.',
        failEffects: { setFlag: 'wants-out:{subject}', subjectHappiness: -4 },
        failOutcome: 'He says the right words in the wrong tone. This is not finished.',
      },
      {
        id: 'confront-rival', label: 'Confront their manager about it', hint: 'Feels great. Fixes nothing.',
        effects: { rivalHeat: 2, morale: 2, setFlag: 'wants-out:{subject}' },
        outcome: 'A frank exchange of views in a car park. Their manager loved every second of it.',
      },
      {
        id: 'ignore', label: 'Pretend you have not noticed', hint: 'Maybe it blows over.',
        effects: { setFlag: 'wants-out:{subject}' },
        outcome: 'You say nothing. He notices that too.',
      },
    ],
  },
  {
    id: 'rival-bid',
    category: 'rivalry',
    title: 'They have actually asked for {name}',
    body: 'It is out in the open now: {rival} want {name}, {name} knows it, and the whole changing room is watching how you handle it.',
    weight: 20,
    needsSubject: true,
    condition: ctx => ctx.hasRival && !!ctx.flagged,
    cooldown: 6,
    choices: [
      {
        id: 'fight', label: 'Fight for him', hint: 'A speech, his subs covered, first name on the sheet.',
        available: ctx => ctx.balance >= 30,
        successChance: ctx => 0.35 + (ctx.flagged ? ctx.flagged.commitment * 0.03 : 0),
        effects: { money: -30, subjectHappiness: 16, clearFlag: 'wants-out:{subject}', morale: 3 },
        outcome: 'He stays. The speech gets retold for weeks, improving each time.',
        failEffects: { money: -30, subjectLeavesForRival: true },
        failOutcome: 'He hears you out, shakes your hand, and signs for them on Tuesday.',
      },
      {
        id: 'promise', label: 'Promise him a start every week he turns up', hint: 'A real promise. The game holds you to it.',
        effects: { promiseStart: true, subjectHappiness: 8, clearFlag: 'wants-out:{subject}' },
        outcome: 'That was all he wanted to hear. Now you have to mean it.',
      },
      {
        id: 'release', label: 'Let him go to them', hint: 'The feud gets a face.',
        effects: { subjectLeavesForRival: true },
        outcome: 'Done. He will be in their colours on Sunday, and everyone knows what that fixture becomes now.',
      },
    ],
  },

  // ── Sponsor ───────────────────────────────────────────────────────────────
  {
    id: 'sponsor-unhappy',
    category: 'sponsor',
    title: 'Your sponsor has been in touch',
    body: 'They have seen the results. They were, they say, expecting rather more for their money.',
    weight: 6,
    condition: ctx => ctx.hasSponsor && ctx.winless >= 3,
    cooldown: 10,
    choices: [
      { id: 'promise', label: 'Promise them a turnaround', hint: 'Buys time.', effects: { reputation: -1 }, outcome: 'They give you until the end of the season. They will be checking.' },
      { id: 'invite', label: 'Invite them to a match and the pub after', hint: 'Costs a round.', available: ctx => ctx.balance >= 30, effects: { money: -30, reputation: 2 }, outcome: 'They have a great time and stop reading the results table.' },
      { id: 'honest', label: 'Tell them it is a Sunday league team', hint: 'Bold.', successChance: () => 0.5, effects: { reputation: 2, morale: 3 }, outcome: 'They laugh, agree entirely, and double down on the sponsorship.', failEffects: { reputation: -3 }, failOutcome: 'They do not laugh. The renewal is not looking likely.' },
    ],
  },

  // ── Comedy ────────────────────────────────────────────────────────────────
  {
    id: 'wrong-boots',
    category: 'comedy',
    title: 'The wrong boots',
    body: '{name}, a {job}, has arrived at a frozen pitch with a pair of moulded studs he bought in 2014 and an expression of total confidence.',
    weight: 5,
    needsSubject: true,
    condition: () => true,
    cooldown: 12,
    choices: ack(
      'He spends the first half on his backside and the second half in someone else’s trainers.',
      { morale: 2, subjectHappiness: -2 },
    ),
  },
  {
    id: 'ref-decision',
    category: 'comedy',
    title: 'The referee has made a decision',
    body: 'A goal has been disallowed for a reason the referee has declined to share with anyone, including his own linesman, who is a substitute from the other team.',
    weight: 5,
    condition: ctx => ctx.lastResult !== null,
    cooldown: 9,
    choices: [
      { id: 'complain', label: 'Complain to the league', hint: 'Nothing will come of it.', effects: { morale: 2, reputation: -1 }, outcome: 'The league acknowledge receipt of your email. That is the end of the matter.' },
      { id: 'let-it-go', label: 'Let it go', hint: 'Healthy.', effects: { morale: -1 }, outcome: 'You let it go. You do not let it go.' },
    ],
  },
  {
    id: 'social-media',
    category: 'comedy',
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
    title: 'Somebody has asked for a game',
    body: 'A bloke watching from the touchline has asked, fairly directly, whether you need anyone.',
    weight: 9,
    condition: ctx => ctx.squadSize < 20,
    cooldown: 4,
    choices: [
      { id: 'look', label: 'Tell him to come to training', hint: 'You will see him properly first.', effects: { spawnRecruit: 'trial' }, outcome: 'He turns up, and you get a proper look at him before deciding.' },
      { id: 'straight-in', label: 'Sign him on the spot', hint: 'No idea what you are getting.', effects: { spawnRecruit: 'walk-up' }, outcome: 'He is registered before anyone has seen him kick a ball.' },
      { id: 'pass', label: 'Not right now', hint: 'You have enough people.', effects: {}, declines: true, outcome: 'He nods and wanders off. You will wonder about that in three weeks.' },
    ],
  },
  {
    id: 'thin-squad',
    category: 'club',
    title: 'You are running out of players',
    body: 'There are {squadSize} names on the sheet and at least three of them have not been seen since September.',
    weight: 14,
    condition: ctx => ctx.squadSize <= 12,
    cooldown: 4,
    choices: [
      { id: 'ring', label: 'Get on the phone to everyone you know', hint: 'Produces someone. Usually.', effects: { spawnRecruit: 'mate', morale: -1 }, outcome: 'Two hours of calls turns up exactly one interested human being.' },
      { id: 'work', label: 'Ask at work', hint: 'Slower, but he will turn up.', effects: { spawnRecruit: 'work' }, outcome: 'Somebody from the depot says he used to play a bit.' },
    ],
  },
  {
    id: 'winning-run',
    category: 'club',
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
  vars: { name?: string; job?: string; rival?: string; club?: string; balance?: number; subsOwed?: number; squadSize?: number },
): string {
  return text
    .replace(/\{name\}/g, vars.name ?? 'someone')
    .replace(/\{job\}/g, vars.job ?? 'a working man')
    .replace(/\{rival\}/g, vars.rival ?? 'the other lot')
    .replace(/\{club\}/g, vars.club ?? 'the club')
    .replace(/\{balance\}/g, String(Math.round(vars.balance ?? 0)))
    .replace(/\{subsOwed\}/g, String(Math.round(vars.subsOwed ?? 0)))
    .replace(/\{squadSize\}/g, String(vars.squadSize ?? 0));
}
