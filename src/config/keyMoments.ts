/**
 * Key Moment Branching Choices
 * Pre-defined tactical packages for each key moment type during live matches.
 */

import type { KeyMomentChoice } from '@/types/game';

export const KEY_MOMENT_CHOICES: Record<string, KeyMomentChoice[]> = {
  goal_conceded: [
    {
      label: 'Go Aggressive',
      description: 'Push forward to get back in the game',
      icon: 'Flame',
      tactics: { mentality: 'attacking', tempo: 'fast' },
    },
    {
      label: 'Stay Composed',
      description: 'Keep your shape and stick to the plan',
      icon: 'Shield',
      tactics: { mentality: 'balanced', tempo: 'normal' },
    },
    {
      label: 'Shore Up',
      description: 'Tighten up at the back to prevent further damage',
      icon: 'ShieldCheck',
      tactics: { mentality: 'cautious', defensiveLine: 'deep' },
    },
  ],
  red_card: [
    {
      label: 'Park the Bus',
      description: 'Drop deep and protect what you have',
      icon: 'Shield',
      tactics: { mentality: 'defensive', defensiveLine: 'deep', pressingIntensity: 25 },
    },
    {
      label: 'Stay Brave',
      description: 'Keep your current setup and play on',
      icon: 'Zap',
      tactics: { mentality: 'balanced' },
    },
    {
      label: 'Reduce Pressure',
      description: 'Drop pressing intensity to avoid more cards',
      icon: 'AlertTriangle',
      tactics: { pressingIntensity: 25, tempo: 'slow' },
    },
  ],
  losing_late: [
    {
      label: 'All-Out Attack',
      description: 'Throw everything forward — now or never',
      icon: 'Flame',
      tactics: { mentality: 'all-out-attack', tempo: 'fast', defensiveLine: 'high', pressingIntensity: 75 },
    },
    {
      label: 'Fresh Legs',
      description: 'Bring on substitutes to change the game',
      icon: 'RefreshCw',
      openSubSheet: true,
    },
    {
      label: 'Change Shape',
      description: 'Switch to an attacking formation',
      icon: 'Layers',
      suggestFormation: '3-4-3',
      tactics: { mentality: 'attacking' },
    },
  ],
  tight_finish: [
    {
      label: 'Go for the Win',
      description: 'Push for a late winner',
      icon: 'Flame',
      tactics: { mentality: 'attacking', tempo: 'fast' },
    },
    {
      label: 'Protect the Point',
      description: 'Secure the draw — a point is better than none',
      icon: 'Shield',
      tactics: { mentality: 'cautious', tempo: 'slow', defensiveLine: 'deep' },
    },
    {
      label: 'Roll the Dice',
      description: 'All-out attack — win big or lose trying',
      icon: 'Zap',
      tactics: { mentality: 'all-out-attack', tempo: 'fast', defensiveLine: 'high', width: 'wide' },
    },
  ],
  comeback: [
    {
      label: 'Keep Pushing',
      description: 'Momentum is with you — go for the equalizer',
      icon: 'Flame',
      tactics: { mentality: 'attacking', tempo: 'fast' },
    },
    {
      label: 'Stay Patient',
      description: 'Don\'t overcommit — wait for the right moment',
      icon: 'Shield',
      tactics: { mentality: 'balanced', tempo: 'normal' },
    },
  ],
  dominant_possession: [
    {
      label: 'Go Direct',
      description: 'More shots, less passing — be clinical',
      icon: 'Zap',
      tactics: { tempo: 'fast', width: 'wide' },
    },
    {
      label: 'Stay Patient',
      description: 'Keep probing — the goal will come',
      icon: 'Shield',
      tactics: { mentality: 'balanced', tempo: 'normal' },
    },
    {
      label: 'Change Shape',
      description: 'Try a different formation to unlock the defence',
      icon: 'Layers',
      suggestFormation: '4-3-3',
      tactics: { mentality: 'attacking' },
    },
  ],
  near_miss_flurry: [
    {
      label: 'Drop Deep',
      description: 'Absorb the pressure and hit on the counter',
      icon: 'Shield',
      tactics: { mentality: 'defensive', defensiveLine: 'deep', pressingIntensity: 25 },
    },
    {
      label: 'Hold Firm',
      description: 'Trust your defenders — stick with it',
      icon: 'ShieldCheck',
      tactics: { mentality: 'cautious', defensiveLine: 'normal' },
    },
    {
      label: 'Fight Fire with Fire',
      description: 'Push forward to take pressure off your defence',
      icon: 'Flame',
      tactics: { mentality: 'attacking', tempo: 'fast' },
    },
  ],
  injury: [
    {
      label: 'Make Substitution',
      description: 'Replace the injured player',
      icon: 'RefreshCw',
      openSubSheet: true,
    },
  ],
};
