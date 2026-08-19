/**
 * The week's one action, wherever you are.
 *
 * Sunday League's loop is "decide, play, move on", and until now the button
 * that drives it lived only on the hub — so from the Squad or the League table
 * the loop had no visible next step and the player navigated home to find one.
 * This bar sits above the tab strip and carries the same action the hub's
 * fixture panel does, from the same helper, so the two cannot disagree.
 *
 * Deliberately NOT a nav tab: a tab that sometimes means "play a match" and
 * sometimes "advance a week" lies about being a destination.
 *
 * Statically imported by GameShell (the shell is not lazy), so this file must
 * stay tiny and must not pull in framer-motion or any Sunday data module
 * beyond `findSundayFixture` and the pure helper.
 */
import { useShallow } from 'zustand/react/shallow';
import { LiquidButton } from '@/components/game/LiquidButton';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { findSundayFixture } from '@/store/slices/sunday/matchday';
import { sundayPrimaryAction } from '@/utils/sunday/primaryAction';

export function SundayWeekBar() {
  const { t } = useTranslation();
  const { sunday, fixtures, week, playerClubId, currentScreen } = useGameStore(useShallow(s => ({
    sunday: s.sunday,
    fixtures: s.fixtures,
    week: s.week,
    playerClubId: s.playerClubId,
    currentScreen: s.currentScreen,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const advanceWeek = useGameStore(s => s.advanceWeek);

  if (!sunday) return null;
  // The hub's in-panel CTA is the canonical one there — two identical gold
  // buttons a thumb apart is not emphasis, it is a bug that looks deliberate.
  // Match day owns the whole screen and must not offer a way to skip itself.
  if (currentScreen === 'sunday-hub' || currentScreen === 'dashboard') return null;
  if (currentScreen === 'sunday-match') return null;

  const fixture = findSundayFixture(sunday, fixtures, week, playerClubId);
  const primary = sundayPrimaryAction(sunday, !!fixture);
  // "Pick the team" while standing on the teamsheet is a button that does
  // nothing. The screen you are on always carries its own CTA for its own job.
  if (primary.screen === currentScreen) return null;

  return (
    <div className="fixed left-0 right-0 z-40 px-3 pointer-events-none" style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="pointer-events-auto max-w-lg mx-auto">
        <LiquidButton
          tone="primary"
          className="w-full py-3"
          onClick={() => { if (primary.screen) setScreen(primary.screen); else void advanceWeek(); }}
        >
          {t(primary.labelKey)}
        </LiquidButton>
      </div>
    </div>
  );
}
