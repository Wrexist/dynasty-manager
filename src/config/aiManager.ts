/**
 * AI Manager Configuration
 * Defines manager styles, tactical defaults, mid-match reactivity,
 * and opponent-aware counter-tactics for AI clubs.
 */
import { AIManagerStyle, AIManagerProfile, TacticalInstructions, FormationType } from '@/types/game';

// ── Style-to-Tactics Mappings ──

const AI_STYLE_TACTICS: Record<AIManagerStyle, TacticalInstructions> = {
  attacking: {
    mentality: 'attacking',
    width: 'wide',
    tempo: 'fast',
    defensiveLine: 'high',
    pressingIntensity: 70,
  },
  defensive: {
    mentality: 'defensive',
    width: 'narrow',
    tempo: 'slow',
    defensiveLine: 'deep',
    pressingIntensity: 30,
  },
  possession: {
    mentality: 'cautious',
    width: 'wide',
    tempo: 'slow',
    defensiveLine: 'normal',
    pressingIntensity: 55,
  },
  'counter-attack': {
    mentality: 'cautious',
    width: 'normal',
    tempo: 'fast',
    defensiveLine: 'deep',
    pressingIntensity: 40,
  },
  balanced: {
    mentality: 'balanced',
    width: 'normal',
    tempo: 'normal',
    defensiveLine: 'normal',
    pressingIntensity: 50,
  },
  direct: {
    mentality: 'attacking',
    width: 'normal',
    tempo: 'fast',
    defensiveLine: 'normal',
    pressingIntensity: 65,
  },
};

// ── AI Manager Name Pools ──

const AI_MANAGER_FIRST_NAMES = [
  'Roberto', 'Antonio', 'Marco', 'Hans', 'Jürgen', 'Patrick', 'Carlos', 'Sven',
  'Miguel', 'André', 'Thomas', 'Frank', 'Pep', 'Diego', 'Arsène', 'Rafa',
  'José', 'Luciano', 'Brendan', 'Graham', 'Steve', 'Mark', 'Paul', 'Nigel',
  'Gary', 'Keith', 'Russell', 'Ian', 'David', 'Chris', 'Neil', 'Michael',
  'Kevin', 'Brian', 'Alan', 'Terry', 'Phil', 'Wayne', 'Lee', 'James',
];

const AI_MANAGER_LAST_NAMES = [
  'Martínez', 'Conte', 'Allegri', 'Flick', 'Nagelsmann', 'Vieira', 'Queiroz', 'Eriksson',
  'Herrera', 'Villas-Boas', 'Tuchel', 'Lampard', 'Guardiola', 'Simeone', 'Wenger', 'Benítez',
  'Mourinho', 'Spalletti', 'Rodgers', 'Potter', 'Bruce', 'Hughes', 'Lambert', 'Pearson',
  'Monk', 'Millen', 'Slade', 'Holloway', 'Moyes', 'Hughton', 'Warnock', 'Appleton',
  'Nolan', 'Keane', 'Pardew', 'Connor', 'Coyle', 'Rooney', 'Clark', 'Cooper',
];

// ── Reactivity Thresholds ──

/** Minutes at which AI re-evaluates tactics based on scoreline */
export const AI_REACTIVITY_MINUTES = [60, 75] as const;

/** How much AI shifts mentality when losing */
const AI_LOSING_MENTALITY_SHIFT: Record<string, string> = {
  'defensive': 'cautious',
  'cautious': 'balanced',
  'balanced': 'attacking',
  'attacking': 'all-out-attack',
  'all-out-attack': 'all-out-attack',
};

/** How much AI shifts mentality when winning */
const AI_WINNING_MENTALITY_SHIFT: Record<string, string> = {
  'all-out-attack': 'attacking',
  'attacking': 'balanced',
  'balanced': 'cautious',
  'cautious': 'defensive',
  'defensive': 'defensive',
};

// ── Profile Generation ──

/** Deterministically pick from an array using a seed string */
function seededIndex(seed: string, len: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % len;
}

/** Pick a random float between min and max using a seed */
function seededFloat(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const norm = (Math.abs(hash) % 1000) / 1000;
  return min + norm * (max - min);
}

/**
 * Generate a deterministic AI manager profile for a club based on its ID and reputation.
 * Higher-reputation clubs tend toward more proactive styles; lower-reputation toward defensive/counter.
 */
export function generateAIManagerProfile(clubId: string, reputation: number): AIManagerProfile {
  // Bias style selection by reputation
  let stylePool: AIManagerStyle[];
  if (reputation >= 8) {
    stylePool = ['attacking', 'possession', 'direct', 'balanced', 'attacking', 'possession'];
  } else if (reputation >= 5) {
    stylePool = ['balanced', 'counter-attack', 'direct', 'possession', 'attacking', 'defensive'];
  } else {
    stylePool = ['defensive', 'counter-attack', 'balanced', 'direct', 'defensive', 'counter-attack'];
  }

  const style = stylePool[seededIndex(clubId + 'style', stylePool.length)];
  const firstName = AI_MANAGER_FIRST_NAMES[seededIndex(clubId + 'fn', AI_MANAGER_FIRST_NAMES.length)];
  const lastName = AI_MANAGER_LAST_NAMES[seededIndex(clubId + 'ln', AI_MANAGER_LAST_NAMES.length)];

  return {
    name: `${firstName} ${lastName}`,
    style,
    defaultTactics: { ...AI_STYLE_TACTICS[style] },
    transferAggression: seededFloat(clubId + 'ta', 0.2, 0.9),
    youthFocus: seededFloat(clubId + 'yf', 0.1, 0.8),
    adaptability: seededFloat(clubId + 'ad', 0.2, 0.9),
  };
}

/**
 * Get reactive tactics for an AI manager based on current scoreline and match minute.
 * Returns modified tactics if the AI should react, or the original tactics if no change.
 */
export function getAIReactiveTactics(
  profile: AIManagerProfile,
  isHome: boolean,
  homeGoals: number,
  awayGoals: number,
  minute: number,
): TacticalInstructions {
  const tactics = { ...profile.defaultTactics };
  const myGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;
  const goalDiff = myGoals - oppGoals;

  // Only react if adaptability is high enough and we're past the reactivity threshold
  if (minute < AI_REACTIVITY_MINUTES[0]) return tactics;

  // Scale reaction by adaptability (low adaptability = less change)
  const shouldReact = Math.random() < profile.adaptability;
  if (!shouldReact) return tactics;

  if (goalDiff <= -2) {
    // Losing badly: go all-out attack
    tactics.mentality = 'all-out-attack';
    tactics.tempo = 'fast';
    tactics.defensiveLine = 'high';
    tactics.pressingIntensity = Math.min(100, tactics.pressingIntensity + 25);
  } else if (goalDiff === -1) {
    // Losing by 1: push forward
    const shifted = AI_LOSING_MENTALITY_SHIFT[tactics.mentality];
    if (shifted) tactics.mentality = shifted as typeof tactics.mentality;
    tactics.pressingIntensity = Math.min(100, tactics.pressingIntensity + 15);
    if (minute >= AI_REACTIVITY_MINUTES[1]) {
      // Late in the game, more desperate
      tactics.mentality = 'all-out-attack';
      tactics.defensiveLine = 'high';
    }
  } else if (goalDiff === 1 && minute >= AI_REACTIVITY_MINUTES[1]) {
    // Winning by 1 in the last 15 mins: protect the lead
    const shifted = AI_WINNING_MENTALITY_SHIFT[tactics.mentality];
    if (shifted) tactics.mentality = shifted as typeof tactics.mentality;
    tactics.pressingIntensity = Math.max(20, tactics.pressingIntensity - 15);
    tactics.tempo = 'slow';
  } else if (goalDiff >= 2) {
    // Winning comfortably: slow things down
    tactics.mentality = 'cautious';
    tactics.tempo = 'slow';
    tactics.pressingIntensity = Math.max(20, tactics.pressingIntensity - 20);
  }

  return tactics;
}

/**
 * Generate pre-match counter-tactics based on opponent's setup.
 * AI reads the opponent's formation and tactical instructions, then adjusts
 * 1-3 parameters to exploit weaknesses (rock-paper-scissors countering).
 * @param counterReduction 0-1 factor to reduce counter effectiveness (e.g. Counter-Master perk)
 */
export function getAICounterTactics(
  profile: AIManagerProfile,
  opponentTactics: TacticalInstructions,
  _opponentFormation: FormationType,
  counterReduction = 0,
): TacticalInstructions {
  const tactics = { ...profile.defaultTactics };

  // Only counter if adaptability check passes
  if (Math.random() > profile.adaptability) return tactics;

  // Scale: higher adaptability = more adjustments applied
  const strength = profile.adaptability * (1 - counterReduction);
  if (strength < 0.1) return tactics;

  // Counter high defensive line → fast tempo + deep counter-attack
  if (opponentTactics.defensiveLine === 'high' && Math.random() < strength) {
    tactics.tempo = 'fast';
    tactics.defensiveLine = 'deep';
  }

  // Counter wide play → narrow + compact
  if (opponentTactics.width === 'wide' && Math.random() < strength) {
    tactics.width = 'narrow';
    tactics.pressingIntensity = Math.min(100, tactics.pressingIntensity + 10);
  }

  // Counter slow tempo → high pressing to suffocate
  if (opponentTactics.tempo === 'slow' && Math.random() < strength) {
    tactics.pressingIntensity = Math.min(100, tactics.pressingIntensity + 20);
  }

  // Counter attacking/all-out → absorb and counter
  if ((opponentTactics.mentality === 'attacking' || opponentTactics.mentality === 'all-out-attack') && Math.random() < strength) {
    tactics.mentality = 'cautious';
    tactics.defensiveLine = 'deep';
    tactics.tempo = 'fast';
  }

  // Counter defensive/parking the bus → wide patient build-up
  if (opponentTactics.mentality === 'defensive' && Math.random() < strength) {
    tactics.width = 'wide';
    tactics.tempo = 'slow';
    tactics.mentality = 'attacking';
  }

  // Counter high pressing → fast direct play to bypass
  if (opponentTactics.pressingIntensity >= 70 && Math.random() < strength) {
    tactics.tempo = 'fast';
  }

  return tactics;
}
