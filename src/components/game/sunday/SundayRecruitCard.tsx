/**
 * A bloke somebody knows, as a card rather than a disclaimer.
 *
 * WHAT WAS WRONG. Every recruit card carried the same ~68-character sentence
 * — "Nobody has actually seen him play. These numbers are what people say." —
 * under a pill that already said exactly that in one glyph. Three recruits on
 * screen meant the same paragraph three times, while the man himself was a
 * three-letter position code and a row of bare numbers.
 *
 * WHAT THIS IS. His face (`SundayFace`, from the appearance the generator
 * already rolled for him), the position on his shoulder, what the club has
 * been told he is worth, and the six numbers — marked with a `~` and dimmed
 * while they are still hearsay, because a tilde is the shortest honest way to
 * write "about". The pill keeps the state in a word, and the only prose left
 * is `sourceText`, which is the authored line about how the club heard of him
 * and is different on every card.
 *
 * NO KIT ON HIS SHOULDERS. `SundayPlayerCard` paints a squad member's
 * portrait in the club's colours; a recruit has not signed, so he wears the
 * portrait's neutral shirt. That difference is the point.
 */
import { LiquidButton } from '@/components/game/LiquidButton';
import { SundayFace, type SundayFaceProps } from '@/components/game/sunday/SundayFace';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { ATTRIBUTE_KEYS } from '@/utils/sunday/view';
import { sundayRatingTier, type SundayRatingTier } from '@/utils/sunday/visuals';
import type { TranslationKey } from '@/i18n';
import type { PlayerAttributes, Position } from '@/types/game';

const ScoutedIcon = SUNDAY_ICON.scouted;
const RumourIcon = SUNDAY_ICON.rumour;

/** The same four-tier ink `SundayPlayerCard` uses, so a recruit's rating and a
 *  squad member's rating mean the same thing on two screens. */
const RATING_TONE: Record<SundayRatingTier, string> = {
  standout: 'text-emerald-300',
  good: 'text-primary',
  steady: 'text-foreground',
  limited: 'text-muted-foreground',
};

/** Attribute → its three-letter label. */
const ATTR_LABEL: Record<keyof PlayerAttributes, string> = {
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  defending: 'DEF',
  physical: 'PHY',
  mental: 'MEN',
};

const FACE_SIZE = 52;

export interface SundayRecruitCardProps extends Pick<
  SundayFaceProps,
  'skinTone' | 'hairStyle' | 'hairColor' | 'height' | 'build' | 'facialHair' | 'accessory'
> {
  firstName: string;
  lastName: string;
  position: Position;
  age: number;
  /** `SundayArchetypeInfo.name`. */
  archetypeName: string;
  /** What he does on weekdays. Game data — English. */
  job: string;
  /** How the club heard about him. Authored English, one line, different on
   *  every card — the only prose the card carries. */
  sourceText: string;
  /** From `sundayRecruitReport`: the numbers as the club has them, and whether
   *  they are the truth. */
  attributes: PlayerAttributes;
  overall: number;
  revealed: boolean;
  /** Signing-on cost in pounds. Zero is free. */
  fee: number;
  /** Weeks before he stops being available. */
  weeksLeft: number;
  /** Why the sign button is off, if it is. */
  disabledReason: 'none' | 'squad-full' | 'window-closed' | 'too-expensive';
  busy: boolean;
  onSign: () => void;
}

/** Why the button is off → the word on it. Naming the block on the button is
 *  what lets the screen drop the banner that used to explain it twice. */
const DISABLED_LABEL: Record<Exclude<SundayRecruitCardProps['disabledReason'], 'none'>, TranslationKey> = {
  'squad-full': 'sunday.recruit.blockedSquad',
  'window-closed': 'sunday.recruit.blockedWindow',
  'too-expensive': 'sunday.recruit.blockedMoney',
};

export function SundayRecruitCard({
  firstName,
  lastName,
  position,
  age,
  archetypeName,
  job,
  sourceText,
  attributes,
  overall,
  revealed,
  fee,
  weeksLeft,
  disabledReason,
  busy,
  onSign,
  ...face
}: SundayRecruitCardProps) {
  const { t } = useTranslation();
  const blocked = disabledReason !== 'none';

  return (
    <div className="rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/10 p-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="relative shrink-0">
          <span className="block rounded-lg overflow-hidden bg-white/[0.05]">
            <SundayFace {...face} size={FACE_SIZE} className="block" />
          </span>
          <span className="absolute -bottom-1 -right-1 min-w-[22px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-micro font-bold bg-background/90 text-muted-foreground ring-1 ring-inset ring-white/15">
            {position}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-title font-semibold text-foreground truncate leading-tight">
              {firstName} {lastName}
            </p>
            <p className={cn('text-title font-bold tabular-nums shrink-0 leading-tight', RATING_TONE[sundayRatingTier(overall)])}>
              {revealed ? '' : '~'}{overall}
            </p>
          </div>
          <p className="text-micro text-muted-foreground truncate">
            {age} · {archetypeName} · {job}
          </p>
          <span className={cn(
            'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-micro font-semibold',
            revealed
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-white/[0.06] text-muted-foreground border-white/15',
          )}>
            {revealed
              ? <ScoutedIcon className="w-3 h-3 shrink-0" aria-hidden />
              : <RumourIcon className="w-3 h-3 shrink-0" aria-hidden />}
            {revealed ? t('sunday.recruit.seen') : t('sunday.recruit.rumour')}
          </span>
        </div>
      </div>

      {/* How the club heard about him. The one line worth reading. */}
      <p className="text-caption text-muted-foreground leading-relaxed">{sourceText}</p>

      <div className="grid grid-cols-6 gap-1">
        {ATTRIBUTE_KEYS.map(key => (
          <div key={key} className="rounded-lg bg-white/[0.04] px-1 py-1.5 text-center">
            <p className="text-micro text-muted-foreground">{ATTR_LABEL[key]}</p>
            <p className={cn(
              'text-caption font-semibold tabular-nums',
              revealed ? 'text-foreground' : 'text-muted-foreground',
            )}>
              {revealed ? '' : '~'}{attributes[key]}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <LiquidButton
          tone="primary"
          className="flex-1 py-2.5"
          disabled={blocked}
          busy={busy}
          onClick={onSign}
        >
          <span className="text-caption">
            {blocked
              ? t(DISABLED_LABEL[disabledReason as Exclude<typeof disabledReason, 'none'>])
              : fee > 0
                ? t('sunday.recruit.sign', { n: fee })
                : t('sunday.recruit.signFree')}
          </span>
        </LiquidButton>
        <span className="text-micro text-muted-foreground shrink-0">
          {t('sunday.recruit.expires', { n: weeksLeft, s: weeksLeft === 1 ? '' : 's' })}
        </span>
      </div>
    </div>
  );
}
