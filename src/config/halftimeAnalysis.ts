/**
 * Halftime Tactical Analysis
 * Analyzes first-half stats and provides situational tactical presets.
 */

import type { HalfState } from '@/engine/match';
import type { KeyMomentChoice } from '@/types/game';

export type HalftimeSituation =
  | 'winning_comfortably'
  | 'winning_narrowly'
  | 'drawing_dominant'
  | 'drawing_under_pressure'
  | 'losing_narrowly'
  | 'losing_badly'
  | 'neutral';

export interface HalftimeAnalysis {
  situation: HalftimeSituation;
  headline: string;
  description: string;
  choices: KeyMomentChoice[];
}

const SITUATION_DATA: Record<HalftimeSituation, { headline: string; description: string; choices: KeyMomentChoice[] }> = {
  winning_comfortably: {
    headline: 'In Control',
    description: 'You\'re well ahead and dominating. Consider managing the game to protect your lead, or keep the pressure on to kill off the contest.',
    choices: [
      {
        label: 'Manage the Game',
        description: 'Slow things down and protect your lead',
        icon: 'Shield',
        tactics: { mentality: 'cautious', tempo: 'slow', defensiveLine: 'deep' },
      },
      {
        label: 'Keep Attacking',
        description: 'Don\'t take your foot off the gas',
        icon: 'Flame',
      },
      {
        label: 'Rest Key Players',
        description: 'Rotate to preserve fitness for upcoming matches',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
  winning_narrowly: {
    headline: 'Slim Lead',
    description: 'You\'re ahead by a single goal. The second half will be tense — do you protect what you have or push for a cushion?',
    choices: [
      {
        label: 'Protect the Lead',
        description: 'Tighten up and see it through',
        icon: 'Shield',
        tactics: { mentality: 'cautious', defensiveLine: 'deep', pressingIntensity: 25 },
      },
      {
        label: 'Extend the Lead',
        description: 'Attack early in the second half to kill the game',
        icon: 'Flame',
        tactics: { mentality: 'attacking', tempo: 'fast' },
      },
      {
        label: 'Fresh Energy',
        description: 'Bring on fresh legs to maintain intensity',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
  drawing_dominant: {
    headline: 'Knocking on the Door',
    description: 'You\'ve dominated possession and chances but can\'t find the breakthrough. A tactical tweak could unlock their defence.',
    choices: [
      {
        label: 'Go Direct',
        description: 'More shots, less build-up — be clinical',
        icon: 'Zap',
        tactics: { mentality: 'attacking', tempo: 'fast', width: 'wide' },
      },
      {
        label: 'Change Shape',
        description: 'Switch formation to create different angles',
        icon: 'Layers',
        suggestFormation: '4-3-3',
        tactics: { mentality: 'attacking' },
      },
      {
        label: 'Stay Patient',
        description: 'Keep probing — the goal will come',
        icon: 'Shield',
      },
    ],
  },
  drawing_under_pressure: {
    headline: 'Under Pressure',
    description: 'They\'ve had the better chances and you\'ve been on the back foot. You need to either shore up or fight fire with fire.',
    choices: [
      {
        label: 'Shore Up',
        description: 'Tighten the defence and hit on the counter',
        icon: 'ShieldCheck',
        tactics: { mentality: 'defensive', defensiveLine: 'deep', width: 'narrow' },
      },
      {
        label: 'Fight Fire with Fire',
        description: 'Attack to take pressure off your defence',
        icon: 'Flame',
        tactics: { mentality: 'attacking', tempo: 'fast', pressingIntensity: 75 },
      },
      {
        label: 'Change Personnel',
        description: 'Fresh faces to change the momentum',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
  losing_narrowly: {
    headline: 'One Goal Behind',
    description: 'You\'re trailing but it\'s within reach. An attacking change could get you back in the game — but leave gaps at the back.',
    choices: [
      {
        label: 'Push Forward',
        description: 'Increase tempo and press higher up the pitch',
        icon: 'Flame',
        tactics: { mentality: 'attacking', tempo: 'fast', defensiveLine: 'high' },
      },
      {
        label: 'Change Shape',
        description: 'Switch to an attacking formation',
        icon: 'Layers',
        suggestFormation: '3-4-3',
        tactics: { mentality: 'all-out-attack' },
      },
      {
        label: 'Fresh Legs',
        description: 'Bring on impact substitutes',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
  losing_badly: {
    headline: 'Damage Limitation',
    description: 'It\'s been a tough first half. You need a drastic change to get back into this — or cut your losses and regroup.',
    choices: [
      {
        label: 'All-Out Attack',
        description: 'Throw everything forward — nothing to lose',
        icon: 'Flame',
        tactics: { mentality: 'all-out-attack', tempo: 'fast', defensiveLine: 'high', width: 'wide' },
      },
      {
        label: 'Reorganise',
        description: 'Reset to a balanced setup and rebuild',
        icon: 'Shield',
        tactics: { mentality: 'balanced', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
      },
      {
        label: 'Shake It Up',
        description: 'Make substitutions to change the energy',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
  neutral: {
    headline: 'Evenly Matched',
    description: 'It\'s been a tight contest with little to separate the sides. A small tactical edge could be the difference in the second half.',
    choices: [
      {
        label: 'Go for It',
        description: 'Increase the tempo and look for a winner',
        icon: 'Flame',
        tactics: { mentality: 'attacking', tempo: 'fast' },
      },
      {
        label: 'Stay Disciplined',
        description: 'Keep your shape and wait for mistakes',
        icon: 'Shield',
        tactics: { mentality: 'balanced', pressingIntensity: 50 },
      },
      {
        label: 'Tactical Tweak',
        description: 'Make a substitution to find an edge',
        icon: 'RefreshCw',
        openSubSheet: true,
      },
    ],
  },
};

/**
 * Analyze first-half performance and return situational tactical advice.
 */
export function analyzeHalftime(
  state: HalfState,
  playerClubId: string,
  matchHomeClubId: string,
): HalftimeAnalysis {
  const isHome = playerClubId === matchHomeClubId;
  const pGoals = isHome ? state.homeGoals : state.awayGoals;
  const oGoals = isHome ? state.awayGoals : state.homeGoals;
  const pShots = isHome ? state.homeShots : state.awayShots;
  const oShots = isHome ? state.awayShots : state.homeShots;
  const pXG = isHome ? state.homeXG : state.awayXG;
  const oXG = isHome ? state.awayXG : state.homeXG;

  let situation: HalftimeSituation;

  if (pGoals >= oGoals + 2) {
    situation = 'winning_comfortably';
  } else if (pGoals === oGoals + 1) {
    situation = 'winning_narrowly';
  } else if (pGoals === oGoals) {
    if (pShots > oShots || pXG > oXG + 0.1) {
      situation = 'drawing_dominant';
    } else if (oShots > pShots || oXG > pXG + 0.1) {
      situation = 'drawing_under_pressure';
    } else {
      situation = 'neutral';
    }
  } else if (oGoals === pGoals + 1) {
    situation = 'losing_narrowly';
  } else {
    situation = 'losing_badly';
  }

  const data = SITUATION_DATA[situation];
  return {
    situation,
    headline: data.headline,
    description: data.description,
    choices: data.choices,
  };
}
