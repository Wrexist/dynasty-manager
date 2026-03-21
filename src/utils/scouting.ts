import { ScoutAssignment, ScoutReport, ScoutRegion, Position } from '@/types/game';
import { generatePlayer } from './playerGen';
import { pick } from './helpers';
import {
  REGION_WEEKS as CONFIG_REGION_WEEKS,
  REGION_QUALITY_RANGE as CONFIG_REGION_QUALITY_RANGE,
  PLAYERS_PER_ASSIGNMENT_MIN, PLAYERS_PER_ASSIGNMENT_RANGE,
  KNOWLEDGE_BASE, KNOWLEDGE_PER_QUALITY, KNOWLEDGE_RANDOM_RANGE, KNOWLEDGE_MAX,
  HIGH_KNOWLEDGE_THRESHOLD, HIGH_KNOWLEDGE_NOISE_RANGE,
  MEDIUM_KNOWLEDGE_THRESHOLD, MEDIUM_KNOWLEDGE_BUST_CHANCE, MEDIUM_KNOWLEDGE_BUST_RANGE, MEDIUM_KNOWLEDGE_NOISE_RANGE,
  LOW_KNOWLEDGE_BUST_CHANCE, LOW_KNOWLEDGE_BUST_RANGE, LOW_KNOWLEDGE_NOISE_RANGE,
  SIGN_POTENTIAL_THRESHOLD, SIGN_OVERALL_THRESHOLD, MONITOR_POTENTIAL_THRESHOLD,
} from '@/config/scouting';

const REGION_WEEKS = CONFIG_REGION_WEEKS;
const REGION_QUALITY_RANGE = CONFIG_REGION_QUALITY_RANGE;

export function createAssignment(region: ScoutRegion): ScoutAssignment {
  return {
    id: crypto.randomUUID(),
    region,
    weeksRemaining: REGION_WEEKS[region],
    totalWeeks: REGION_WEEKS[region],
  };
}

export function completeAssignment(
  assignment: ScoutAssignment,
  scoutQuality: number, // 0-10
  season: number,
  week: number,
): { reports: ScoutReport[]; players: ReturnType<typeof generatePlayer>[] } {
  const [minQ, maxQ] = REGION_QUALITY_RANGE[assignment.region];
  const numPlayers = PLAYERS_PER_ASSIGNMENT_MIN + Math.floor(Math.random() * PLAYERS_PER_ASSIGNMENT_RANGE); // 1-2 players

  const reports: ScoutReport[] = [];
  const newPlayers: ReturnType<typeof generatePlayer>[] = [];

  const positions: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

  for (let i = 0; i < numPlayers; i++) {
    const quality = minQ + Math.floor(Math.random() * (maxQ - minQ));
    const pos = pick(positions);
    const player = generatePlayer(pos, quality, '', season);

    // Knowledge level based on scout quality
    const knowledge = Math.min(KNOWLEDGE_MAX, KNOWLEDGE_BASE + scoutQuality * KNOWLEDGE_PER_QUALITY + Math.floor(Math.random() * KNOWLEDGE_RANDOM_RANGE));

    // Estimated overall with noise based on knowledge
    // Low-knowledge reports have 20% chance of significant overestimation (bust risk)
    let noise: number;
    if (knowledge >= HIGH_KNOWLEDGE_THRESHOLD) {
      noise = Math.floor(Math.random() * HIGH_KNOWLEDGE_NOISE_RANGE) - 1; // -1 to +1
    } else if (knowledge >= MEDIUM_KNOWLEDGE_THRESHOLD) {
      const isBust = Math.random() < MEDIUM_KNOWLEDGE_BUST_CHANCE; // 10% bust chance at medium knowledge
      noise = isBust ? MEDIUM_KNOWLEDGE_BUST_RANGE + Math.floor(Math.random() * MEDIUM_KNOWLEDGE_BUST_RANGE) : Math.floor(Math.random() * MEDIUM_KNOWLEDGE_NOISE_RANGE) - 3;
    } else {
      const isBust = Math.random() < LOW_KNOWLEDGE_BUST_CHANCE; // 20% bust chance at low knowledge
      noise = isBust ? MEDIUM_KNOWLEDGE_BUST_RANGE + Math.floor(Math.random() * LOW_KNOWLEDGE_BUST_RANGE) : Math.floor(Math.random() * LOW_KNOWLEDGE_NOISE_RANGE) - 6;
    }
    const estimatedOverall = Math.max(30, Math.min(99, player.overall + noise));

    // Recommendation
    const rec = player.potential >= SIGN_POTENTIAL_THRESHOLD || player.overall >= SIGN_OVERALL_THRESHOLD ? 'sign'
      : player.potential >= MONITOR_POTENTIAL_THRESHOLD ? 'monitor'
      : 'avoid';

    reports.push({
      id: crypto.randomUUID(),
      playerId: player.id,
      knowledgeLevel: knowledge,
      estimatedOverall,
      recommendation: rec,
      week,
      season,
    });

    newPlayers.push(player);
  }

  return { reports, players: newPlayers };
}
