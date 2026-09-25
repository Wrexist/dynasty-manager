import type { PressConference, PressOption } from '@/types/game';
import type { PressQuestionDef } from '@/data/pressQuestionBank';
import { pick, safeRandomUUID } from '@/utils/helpers';
import { readPressRecentQuestions, writePressRecentQuestions, clearPressRecentQuestions } from '@/store/helpers/persistence';
import { PRESS_TRANSFER_RUMOUR_CHANCE, PRESS_POOR_FORM_LOSSES, PRESS_GOOD_FORM_WINS, PRESS_BIG_MATCH_REP_GAP, PRESS_PROMOTION_RACE_TOP_N, PRESS_RELEGATION_BATTLE_BOTTOM_N, PRESS_INJURY_CRISIS_MIN, PRESS_DERBY_PREVIEW_CHANCE, PRESS_SITUATIONAL_POST_MATCH_CHANCE } from '@/config/gameBalance';

type QuestionDef = PressQuestionDef;
type QuestionBank = Record<PressConference['context'], QuestionDef[]>;

// ── Question bank (lazy) ──
//
// The ~65 kB bank lives in `pressQuestionBank.ts`, its own chunk, so it is not
// parsed as part of the main chunk at boot. It is requested right after this
// module evaluates; a press conference is only ever generated after a match,
// long after that. `FALLBACK_QUESTION` covers the gap anyway (a test harness, a
// chunk that failed to load) so the post-match flow can never break on it.

let questionBank: QuestionBank | null = null;
let questionBankLoad: Promise<QuestionBank> | null = null;

/** Load (once) and cache the question bank. Safe to call repeatedly; a failed
 *  load is retried on the next call. */
export function loadPressQuestionBank(): Promise<QuestionBank> {
  if (questionBank) return Promise.resolve(questionBank);
  if (!questionBankLoad) {
    questionBankLoad = import('@/data/pressQuestionBank')
      .then(m => { questionBank = m.QUESTIONS; return m.QUESTIONS; })
      .catch(err => { questionBankLoad = null; throw err; });
  }
  return questionBankLoad;
}

/** The loaded bank, or null before it has arrived. */
export function getLoadedPressQuestionBank(): QuestionBank | null {
  return questionBank;
}

if (typeof window !== 'undefined') {
  setTimeout(() => { loadPressQuestionBank().catch(() => { /* retried on next use */ }); }, 0);
}

/** Asked only if a conference is generated before the bank has loaded. Neutral
 *  wording so it fits every context; effects sit inside the bank's ranges. */
const FALLBACK_QUESTION: QuestionDef = {
  question: 'How would you sum up where the team is right now?',
  options: {
    confident: { text: 'We know exactly what we are building and we are right on course.', effects: { morale: 5, boardConfidence: 3, fanMood: 5 } },
    humble: { text: 'There is plenty still to improve, but the effort from the lads is there every day.', effects: { morale: 6, boardConfidence: 3, fanMood: 3 } },
    deflect: { text: 'I will let the results speak for us. The next game is all that matters.', effects: { morale: 3, boardConfidence: 2, fanMood: 1 } },
  },
};

// ── Question recency memory ──
//
// A bare `pick(pool)` over 7–8 questions per context means back-to-back
// identical questions are likely (~1-in-7 every time, and the same context
// repeats after consecutive wins). This mirrors the `pickFreshLine` pattern
// already used for match commentary: remember the last few questions asked per
// context and exclude them from the draw.
//
// The ring buffer is mirrored to device storage (`STORAGE_KEYS.
// PRESS_RECENT_QUESTIONS`) so it survives a cold launch — the window where
// repetition was most noticeable, because the buffer used to live only in
// module memory. It stores short hashes of the question text, a few per
// context, so the record stays a few hundred bytes. Device-level rather than a
// GameState field: it is a variety aid, not game state, and needs no schema bump.

/** How many recently-asked questions to exclude per context. Kept below the
 *  smallest pool size so the exclusion set can never swallow a whole pool. */
export const PRESS_RECENT_MEMORY = 4;

const recentQuestions = new Map<string, string[]>();
let recentHydrated = false;

/** Short, stable id for a question (djb2, base 36). Questions have no ids, and
 *  persisting the prose itself would bloat the record for no benefit. */
export function pressQuestionKey(question: string): string {
  let h = 5381;
  for (let i = 0; i < question.length; i++) h = ((h * 33) ^ question.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function hydrateRecentQuestions(): void {
  if (recentHydrated) return;
  recentHydrated = true;
  for (const [context, keys] of Object.entries(readPressRecentQuestions())) {
    recentQuestions.set(context, keys.slice(-PRESS_RECENT_MEMORY));
  }
}

/** Test hook, and "forget everything": clears memory and the stored record. */
export function resetPressConferenceMemory(): void {
  recentQuestions.clear();
  recentHydrated = true;
  clearPressRecentQuestions();
}

/** Pick a question from `pool`, preferring ones not asked recently in this
 *  context, then record the choice in that context's ring buffer. */
function pickFreshQuestion(context: PressConference['context'], pool: QuestionDef[]): QuestionDef {
  hydrateRecentQuestions();
  const recent = recentQuestions.get(context) ?? [];
  const fresh = pool.filter(q => !recent.includes(pressQuestionKey(q.question)));
  const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
  const chosenKey = pressQuestionKey(chosen.question);
  // Cap at PRESS_RECENT_MEMORY, and never at or above the pool size — a pool
  // of 4 with a memory of 4 would exclude everything and defeat the point.
  const limit = Math.min(PRESS_RECENT_MEMORY, Math.max(0, pool.length - 1));
  recentQuestions.set(context, [...recent.filter(k => k !== chosenKey), chosenKey].slice(-limit));
  writePressRecentQuestions(Object.fromEntries(recentQuestions));
  return chosen;
}

/**
 * The numbers a Pro answer actually applies: those of the free answer nearest
 * the authored ones (L1 distance; ties go to the earlier free tone).
 *
 * Pro buys a fourth VOICE, not a stronger lever. Press effects move squad
 * morale — which the match engine reads — plus board confidence and fan mood,
 * and monetization must never move a sim parameter. The authored Pro effects
 * out-scored every free answer on at least one stat in most questions (74 of
 * 88 gave more board confidence than any free option), so they are no longer
 * applied; they only choose which free answer's effects the Pro line mirrors,
 * keeping the author's intent (a fan-heavy line mirrors the fan-heavy answer).
 */
export function proOptionEffects(q: QuestionDef): PressOption['effects'] {
  const free = [q.options.confident.effects, q.options.humble.effects, q.options.deflect.effects];
  const authored = q.proOption?.effects;
  if (!authored) return { ...free[0] };
  let best = free[0];
  let bestDist = Infinity;
  for (const e of free) {
    const d = Math.abs(e.morale - authored.morale)
      + Math.abs(e.boardConfidence - authored.boardConfidence)
      + Math.abs(e.fanMood - authored.fanMood);
    if (d < bestDist) { best = e; bestDist = d; }
  }
  return { ...best };
}

/** Pick a press conference appropriate to the context */
export function generatePressConference(context: PressConference['context'], proUser = false): PressConference {
  const pool = questionBank?.[context];
  const chosen = pool && pool.length > 0 ? pickFreshQuestion(context, pool) : FALLBACK_QUESTION;
  const baseOptions: [PressOption, PressOption, PressOption] = [
    { tone: 'confident', text: chosen.options.confident.text, effects: chosen.options.confident.effects },
    { tone: 'humble', text: chosen.options.humble.text, effects: chosen.options.humble.effects },
    { tone: 'deflect', text: chosen.options.deflect.text, effects: chosen.options.deflect.effects },
  ];

  if (proUser && chosen.proOption) {
    return {
      id: safeRandomUUID(),
      context,
      question: chosen.question,
      options: [...baseOptions, { tone: chosen.proOption.tone, text: chosen.proOption.text, effects: proOptionEffects(chosen) }],
      hasProOption: true,
    };
  }

  return {
    id: safeRandomUUID(),
    context,
    question: chosen.question,
    options: baseOptions,
    hasProOption: Boolean(chosen.proOption),
  };
}

/** Extra context data for richer press conference selection */
export interface PressContextExtras {
  leaguePosition?: number;
  totalTeams?: number;
  recentSigning?: boolean;
  injuredCount?: number;
  isDerby?: boolean;
}

/**
 * Post-match context: usually the result, sometimes the club's situation.
 *
 * Every production call site used to hardcode the post_win/post_loss/post_draw
 * trio, so nine of the twelve authored contexts never shipped. This keeps the
 * result dominant — it is a post-match press conference — while letting the
 * situational questions through often enough to be seen.
 *
 * The two PREVIEW contexts are deliberately excluded: `derby_preview` and
 * `pre_big_match` are written in the future tense and read wrong after a match.
 */
export function getPostMatchPressContext(
  won: boolean | null,
  lost: boolean | null,
  recentForm: ('W' | 'D' | 'L')[],
  hasListedPlayers: boolean,
  extras?: PressContextExtras,
): PressConference['context'] {
  const result: PressConference['context'] = won ? 'post_win' : lost ? 'post_loss' : 'post_draw';
  if (Math.random() >= PRESS_SITUATIONAL_POST_MATCH_CHANCE) return result;

  // `won`/`lost` are passed as null so the post-match short-circuit inside
  // `getPressContext` doesn't fire and the situational branches are reached.
  const situational = getPressContext(null, null, recentForm, hasListedPlayers, undefined, undefined, {
    ...extras,
    isDerby: false, // preview-tense; never post-match
  });
  return situational === 'derby_preview' || situational === 'pre_big_match' ? result : situational;
}

/** Determine what kind of press conference to show based on game state */
export function getPressContext(
  won: boolean | null,
  lost: boolean | null,
  recentForm: ('W' | 'D' | 'L')[],
  hasListedPlayers: boolean,
  opponentReputation?: number,
  playerReputation?: number,
  extras?: PressContextExtras,
): PressConference['context'] {
  // Post-match always takes priority
  if (won === true) return 'post_win';
  if (lost === true) return 'post_loss';
  if (won === false && lost === false) return 'post_draw';

  // Pre-match or weekly contexts
  const last5 = recentForm.slice(-5);
  const losses = last5.filter(r => r === 'L').length;
  const wins = last5.filter(r => r === 'W').length;

  // New signing takes immediate priority (one-time event)
  if (extras?.recentSigning) return 'new_signing';

  // Derby preview before reputation-based big match
  if (extras?.isDerby && Math.random() < PRESS_DERBY_PREVIEW_CHANCE) return 'derby_preview';

  // Injury crisis
  if (extras?.injuredCount && extras.injuredCount >= PRESS_INJURY_CRISIS_MIN) return 'injury_crisis';

  // Transfer rumours
  if (hasListedPlayers && Math.random() < PRESS_TRANSFER_RUMOUR_CHANCE) return 'transfer_rumour';

  // League position contexts (only when position data available)
  if (extras?.leaguePosition && extras?.totalTeams) {
    if (extras.leaguePosition <= PRESS_PROMOTION_RACE_TOP_N && wins >= 2) return 'promotion_race';
    if (extras.leaguePosition > extras.totalTeams - PRESS_RELEGATION_BATTLE_BOTTOM_N) return 'relegation_battle';
  }

  if (losses >= PRESS_POOR_FORM_LOSSES) return 'poor_form';
  if (wins >= PRESS_GOOD_FORM_WINS) return 'good_form';
  if (opponentReputation && playerReputation && opponentReputation >= playerReputation + PRESS_BIG_MATCH_REP_GAP) return 'pre_big_match';

  // Default to form-based
  return wins > losses ? 'good_form' : 'poor_form';
}
