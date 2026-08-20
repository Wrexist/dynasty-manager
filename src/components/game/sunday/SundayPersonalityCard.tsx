/**
 * One of the eight clubs you could be, as a row you can read at a glance.
 *
 * WHAT WAS WRONG. Setup is the player's first contact with the mode and holds
 * exactly one decision that changes the game — and it presented that decision
 * as eight identical glass panels, each with a bold name, a tagline and a
 * fully-expanded paragraph. Eight paragraphs is 841 characters of prose before
 * the player has pressed anything, all of it the same weight, all of it
 * competing, and none of it comparable: nothing on the screen said which club
 * was good, which turned up, or which would lose 6-0 for fun. The choice was
 * made on paragraph length.
 *
 * WHAT THIS IS. The row keeps the two things that identify a club instantly —
 * a glyph in its own colour (`SUNDAY_PERSONALITY_ICON` /
 * `SUNDAY_PERSONALITY_TONE`) and its tagline, which is the club's own voice —
 * and moves the description behind selection, where exactly one is ever on
 * screen. Selecting also reveals what the paragraph never told anybody: the
 * three modifiers ranked against the other seven (`sundayPersonalityTraits`),
 * the age band the squad is rolled from, and the archetypes it favours, whose
 * names are the funniest authored copy in the mode and had never been shown.
 *
 * ONE BUTTON, PHRASING CONTENT ONLY. The whole row is the radio, so everything
 * inside it — pips included — is a `<span>`. A `<div>` inside a `<button>` is
 * invalid markup and a nested `<button>` would be a second tap target inside
 * the first.
 *
 * NOT MEMOIZED, DELIBERATELY. Eight of these render on a screen with no store
 * subscription at all: nothing re-renders them except the selection changing,
 * which has to re-render them.
 */
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n';
import { SUNDAY_PERSONALITY_ICON, SUNDAY_PERSONALITY_TONE } from '@/config/sundayIcons';
import { SUNDAY_TRAIT_PIPS, type SundayPersonalityTrait, type SundayTraitId } from '@/utils/sunday/view';
import type { SundayClubPersonalityId } from '@/types/game';

/** Trait → its label. The helper returns ids; the copy lives here. */
const TRAIT_LABEL: Record<SundayTraitId, TranslationKey> = {
  ability: 'sunday.setup.traitAbility',
  turnout: 'sunday.setup.traitTurnout',
  chaos: 'sunday.setup.traitChaos',
};

export interface SundayPersonalityCardProps {
  id: SundayClubPersonalityId;
  /** `SundayPersonalityInfo.name` — game data, English. */
  name: string;
  /** The club's own voice. Kept on every row, selected or not. */
  tagline: string;
  /** The paragraph. Only rendered when this row is the chosen one. */
  description: string;
  ageMin: number;
  ageMax: number;
  /** `SundayArchetypeInfo.name` for each favoured archetype, already resolved. */
  archetypeNames: readonly string[];
  traits: readonly SundayPersonalityTrait[];
  selected: boolean;
  /** Position in the list, for the entrance stagger only. */
  index: number;
  onSelect: (id: SundayClubPersonalityId) => void;
}

export function SundayPersonalityCard({
  id,
  name,
  tagline,
  description,
  ageMin,
  ageMax,
  archetypeNames,
  traits,
  selected,
  index,
  onSelect,
}: SundayPersonalityCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const Icon = SUNDAY_PERSONALITY_ICON[id];

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * 0.025, 0.16), duration: 0.22 }}
      onClick={() => onSelect(id)}
      className={cn(
        // FLAT TINT, NO BLUR. Eight of these animate in on mount and then
        // scroll under a thumb; eight backdrop-filtered surfaces doing either
        // is the one thing the mode's performance rule forbids outright.
        'w-full text-left rounded-xl border p-3 min-h-[44px] transition-colors',
        selected
          ? 'bg-white/[0.06] border-primary/60'
          : 'bg-white/[0.025] border-white/10 hover:border-white/20',
      )}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={cn('w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0', SUNDAY_PERSONALITY_TONE[id])}>
          <Icon className="w-4 h-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-body font-bold truncate', selected ? 'text-primary' : 'text-foreground')}>
            {name}
          </span>
          <span className="block text-caption text-muted-foreground truncate">{tagline}</span>
        </span>
      </span>

      {/* The reward for choosing: the paragraph, the three numbers it never
          gave, and the sort of people who will turn up. */}
      {selected && (
        <span className="block mt-2.5 space-y-2.5">
          <span className="block text-caption text-muted-foreground leading-relaxed">{description}</span>

          <span className="grid grid-cols-3 gap-2">
            {traits.map(trait => (
              <span key={trait.id} className="block min-w-0">
                <span className="block text-micro text-muted-foreground truncate">{t(TRAIT_LABEL[trait.id])}</span>
                <span
                  className="flex gap-1 mt-1"
                  aria-label={t('sunday.setup.traitAria', {
                    label: t(TRAIT_LABEL[trait.id]),
                    n: trait.pips,
                    max: SUNDAY_TRAIT_PIPS,
                  })}
                >
                  {Array.from({ length: SUNDAY_TRAIT_PIPS }, (_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={cn(
                        'block w-1.5 h-1.5 rounded-full',
                        i < trait.pips ? 'bg-primary' : 'bg-white/15',
                      )}
                    />
                  ))}
                </span>
              </span>
            ))}
          </span>

          <span className="block text-micro text-muted-foreground">
            {t('sunday.setup.ages', { min: ageMin, max: ageMax })} · {archetypeNames.join(' · ')}
          </span>
        </span>
      )}
    </motion.button>
  );
}
