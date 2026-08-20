/**
 * Sunday League setup — the one screen before the mode starts.
 *
 * Deliberately short. The elite modes ask for a club, a manager, a nationality
 * and a set of traits; this one asks a single question that actually changes
 * the game ("what sort of club is this?") and then gets out of the way. The
 * club's name, colours, ground and nickname are rolled and re-rollable, because
 * naming things is fun for about eight seconds and a chore after that.
 *
 * WHAT CHANGED, AND WHY. The single question was being asked with eight
 * identical panels, each carrying its whole description expanded — 841
 * characters of paragraph on first paint, every block over eighty characters,
 * and not one comparable fact between them. The eight are now rows with a
 * glyph, a colour and their tagline, and the description belongs to whichever
 * one is chosen (`SundayPersonalityCard`), which also shows the three
 * modifiers ranked against the other seven.
 *
 * And the club you are about to be given is now DRAWN: the crest, and the kit
 * `sundayKitSpec` has always described — seeded on `SUNDAY_CLUB_ID`, which is
 * the id the club will really have, so the strip in the preview is the strip
 * in the game.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LiquidButton } from '@/components/game/LiquidButton';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SundayKit } from '@/components/game/sunday/SundayKit';
import { SundayPersonalityCard } from '@/components/game/sunday/SundayPersonalityCard';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { formatMoney } from '@/utils/helpers';
import {
  getSundayArchetype, SUNDAY_CLUB_ID, SUNDAY_PERSONALITIES,
} from '@/config/sundayLeague';
import { generateSundayIdentity } from '@/utils/sunday/generation';
import { createSundayRng, newSundaySeed } from '@/utils/sunday/rng';
import { sundayCrestSpec, sundayKitSpec } from '@/utils/sunday/visuals';
import { sundayPersonalityTraits } from '@/utils/sunday/view';
import type { SundayClubPersonalityId } from '@/types/game';

const BackIcon = SUNDAY_ICON.back;
const VenueIcon = SUNDAY_ICON.venue;
const RerollIcon = SUNDAY_ICON.reroll;
const MoneyIcon = SUNDAY_ICON.money;
const SquadIcon = SUNDAY_ICON.squad;

const SundaySetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { slot?: number }) || {};
  const missingSlot = navState.slot == null;
  useEffect(() => {
    // Same guard as every other setup route: a deep link with no slot must not
    // silently overwrite slot 1.
    if (missingSlot) navigate('/', { replace: true });
  }, [missingSlot, navigate]);

  const startSundayLeague = useGameStore(s => s.startSundayLeague);
  const [personality, setPersonality] = useState<SundayClubPersonalityId>('pub');
  const [seed, setSeed] = useState(() => newSundaySeed());
  const [customName, setCustomName] = useState('');

  // The preview is derived from the seed, so "Roll again" and the club you
  // actually get are the same draw — no surprise rename at kick-off.
  const identity = useMemo(
    () => generateSundayIdentity(createSundayRng(seed, 0), personality),
    [seed, personality],
  );
  const info = SUNDAY_PERSONALITIES.find(p => p.id === personality) ?? SUNDAY_PERSONALITIES[0];
  // Both specs are pure hashes of the club id and its two colours, so they are
  // the ones the Clubhouse will draw once the season starts.
  const kit = sundayKitSpec(identity.color, identity.secondaryColor, SUNDAY_CLUB_ID);
  const crest = sundayCrestSpec(SUNDAY_CLUB_ID, identity.color, identity.secondaryColor);

  if (missingSlot) return null;

  const start = () => {
    const trimmed = customName.trim();
    // Target the chosen slot BEFORE booting — `startSundayLeague`'s internal
    // `resetGame` wipes whatever `activeSlot` points at, so setting it after
    // would delete the wrong save. Same contract as WorldCupSetup.
    useGameStore.setState({ activeSlot: navState.slot ?? 1 });
    void startSundayLeague({
      personality,
      seed,
      identity: trimmed ? { name: trimmed } : undefined,
    }).then(() => navigate('/game'));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 pb-8 safe-area-top safe-area-bottom">
      <div className="w-full max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1.5 -ml-2 mt-2"
          onClick={() => navigate('/mode-select', { state: { slot: navState.slot } })}
        >
          <BackIcon className="w-4 h-4" /> {t('sunday.setup.back')}
        </Button>
      </div>

      <div className="w-full max-w-lg mt-4 space-y-4">
        <div className="text-center">
          <SectionHeader title={t('sunday.setup.title')} />
          <p className="text-caption text-muted-foreground mt-1">{t('sunday.setup.subtitle')}</p>
        </div>

        {/* The club you are about to be handed, drawn rather than described.
            The reroll sits UNDER the name rather than beside it: `LiquidButton`
            is `w-full` by default, so as a flex sibling of the name field it
            took the whole row and pushed the input — and the ground it plays
            on — off the right edge of the panel. */}
        <GlassPanel className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <SundayKit
              body={kit.body}
              trim={kit.trim}
              pattern={kit.pattern}
              crestShape={crest.shape}
              size={76}
              label={t('sunday.club.kitAria', { name: customName.trim() || identity.name })}
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                {/* The visible label is the placeholder — the rolled club
                    name — so the accessible one is the only one, and giving
                    the input an `aria-label` as well would name it twice. */}
                <label className="sr-only" htmlFor="sunday-club-name">{t('sunday.setup.nameLabel')}</label>
                <input
                  id="sunday-club-name"
                  value={customName}
                  onChange={e => setCustomName(e.target.value.slice(0, 28))}
                  placeholder={identity.name}
                  className="w-full bg-transparent text-body font-bold text-foreground outline-none placeholder:text-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/60 rounded px-1 -mx-1 py-2.5"
                />
                <p className="text-caption text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <VenueIcon className="w-3 h-3 shrink-0" aria-hidden />
                  {identity.venue}, {identity.town}
                </p>
              </div>
              <LiquidButton
                onClick={() => setSeed(newSundaySeed())}
                aria-label={t('sunday.setup.rerollAria')}
                className="w-auto px-3"
              >
                <span className="inline-flex items-center gap-1.5 text-caption">
                  <RerollIcon className="w-4 h-4" aria-hidden /> {t('sunday.setup.reroll')}
                </span>
              </LiquidButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.04] px-3 py-2">
              <p className="text-caption text-muted-foreground flex items-center gap-1">
                <MoneyIcon className="w-3 h-3" aria-hidden /> {t('sunday.setup.startingBalance')}
              </p>
              <p className="text-body font-semibold text-foreground">{formatMoney(info.startBalance)}</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-2">
              <p className="text-caption text-muted-foreground flex items-center gap-1">
                <SquadIcon className="w-3 h-3" aria-hidden /> {t('sunday.setup.squadSize')}
              </p>
              <p className="text-body font-semibold text-foreground">
                {t('sunday.setup.squadSizeValue', { n: info.squadSize })}
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Club personality */}
        <div
          role="radiogroup"
          aria-label={t('sunday.setup.subtitle')}
          className="space-y-2"
        >
          {SUNDAY_PERSONALITIES.map((p, idx) => (
            <SundayPersonalityCard
              key={p.id}
              id={p.id}
              name={p.name}
              tagline={p.tagline}
              description={p.description}
              ageMin={p.ageMin}
              ageMax={p.ageMax}
              archetypeNames={p.favouredArchetypes.map(a => getSundayArchetype(a).name)}
              traits={sundayPersonalityTraits(p)}
              selected={p.id === personality}
              index={idx}
              onSelect={setPersonality}
            />
          ))}
        </div>

        <LiquidButton tone="primary" onClick={start} className="w-full py-3">
          {t('sunday.setup.start')}
        </LiquidButton>
      </div>
    </div>
  );
};

export default SundaySetup;
