import type { PressConference, PressOption, PressResponseTone } from '@/types/game';
import { pick } from '@/utils/helpers';
import { PRESS_TRANSFER_RUMOUR_CHANCE, PRESS_POOR_FORM_LOSSES, PRESS_GOOD_FORM_WINS, PRESS_BIG_MATCH_REP_GAP } from '@/config/gameBalance';

interface QuestionDef {
  question: string;
  options: Record<PressResponseTone, { text: string; effects: PressOption['effects'] }>;
  proOption?: { tone: PressResponseTone; text: string; effects: PressOption['effects'] };
}

// Pool of press conference questions by context
const QUESTIONS: Record<PressConference['context'], QuestionDef[]> = {
  post_win: [
    {
      question: 'A great result today. How do you feel about the team\'s performance?',
      options: {
        confident: { text: 'We dominated from start to finish. This is the standard we set.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'The lads worked incredibly hard. Credit to every single one of them.', effects: { morale: 12, boardConfidence: 3, fanMood: 5 } },
        deflect: { text: 'It\'s just three points. We focus on the next game now.', effects: { morale: 4, boardConfidence: 2, fanMood: 2 } },
      },
      proOption: { tone: 'strategic', text: 'We identified their weaknesses in prep and executed perfectly. That\'s what elite analysis gives you.', effects: { morale: 10, boardConfidence: 7, fanMood: 6 } },
    },
    {
      question: 'The fans seem delighted. Is this the turning point of the season?',
      options: {
        confident: { text: 'We\'re building something special here. The fans can see it.', effects: { morale: 6, boardConfidence: 6, fanMood: 10 } },
        humble: { text: 'It\'s a step in the right direction, but we can\'t get carried away.', effects: { morale: 8, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'Let\'s not get ahead of ourselves. One game at a time.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
  ],
  post_loss: [
    {
      question: 'A disappointing result. What went wrong out there?',
      options: {
        confident: { text: 'We\'ll bounce back. One bad day doesn\'t define this squad.', effects: { morale: 5, boardConfidence: -2, fanMood: 3 } },
        humble: { text: 'I take full responsibility. We weren\'t good enough today.', effects: { morale: -3, boardConfidence: 2, fanMood: 5 } },
        deflect: { text: 'Some decisions didn\'t go our way. I won\'t say more than that.', effects: { morale: 0, boardConfidence: -4, fanMood: -3 } },
      },
      proOption: { tone: 'analytical', text: 'I\'ve already reviewed the data. We lost control in the middle third — that\'s fixable by Tuesday.', effects: { morale: 6, boardConfidence: 3, fanMood: 4 } },
    },
    {
      question: 'The fans are frustrated. Are you worried about your position?',
      options: {
        confident: { text: 'Not at all. I know exactly what this team is capable of.', effects: { morale: 8, boardConfidence: -3, fanMood: 2 } },
        humble: { text: 'I understand their frustration. We owe them better performances.', effects: { morale: -2, boardConfidence: 4, fanMood: 6 } },
        deflect: { text: 'I\'m focused on the training ground, not speculation.', effects: { morale: 2, boardConfidence: 0, fanMood: -2 } },
      },
    },
  ],
  post_draw: [
    {
      question: 'A draw today. Is that a fair result?',
      options: {
        confident: { text: 'We should have won that. We created enough chances.', effects: { morale: 4, boardConfidence: 0, fanMood: 2 } },
        humble: { text: 'A point away from home is always valuable in this league.', effects: { morale: 5, boardConfidence: 2, fanMood: 3 } },
        deflect: { text: 'The table will tell the story at the end of the season.', effects: { morale: 2, boardConfidence: 1, fanMood: 0 } },
      },
    },
  ],
  pre_big_match: [
    {
      question: 'A huge match coming up. How are you preparing the squad?',
      options: {
        confident: { text: 'We fear no one. We\'re going there to win.', effects: { morale: 10, boardConfidence: 3, fanMood: 8 } },
        humble: { text: 'We respect the opponent but believe in our quality.', effects: { morale: 6, boardConfidence: 4, fanMood: 4 } },
        deflect: { text: 'It\'s another game. We treat every match the same.', effects: { morale: 2, boardConfidence: 1, fanMood: -1 } },
      },
    },
  ],
  transfer_rumour: [
    {
      question: 'There are rumours of interest in one of your key players. Can you comment?',
      options: {
        confident: { text: 'No one is leaving. This squad is going places together.', effects: { morale: 10, boardConfidence: 2, fanMood: 6 } },
        humble: { text: 'Every player has a price, but we\'re not actively looking to sell.', effects: { morale: -2, boardConfidence: 5, fanMood: -2 } },
        deflect: { text: 'I don\'t comment on speculation. Next question.', effects: { morale: 3, boardConfidence: 1, fanMood: 0 } },
      },
    },
  ],
  poor_form: [
    {
      question: 'Your team has been struggling recently. What\'s the plan to turn things around?',
      options: {
        confident: { text: 'The quality is there. We just need a spark and we\'ll go on a run.', effects: { morale: 6, boardConfidence: -2, fanMood: 3 } },
        humble: { text: 'We\'re working on it every day on the training ground. Hard work fixes everything.', effects: { morale: 4, boardConfidence: 5, fanMood: 4 } },
        deflect: { text: 'We need some time. Rome wasn\'t built in a day.', effects: { morale: 0, boardConfidence: -3, fanMood: -4 } },
      },
    },
  ],
  good_form: [
    {
      question: 'The team is flying right now. What\'s behind this great run?',
      options: {
        confident: { text: 'This is just the beginning. We can do even better.', effects: { morale: 8, boardConfidence: 5, fanMood: 8 } },
        humble: { text: 'Team spirit and hard work. Everyone is pulling in the same direction.', effects: { morale: 12, boardConfidence: 3, fanMood: 6 } },
        deflect: { text: 'Let\'s stay grounded. Plenty of football left to play.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
      },
    },
  ],
};

/** Pick a press conference appropriate to the context */
export function generatePressConference(context: PressConference['context'], proUser = false): PressConference {
  const pool = QUESTIONS[context];
  const chosen = pick(pool);
  const baseOptions: [PressOption, PressOption, PressOption] = [
    { tone: 'confident', text: chosen.options.confident.text, effects: chosen.options.confident.effects },
    { tone: 'humble', text: chosen.options.humble.text, effects: chosen.options.humble.effects },
    { tone: 'deflect', text: chosen.options.deflect.text, effects: chosen.options.deflect.effects },
  ];

  if (proUser && chosen.proOption) {
    return {
      id: crypto.randomUUID(),
      context,
      question: chosen.question,
      options: [...baseOptions, { tone: chosen.proOption.tone, text: chosen.proOption.text, effects: chosen.proOption.effects }],
    };
  }

  return {
    id: crypto.randomUUID(),
    context,
    question: chosen.question,
    options: baseOptions,
  };
}

/** Determine what kind of press conference to show based on game state */
export function getPressContext(
  won: boolean | null,
  lost: boolean | null,
  recentForm: ('W' | 'D' | 'L')[],
  hasListedPlayers: boolean,
  opponentReputation?: number,
  playerReputation?: number,
): PressConference['context'] {
  // Post-match always takes priority
  if (won === true) return 'post_win';
  if (lost === true) return 'post_loss';
  if (won === false && lost === false) return 'post_draw';

  // Pre-match or weekly contexts
  const last5 = recentForm.slice(-5);
  const losses = last5.filter(r => r === 'L').length;
  const wins = last5.filter(r => r === 'W').length;

  if (hasListedPlayers && Math.random() < PRESS_TRANSFER_RUMOUR_CHANCE) return 'transfer_rumour';
  if (losses >= PRESS_POOR_FORM_LOSSES) return 'poor_form';
  if (wins >= PRESS_GOOD_FORM_WINS) return 'good_form';
  if (opponentReputation && playerReputation && opponentReputation >= playerReputation + PRESS_BIG_MATCH_REP_GAP) return 'pre_big_match';

  // Default to form-based
  return wins > losses ? 'good_form' : 'poor_form';
}
