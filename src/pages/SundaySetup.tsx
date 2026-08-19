/**
 * Sunday League setup — the one screen before the mode starts.
 *
 * Deliberately short. The elite modes ask for a club, a manager, a nationality
 * and a set of traits; this one asks a single question that actually changes
 * the game ("what sort of club is this?") and then gets out of the way. The
 * club's name, colours, ground and nickname are rolled and re-rollable, because
 * naming things is fun for about eight seconds and a chore after that.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LiquidButton } from '@/components/game/LiquidButton';
import { GlassPanel, LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { SectionHeader } from '@/components/game/SectionHeader';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import { SUNDAY_PERSONALITIES } from '@/config/sundayLeague';
import { generateSundayIdentity } from '@/utils/sunday/generation';
import { createSundayRng, newSundaySeed } from '@/utils/sunday/rng';
import type { SundayClubPersonalityId } from '@/types/game';

const BackIcon = SUNDAY_ICON.back;
const VenueIcon = SUNDAY_ICON.venue;
const RerollIcon = SUNDAY_ICON.reroll;
const MoneyIcon = SUNDAY_ICON.money;
const SquadIcon = SUNDAY_ICON.squad;

const SundaySetup = () => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
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

        {/* Club identity preview */}
        <GlassPanel className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: identity.color, color: identity.secondaryColor }}
              aria-hidden
            >
              {identity.shortName.slice(0, 3).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <label className="sr-only" htmlFor="sunday-club-name">{t('sunday.setup.nameLabel')}</label>
              <input
                id="sunday-club-name"
                value={customName}
                onChange={e => setCustomName(e.target.value.slice(0, 28))}
                placeholder={identity.name}
                aria-label={t('sunday.setup.nameLabel')}
                className="w-full bg-transparent text-body font-bold text-foreground outline-none placeholder:text-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/60 rounded px-1 -mx-1"
              />
              <p className="text-caption text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <VenueIcon className="w-3 h-3 shrink-0" aria-hidden />
                {identity.venue}, {identity.town}
              </p>
            </div>
            <LiquidButton
              onClick={() => setSeed(newSundaySeed())}
              aria-label={t('sunday.setup.rerollAria')}
              className="shrink-0 px-3"
            >
              <span className="inline-flex items-center gap-1.5 text-caption">
                <RerollIcon className="w-4 h-4" aria-hidden /> {t('sunday.setup.reroll')}
              </span>
            </LiquidButton>
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
          {SUNDAY_PERSONALITIES.map((p, idx) => {
            const active = p.id === personality;
            return (
              <motion.button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: Math.min(idx * 0.03, 0.2), duration: 0.25 }}
                onClick={() => setPersonality(p.id)}
                className={cn(
                  LIQUID_GLASS_SURFACE,
                  'w-full text-left p-3.5 border transition-colors min-h-[44px]',
                  active ? 'border-primary/60' : 'border-white/10 hover:border-white/20',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-body font-bold', active ? 'text-primary' : 'text-foreground')}>
                    {p.name}
                  </span>
                  <span className="text-caption text-muted-foreground truncate">{p.tagline}</span>
                </div>
                <p className="text-caption text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
              </motion.button>
            );
          })}
        </div>

        <LiquidButton tone="primary" onClick={start} className="w-full py-3">
          {t('sunday.setup.start')}
        </LiquidButton>
      </div>
    </div>
  );
};

export default SundaySetup;
