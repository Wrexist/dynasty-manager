import type { GameScreen } from '@/types/game';
import { BACK_TARGET, UNEMPLOYED_ALLOWED_SCREENS } from '@/config/navigation';

/**
 * In-game "back": where you came from first, the static table second.
 *
 * `BACK_TARGET` is a fixed parent per screen, so Market → Player → back landed
 * on Squad, and Board → Finance → back landed on the Dashboard. The store
 * records the screen you left (`previousScreen`) on every `setScreen` /
 * `selectPlayer` / `selectClub`, so back prefers that trail.
 *
 * The trail is only trusted when it was recorded FOR the current screen
 * (`previousScreenFor === currentScreen`). Several flows assign `currentScreen`
 * directly (week advance → Season Summary, sacking → Job Market, match end →
 * Dashboard) without touching `previousScreen`, which leaves it pointing at a
 * screen from before the jump. The owner check turns that stale trail into a
 * fallback to the table rather than a wrong destination.
 */

/** Never return to the live match screen — re-entering it restarts the flow. */
const NO_RETURN: ReadonlySet<GameScreen> = new Set<GameScreen>(['match']);

export interface BackContext {
  currentScreen: GameScreen;
  previousScreen: GameScreen | null;
  /** The screen `previousScreen` was recorded on arrival at. */
  previousScreenFor: GameScreen | null;
  /** Where back lands when neither the trail nor the table has an answer. */
  root: GameScreen;
  /** Unemployed career manager: club screens are off-limits. */
  isUnemployed?: boolean;
}

export function resolveBackTarget({
  currentScreen, previousScreen, previousScreenFor, root, isUnemployed = false,
}: BackContext): GameScreen {
  const trailUsable =
    !!previousScreen &&
    previousScreenFor === currentScreen &&
    previousScreen !== currentScreen &&
    !NO_RETURN.has(previousScreen) &&
    (!isUnemployed || UNEMPLOYED_ALLOWED_SCREENS.has(previousScreen));
  const raw = (trailUsable ? previousScreen : BACK_TARGET[currentScreen]) || root;
  // Unemployed: the club hub and squad no longer exist for you.
  if (isUnemployed && (raw === 'dashboard' || raw === 'squad')) return 'job-market';
  return raw;
}

export type HardwareBackAction = 'dismiss-overlay' | 'ignore' | 'minimize' | 'back';

/**
 * What the Android hardware back button does inside the game. An open overlay
 * is closed first (never navigated out from under — that would throw away a
 * live negotiation); a locked match ignores it; a bottom-nav tab has nowhere
 * further back to go, so the app is backgrounded rather than killed.
 */
export function resolveHardwareBack({ overlayOpen, matchLocked, onTab }: {
  overlayOpen: boolean;
  matchLocked: boolean;
  onTab: boolean;
}): HardwareBackAction {
  if (overlayOpen) return 'dismiss-overlay';
  if (matchLocked) return 'ignore';
  if (onTab) return 'minimize';
  return 'back';
}
