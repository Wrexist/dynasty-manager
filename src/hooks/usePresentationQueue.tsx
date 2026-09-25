/**
 * Presentation-queue coordinator (G3).
 *
 * A React context that lets independently-mounted overlays negotiate who is
 * on screen. Each overlay calls `usePresentationSlot(id, wants)` — while
 * `wants` is true it is registered; the coordinator picks the single
 * highest-priority registrant (see `planPresentation`) and the hook returns
 * whether THIS overlay is the winner. Overlays render (and fire
 * haptics/sounds) only when they win, so exactly one shows at a time and
 * feedback never fires for an invisible modal.
 *
 * Per-advance cap. One-at-a-time still let a single advance chain six
 * dismiss-taps. The coordinator now spends a budget of
 * `BLOCKING_POPUPS_PER_ADVANCE` distinct overlays per advance; past it, an
 * overlay's `OVERLAY_OVERFLOW` policy decides — decisions still show,
 * informational popups are filed to the inbox by the converter their owner
 * registered with `usePresentationOverflow`, offers wait for the next advance.
 *
 * The ledger of what has been shown is MODULE state keyed on season + week, not
 * provider state: `GameShell` wraps the provider in a per-screen error boundary
 * keyed on the screen, so it remounts on every navigation, and a ledger held in
 * React state would hand out a fresh budget each time the player tapped away
 * and back. It is deliberately not persisted — a relaunch is a new session.
 *
 * The provider wraps the in-game screen tree (see `GameShell`). Overlays
 * used outside a provider (defensive — none today) degrade gracefully: the
 * hook returns `true` (un-gated), preserving pre-queue behaviour.
 *
 * Two contexts are used deliberately: a STABLE actions context (register /
 * unregister never change identity) drives the registration effect without
 * re-running it every time the active id changes, and a separate active-id
 * context carries the winner. This avoids a register/unregister storm on
 * every promotion.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { BLOCKING_POPUPS_PER_ADVANCE } from '@/config/gameBalance';
import { OVERLAY_OVERFLOW, planPresentation, type OverlayId } from '@/utils/presentationQueue';

interface QueueActions {
  register: (id: string) => void;
  unregister: (id: string) => void;
  setOverflowHandler: (id: OverlayId, handler: (() => void) | null) => void;
}

const ActionsContext = createContext<QueueActions | null>(null);
const ActiveContext = createContext<string | null>(null);

interface Ledger {
  epoch: string;
  shown: Set<string>;
  suppressed: Set<string>;
}

let ledger: Ledger = { epoch: '', shown: new Set(), suppressed: new Set() };

/** The ledger for `epoch`, starting a fresh budget when the advance changed. */
function ledgerFor(epoch: string): Ledger {
  if (ledger.epoch !== epoch) ledger = { epoch, shown: new Set(), suppressed: new Set() };
  return ledger;
}

/** Test seam: forget what this session has shown. */
export function resetPresentationLedger(): void {
  ledger = { epoch: '', shown: new Set(), suppressed: new Set() };
}

export function PresentationQueueProvider({ children }: { children: React.ReactNode }) {
  const [registered, setRegistered] = useState<string[]>([]);
  // One budget per advance. Season + week is what an advance changes.
  const epoch = useGameStore(s => `${s.season}:${s.week}`);
  const handlersRef = useRef(new Map<OverlayId, () => void>());

  const register = useCallback((id: string) => {
    setRegistered(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const unregister = useCallback((id: string) => {
    setRegistered(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev));
  }, []);
  const setOverflowHandler = useCallback((id: OverlayId, handler: (() => void) | null) => {
    if (handler) handlersRef.current.set(id, handler);
    else handlersRef.current.delete(id);
  }, []);

  const plan = useMemo(
    () => planPresentation(registered, ledgerFor(epoch), BLOCKING_POPUPS_PER_ADVANCE, id => handlersRef.current.has(id)),
    [registered, epoch],
  );

  // Record the plan: the winner has now been shown this advance, and anything
  // past the cap is suppressed for the rest of it. 'inbox' overflow is handed
  // to its owner's converter, which files the message and clears the state —
  // that unregisters the overlay, which re-plans. Idempotent per id, so a
  // double-invoked effect cannot file the same popup twice.
  useEffect(() => {
    const current = ledgerFor(epoch);
    if (plan.active) current.shown.add(plan.active);
    for (const id of plan.overflow) {
      if (current.suppressed.has(id)) continue;
      current.suppressed.add(id);
      if (OVERLAY_OVERFLOW[id] === 'inbox') handlersRef.current.get(id)?.();
    }
  }, [plan, epoch]);

  const actions = useMemo<QueueActions>(
    () => ({ register, unregister, setOverflowHandler }),
    [register, unregister, setOverflowHandler],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <ActiveContext.Provider value={plan.active}>{children}</ActiveContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * Register an overlay's intent to show and learn whether it is the active
 * one. Returns `true` when this overlay should render, `false` when another
 * overlay currently outranks it or it went past the cap. With no provider
 * present, returns `true`.
 */
export function usePresentationSlot(id: string, wants: boolean): boolean {
  const actions = useContext(ActionsContext);
  const activeId = useContext(ActiveContext);

  useEffect(() => {
    if (!actions) return;
    if (wants) {
      actions.register(id);
      return () => actions.unregister(id);
    }
    actions.unregister(id);
    return undefined;
  }, [actions, id, wants]);

  if (!actions) return true;
  return activeId === id;
}

/**
 * Register the converter that files overlay `id` to the inbox when it goes
 * past the per-advance cap. Call it from whoever owns the overlay's state (the
 * Dashboard, for everything it mounts). The converter MUST clear that state —
 * an overlay that keeps asking for the screen would be reconsidered after the
 * next advance and show stale. Without a converter, an 'inbox' overlay is
 * shown rather than lost.
 */
export function usePresentationOverflow(id: OverlayId, fileToInbox: () => void): void {
  const actions = useContext(ActionsContext);
  const latest = useRef(fileToInbox);
  useEffect(() => {
    latest.current = fileToInbox;
  });
  useEffect(() => {
    if (!actions) return;
    actions.setOverflowHandler(id, () => latest.current());
    return () => actions.setOverflowHandler(id, null);
  }, [actions, id]);
}
