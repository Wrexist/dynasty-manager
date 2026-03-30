/**
 * Random mid-season events that add drama and immersion.
 * Called from advanceWeek() in orchestrationSlice.ts.
 */

import type { Player, Club, Message } from '@/types/game';
import { addMsg } from '@/utils/helpers';
import {
  RANDOM_EVENT_BASE_CHANCE,
  BUSTUP_MORALE_HIT,
  INTL_FATIGUE_FITNESS_LOSS,
  FAN_RALLY_MORALE_BOOST,
  SPONSOR_BONUS_MULTIPLIER,
  MEDIA_SCRUTINY_CONFIDENCE_HIT,
} from '@/config/gameBalance';

interface RandomEventResult {
  messages: Message[];
  playerUpdates: Record<string, Partial<Player>>;
  clubUpdate: Partial<Club>;
  confidenceDelta: number;
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

  const squadPlayers = club.playerIds.map(id => players[id]).filter(Boolean);
  if (squadPlayers.length < 2) return result;

  // Weight events by context — balanced so positive events are common enough to feel rewarding
  const recentWins = recentResults.filter(r => r === 'W').length;
  const recentLosses = recentResults.filter(r => r === 'L').length;
  const events: { id: string; weight: number }[] = [
    { id: 'bustup', weight: 8 },
    { id: 'intl_fatigue', weight: 6 },
    { id: 'fan_rally', weight: recentWins >= 3 ? 18 : 8 },
    { id: 'sponsor_bonus', weight: boardConfidence > 60 ? 12 : 6 },
    { id: 'media_scrutiny', weight: recentLosses >= 3 ? 15 : 4 },
    { id: 'scout_tip', weight: 10 },
  ];

  const totalWeight = events.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = events[0].id;
  for (const e of events) {
    roll -= e.weight;
    if (roll <= 0) { selected = e.id; break; }
  }

  switch (selected) {
    case 'bustup': {
      // Two random players clash — both lose morale
      const shuffled = [...squadPlayers].sort(() => Math.random() - 0.5);
      const p1 = shuffled[0];
      const p2 = shuffled[1];
      result.playerUpdates[p1.id] = { morale: Math.max(10, p1.morale - BUSTUP_MORALE_HIT) };
      result.playerUpdates[p2.id] = { morale: Math.max(10, p2.morale - BUSTUP_MORALE_HIT) };
      result.messages = addMsg(result.messages, {
        week, season, type: 'general',
        title: 'Dressing Room Bust-Up',
        body: `${p1.lastName} and ${p2.lastName} had a heated argument in the dressing room. Both players are upset.`,
      });
      break;
    }

    case 'intl_fatigue': {
      // A random player returns fatigued from international duty
      const eligible = squadPlayers.filter(p => p.overall >= 65 && !p.injured);
      if (eligible.length === 0) break;
      const p = eligible[Math.floor(Math.random() * eligible.length)];
      result.playerUpdates[p.id] = { fitness: Math.max(30, p.fitness - INTL_FATIGUE_FITNESS_LOSS) };
      result.messages = addMsg(result.messages, {
        week, season, type: 'general',
        title: 'International Fatigue',
        body: `${p.firstName} ${p.lastName} has returned from international duty looking tired. Fitness reduced.`,
      });
      break;
    }

    case 'fan_rally': {
      // Fans rally behind the team — squad morale boost
      const boost = FAN_RALLY_MORALE_BOOST;
      squadPlayers.forEach(p => {
        result.playerUpdates[p.id] = { morale: Math.min(100, p.morale + boost) };
      });
      result.messages = addMsg(result.messages, {
        week, season, type: 'general',
        title: 'Fan Support Surge',
        body: `The fans are fully behind the team! A wave of support has lifted spirits across the squad.`,
      });
      break;
    }

    case 'sponsor_bonus': {
      // One-time cash injection from a happy sponsor
      const bonus = Math.round(club.budget * SPONSOR_BONUS_MULTIPLIER);
      if (bonus > 0) {
        result.clubUpdate = { budget: club.budget + bonus };
        result.messages = addMsg(result.messages, {
          week, season, type: 'sponsorship',
          title: 'Sponsor Bonus',
          body: `A sponsor is impressed with the club's performance and has contributed an additional £${(bonus / 1e6).toFixed(1)}M.`,
        });
      }
      break;
    }

    case 'media_scrutiny': {
      // Media pile-on after poor results — board confidence hit
      result.confidenceDelta = -MEDIA_SCRUTINY_CONFIDENCE_HIT;
      result.messages = addMsg(result.messages, {
        week, season, type: 'board',
        title: 'Media Scrutiny',
        body: `The press is questioning the manager's decisions after recent poor results. The board is taking notice.`,
      });
      break;
    }

    case 'scout_tip': {
      // Scouts report a promising development about a young player
      const youth = squadPlayers.filter(p => p.age <= 23 && p.potential - p.overall >= 5);
      if (youth.length === 0) break;
      const p = youth[Math.floor(Math.random() * youth.length)];
      // Boost form as the "tip" — player is in great shape
      result.playerUpdates[p.id] = { form: Math.min(100, p.form + 10), morale: Math.min(100, p.morale + 5) };
      result.messages = addMsg(result.messages, {
        week, season, type: 'development',
        title: 'Scout Report: Breakthrough',
        body: `Your scouts report that ${p.firstName} ${p.lastName} is showing remarkable improvement in training. The youngster looks ready for first-team action.`,
      });
      break;
    }
  }

  return result;
}
