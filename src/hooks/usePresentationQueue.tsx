/**
 * Presentation-queue coordinator (G3).
 *
 * A React context that lets independently-mounted overlays negotiate who is
 * on screen. Each overlay calls `usePresentationSlot(id, wants)` — while
 * `wants` is true it is registered; the coordinator picks the single
 * highest-priority registrant (see `resolveActiveOverlay`) and the hook
 * returns whether THIS overlay is the winner. Overlays render (and fire
 * haptics/sounds) only when they win, so exactly one shows at a time and
 * feedback never fires for an invisible modal.
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
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveActiveOverlay } from '@/utils/presentationQueue';

interface QueueActions {
  register: (id: string) => void;
  unregister: (id: string) => void;
}

const ActionsContext = createContext<QueueActions | null>(null);
const ActiveContext = createContext<string | null>(null);

export function PresentationQueueProvider({ children }: { children: React.ReactNode }) {
  const [registered, setRegistered] = useState<string[]>([]);

  const register = useCallback((id: string) => {
    setRegistered(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const unregister = useCallback((id: string) => {
    setRegistered(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev));
  }, []);

  const activeId = useMemo(() => resolveActiveOverlay(registered), [registered]);
  const actions = useMemo<QueueActions>(() => ({ register, unregister }), [register, unregister]);

  return (
    <ActionsContext.Provider value={actions}>
      <ActiveContext.Provider value={activeId}>{children}</ActiveContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * Register an overlay's intent to show and learn whether it is the active
 * one. Returns `true` when this overlay should render, `false` when another
 * overlay currently outranks it. With no provider present, returns `true`.
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
