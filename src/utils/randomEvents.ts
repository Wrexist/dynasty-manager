/**
 * Random mid-season events that add drama and immersion.
 * Called from advanceWeek() in orchestrationSlice.ts.
 *
 * Events are data: each template has a context weight and an `apply` that
 * writes into the result. There used to be six, so a long career saw the same
 * handful over and over; the content package added thirteen more in the same
 * effect bands (see the "content: more random event templates" block in
 * gameBalance.ts).
 */

import type { Player, Club, Message } from '@/types/game';
import { addMsg, shuffle } from '@/utils/helpers';
import {
  RANDOM_EVENT_BASE_CHANCE,
  BUSTUP_MORALE_HIT,
  INTL_FATIGUE_FITNESS_LOSS,
  FAN_RALLY_MORALE_BOOST,
  SPONSOR_BONUS_MULTIPLIER,
  MEDIA_SCRUTINY_CONFIDENCE_HIT,
  CHARITY_VISIT_MORALE_BOOST,
  SICKNESS_FITNESS_LOSS, SICKNESS_MAX_PLAYERS, SICKNESS_PEAK_WEEKS,
  MENTOR_YOUTH_FORM_BOOST, MENTOR_YOUTH_MORALE_BOOST, MENTOR_VETERAN_MORALE_BOOST,
  VIRAL_CLIP_MORALE_BOOST, VIRAL_CLIP_FORM_BOOST,
  AGENT_UNSETTLE_MORALE_HIT,
  BOARDROOM_PRAISE_CONFIDENCE_BOOST,
  SHIRT_SALES_BUDGET_MULTIPLIER,
  LATE_NIGHT_MORALE_HIT, LATE_NIGHT_CONFIDENCE_HIT,
  LEGEND_VISIT_MORALE_BOOST, LEGEND_VISIT_YOUTH_FORM_BOOST,
  HOMESICK_MORALE_HIT,
  RECOVERY_DAY_FITNESS_GAIN, RECOVERY_DAY_FITNESS_THRESHOLD,
  PLAYERS_MEETING_MORALE_BOOST,
  YOUTH_CALLUP_MORALE_BOOST,
} from '@/config/gameBalance';

interface RandomEventResult {
  messages: Message[];
  playerUpdates: Record<string, Partial<Player>>;
  clubUpdate: Partial<Club>;
  confidenceDelta: number;
}

/** What a template can see. */
export interface RandomEventContext {
  club: Club;
  squad: Player[];
  week: number;
  season: number;
  recentWins: number;
  recentLosses: number;
  boardConfidence: number;
}

interface RandomEventTemplate {
  id: string;
  /** Relative chance this week (0 = cannot happen). */
  weight: (ctx: RandomEventContext) => number;
  /** Writes the event into `result`. A template whose subject does not exist
   *  (no youngster, no recent signing…) writes nothing — a quiet week. */
  apply: (ctx: RandomEventContext, result: RandomEventResult) => void;
}

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;
const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clampMorale = (v: number) => Math.max(10, Math.min(100, v));
const say = (ctx: RandomEventContext, result: RandomEventResult, msg: Pick<Message, 'type' | 'title' | 'body'> & { playerId?: string }) => {
  result.messages = addMsg(result.messages, { week: ctx.week, season: ctx.season, ...msg });
};

/**
 * Every random event, in draw order. The first six are the originals, with
 * their original weights and effects, so their odds relative to one another
 * are unchanged.
 */
export const RANDOM_EVENT_TEMPLATES: RandomEventTemplate[] = [
  {
    id: 'bustup',
    weight: () => 8,
    apply: (ctx, result) => {
      // Two random players clash — both lose morale
      const [p1, p2] = shuffle([...ctx.squad]);
      result.playerUpdates[p1.id] = { morale: Math.max(10, p1.morale - BUSTUP_MORALE_HIT) };
      result.playerUpdates[p2.id] = { morale: Math.max(10, p2.morale - BUSTUP_MORALE_HIT) };
      say(ctx, result, { type: 'general', title: 'Dressing Room Bust-Up', body: `${p1.lastName} and ${p2.lastName} had a heated argument in the dressing room. Both players are upset.` });
    },
  },
  {
    id: 'intl_fatigue',
    weight: () => 6,
    apply: (ctx, result) => {
      // A random player returns fatigued from international duty
      const eligible = ctx.squad.filter(p => p.overall >= 65 && !p.injured);
      if (eligible.length === 0) return;
      const p = randomOf(eligible);
      result.playerUpdates[p.id] = { fitness: Math.max(30, p.fitness - INTL_FATIGUE_FITNESS_LOSS) };
      say(ctx, result, { type: 'general', title: 'International Fatigue', body: `${fullName(p)} has returned from international duty looking tired. Fitness reduced.` });
    },
  },
  {
    id: 'fan_rally',
    weight: ctx => (ctx.recentWins >= 3 ? 18 : 8),
    apply: (ctx, result) => {
      // Fans rally behind the team — squad morale boost
      ctx.squad.forEach(p => { result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + FAN_RALLY_MORALE_BOOST) }; });
      say(ctx, result, { type: 'general', title: 'Fan Support Surge', body: 'The fans are fully behind the team! A wave of support has lifted spirits across the squad.' });
    },
  },
  {
    id: 'sponsor_bonus',
    weight: ctx => (ctx.boardConfidence > 60 ? 12 : 6),
    apply: (ctx, result) => {
      // One-time cash injection from a happy sponsor
      const bonus = Math.round(ctx.club.budget * SPONSOR_BONUS_MULTIPLIER);
      if (bonus <= 0) return;
      result.clubUpdate = { budget: ctx.club.budget + bonus };
      say(ctx, result, { type: 'sponsorship', title: 'Sponsor Bonus', body: `A sponsor is impressed with the club's performance and has contributed an additional £${(bonus / 1e6).toFixed(1)}M.` });
    },
  },
  {
    id: 'media_scrutiny',
    weight: ctx => (ctx.recentLosses >= 3 ? 15 : 4),
    apply: (ctx, result) => {
      // Media pile-on after poor results — board confidence hit
      result.confidenceDelta = -MEDIA_SCRUTINY_CONFIDENCE_HIT;
      say(ctx, result, { type: 'board', title: 'Media Scrutiny', body: 'The press is questioning the manager\'s decisions after recent poor results. The board is taking notice.' });
    },
  },
  {
    id: 'scout_tip',
    weight: () => 10,
    apply: (ctx, result) => {
      // Scouts report a promising development about a young player
      const youth = ctx.squad.filter(p => p.age <= 23 && p.potential - p.overall >= 5);
      if (youth.length === 0) return;
      const p = randomOf(youth);
      // Boost form as the "tip" — player is in great shape
      result.playerUpdates[p.id] = { form: Math.min(100, p.form + 10), morale: Math.min(100, p.morale + 5) };
      say(ctx, result, { type: 'development', title: 'Scout Report: Breakthrough', body: `Your scouts report that ${fullName(p)} is showing remarkable improvement in training. The youngster looks ready for first-team action.`, playerId: p.id });
    },
  },
  // ── content: added templates ──
  {
    id: 'charity_visit',
    weight: () => 7,
    apply: (ctx, result) => {
      ctx.squad.forEach(p => { result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + CHARITY_VISIT_MORALE_BOOST) }; });
      say(ctx, result, { type: 'general', title: 'Hospital Visit', body: 'The squad spent an afternoon at the local children\'s hospital. The players came back quieter, closer and with a renewed sense of who they play for.' });
    },
  },
  {
    id: 'sickness_bug',
    weight: ctx => (ctx.week >= SICKNESS_PEAK_WEEKS[0] && ctx.week <= SICKNESS_PEAK_WEEKS[1] ? 8 : 3),
    apply: (ctx, result) => {
      const healthy = ctx.squad.filter(p => !p.injured);
      if (healthy.length === 0) return;
      const victims = shuffle([...healthy]).slice(0, Math.min(SICKNESS_MAX_PLAYERS, 2 + Math.floor(Math.random() * 2)));
      for (const p of victims) result.playerUpdates[p.id] = { fitness: Math.max(30, p.fitness - SICKNESS_FITNESS_LOSS) };
      const names = victims.map(p => p.lastName).join(', ');
      say(ctx, result, { type: 'injury', title: 'Sickness Bug', body: `A stomach bug is going round the training ground. ${names} ${victims.length === 1 ? 'has' : 'have'} been laid low and will be short of fitness this week.` });
    },
  },
  {
    id: 'veteran_mentor',
    weight: () => 7,
    apply: (ctx, result) => {
      const veterans = ctx.squad.filter(p => p.age >= 30);
      const youngsters = ctx.squad.filter(p => p.age <= 21);
      if (veterans.length === 0 || youngsters.length === 0) return;
      const vet = randomOf(veterans);
      const kid = randomOf(youngsters);
      result.playerUpdates[kid.id] = { form: Math.min(100, kid.form + MENTOR_YOUTH_FORM_BOOST), morale: Math.min(100, kid.morale + MENTOR_YOUTH_MORALE_BOOST) };
      result.playerUpdates[vet.id] = { morale: Math.min(100, vet.morale + MENTOR_VETERAN_MORALE_BOOST) };
      say(ctx, result, { type: 'development', title: 'Mentor and Protégé', body: `${fullName(vet)} has taken ${fullName(kid)} under his wing, staying behind after training to work with him. The youngster is flourishing.`, playerId: kid.id });
    },
  },
  {
    id: 'viral_training_clip',
    weight: () => 6,
    apply: (ctx, result) => {
      const eligible = ctx.squad.filter(p => p.overall >= 60 && !p.injured);
      if (eligible.length === 0) return;
      const p = randomOf(eligible);
      result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + VIRAL_CLIP_MORALE_BOOST), form: Math.min(100, p.form + VIRAL_CLIP_FORM_BOOST) };
      say(ctx, result, { type: 'general', title: 'Training Clip Goes Viral', body: `A clip of ${fullName(p)} scoring an outrageous goal in training has millions of views. He is walking a little taller this week.`, playerId: p.id });
    },
  },
  {
    id: 'agent_unsettles',
    weight: ctx => (ctx.boardConfidence < 50 ? 7 : 4),
    apply: (ctx, result) => {
      const star = [...ctx.squad].sort((a, b) => b.overall - a.overall)[0];
      if (!star) return;
      result.playerUpdates[star.id] = { morale: clampMorale(star.morale - AGENT_UNSETTLE_MORALE_HIT) };
      say(ctx, result, { type: 'transfer', title: 'Agent Stirs the Pot', body: `${fullName(star)}'s agent told reporters his client "deserves a club that matches his ambition". The player has been quiet in training since.`, playerId: star.id });
    },
  },
  {
    id: 'boardroom_praise',
    weight: ctx => (ctx.recentWins >= 3 ? 12 : 3),
    apply: (ctx, result) => {
      result.confidenceDelta = BOARDROOM_PRAISE_CONFIDENCE_BOOST;
      say(ctx, result, { type: 'board', title: 'Chairman\'s Backing', body: 'The chairman used a local radio interview to praise the manager\'s work, calling it "exactly the direction this club needs".' });
    },
  },
  {
    id: 'shirt_sales_spike',
    weight: ctx => (ctx.recentWins >= 2 ? 8 : 4),
    apply: (ctx, result) => {
      const bonus = Math.round(ctx.club.budget * SHIRT_SALES_BUDGET_MULTIPLIER);
      if (bonus <= 0) return;
      result.clubUpdate = { budget: ctx.club.budget + bonus };
      say(ctx, result, { type: 'sponsorship', title: 'Shirt Sales Spike', body: `The club shop has sold out of home shirts twice this week. The commercial team reports an extra £${(bonus / 1e6).toFixed(1)}M.` });
    },
  },
  {
    id: 'late_night_fine',
    weight: () => 5,
    apply: (ctx, result) => {
      const p = randomOf(ctx.squad);
      result.playerUpdates[p.id] = { morale: clampMorale(p.morale - LATE_NIGHT_MORALE_HIT) };
      result.confidenceDelta = -LATE_NIGHT_CONFIDENCE_HIT;
      say(ctx, result, { type: 'general', title: 'Late Night Out', body: `${fullName(p)} was photographed leaving a nightclub at 3am two days before a match. He has been fined and is sulking about it.`, playerId: p.id });
    },
  },
  {
    id: 'legend_visit',
    weight: () => 5,
    apply: (ctx, result) => {
      ctx.squad.forEach(p => { result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + LEGEND_VISIT_MORALE_BOOST) }; });
      const youngsters = ctx.squad.filter(p => p.age <= 21);
      const kid = youngsters.length > 0 ? randomOf(youngsters) : null;
      if (kid) {
        result.playerUpdates[kid.id] = { ...result.playerUpdates[kid.id], form: Math.min(100, kid.form + LEGEND_VISIT_YOUTH_FORM_BOOST) };
      }
      const kidLine = kid ? ` He singled out ${fullName(kid)} for extra advice after the session.` : '';
      say(ctx, result, { type: 'general', title: 'A Legend Drops By', body: `One of the club's all-time greats watched training this week and spoke to the squad.${kidLine}` });
    },
  },
  {
    id: 'homesick_signing',
    weight: ctx => (ctx.season > 1 && ctx.squad.some(p => p.joinedSeason === ctx.season && !p.isFromYouthAcademy) ? 6 : 0),
    apply: (ctx, result) => {
      // Season 1's whole starting squad carries joinedSeason 1, so the weight
      // above keeps this to seasons where "joined this season" means a signing.
      const recent = ctx.squad.filter(p => p.joinedSeason === ctx.season && !p.isFromYouthAcademy);
      if (recent.length === 0) return;
      const p = randomOf(recent);
      result.playerUpdates[p.id] = { morale: clampMorale(p.morale - HOMESICK_MORALE_HIT) };
      say(ctx, result, { type: 'general', title: 'Homesick', body: `${fullName(p)} is struggling to settle and has asked for time off to see his family. The staff are keeping an eye on him.`, playerId: p.id });
    },
  },
  {
    id: 'recovery_day',
    weight: () => 6,
    apply: (ctx, result) => {
      const tired = ctx.squad.filter(p => !p.injured && p.fitness < RECOVERY_DAY_FITNESS_THRESHOLD);
      if (tired.length === 0) return;
      for (const p of tired) result.playerUpdates[p.id] = { fitness: Math.min(100, p.fitness + RECOVERY_DAY_FITNESS_GAIN) };
      say(ctx, result, { type: 'development', title: 'Recovery Day', body: `The sports scientists swapped a session for ice baths and massage. ${tired.length} tired ${tired.length === 1 ? 'player feels' : 'players feel'} fresher already.` });
    },
  },
  {
    id: 'players_meeting',
    weight: ctx => (ctx.recentLosses >= 2 ? 10 : 2),
    apply: (ctx, result) => {
      const leader = [...ctx.squad].filter(p => p.age >= 27).sort((a, b) => b.overall - a.overall)[0] ?? ctx.squad[0];
      ctx.squad.forEach(p => { result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + PLAYERS_MEETING_MORALE_BOOST) }; });
      say(ctx, result, { type: 'general', title: 'Players-Only Meeting', body: `${fullName(leader)} called a players-only meeting after training. Whatever was said, the squad came out of it together.` });
    },
  },
  {
    id: 'youth_callup',
    weight: () => 5,
    apply: (ctx, result) => {
      const eligible = ctx.squad.filter(p => p.age <= 21 && p.overall >= 60 && !p.injured);
      if (eligible.length === 0) return;
      const p = randomOf(eligible);
      result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + YOUTH_CALLUP_MORALE_BOOST) };
      say(ctx, result, { type: 'national_team', title: 'Under-21 Call-Up', body: `${fullName(p)} has been named in the ${p.nationality} under-21 squad. Proud day for the youngster and the club.`, playerId: p.id });
    },
  },
];

/** The context a week's draw sees (exported for tests). */
export function buildRandomEventContext(
  club: Club,
  players: Record<string, Player>,
  week: number,
  season: number,
  recentResults: ('W' | 'D' | 'L')[],
  boardConfidence: number,
): RandomEventContext {
  return {
    club,
    squad: club.playerIds.map(id => players[id]).filter(Boolean),
    week,
    season,
    recentWins: recentResults.filter(r => r === 'W').length,
    recentLosses: recentResults.filter(r => r === 'L').length,
    boardConfidence,
  };
}

/** The weighted draw table for this week, in template order (exported for tests). */
export function randomEventWeights(ctx: RandomEventContext): { id: string; weight: number }[] {
  return RANDOM_EVENT_TEMPLATES.map(t => ({ id: t.id, weight: Math.max(0, t.weight(ctx)) }));
}

/**
 * Generate random events for the player's club during a given week.
 * Returns any player/club state changes and new messages.
 */
export function generateRandomEvents(
  club: Club,
  players: Record<string, Player>,
  messages: Message[],
  week: number,
  season: number,
  recentResults: ('W' | 'D' | 'L')[],
  boardConfidence: number,
): RandomEventResult {
  const result: RandomEventResult = {
    messages: [...messages],
    playerUpdates: {},
    clubUpdate: {},
    confidenceDelta: 0,
  };

  // Only trigger one event per week max, and only with base chance
  if (Math.random() > RANDOM_EVENT_BASE_CHANCE) return result;

  const ctx = buildRandomEventContext(club, players, week, season, recentResults, boardConfidence);
  if (ctx.squad.length < 2) return result;

  // Weight events by context — balanced so positive events are common enough to feel rewarding
  const events = randomEventWeights(ctx);
  const totalWeight = events.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = events[0].id;
  for (const e of events) {
    if (e.weight <= 0) continue;
    roll -= e.weight;
    if (roll <= 0) { selected = e.id; break; }
  }

  RANDOM_EVENT_TEMPLATES.find(t => t.id === selected)?.apply(ctx, result);
  return result;
}
