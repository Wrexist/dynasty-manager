import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

/** Format "42s ago" / "3m ago" / "just now" from a timestamp. */
function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

/** Compact autosave indicator — shows a spinner while saving, a check when
 *  recently saved, and a warning on failure. Placed in TopBar so the user
 *  always has visibility into save health. */
export function SaveStatusIndicator() {
  const { saveStatus, lastSavedAt, saveFailureMessage, autoSaveEnabled } = useGameStore(
    useShallow(s => ({
      saveStatus: s.saveStatus,
      lastSavedAt: s.lastSavedAt,
      saveFailureMessage: s.saveFailureMessage,
      autoSaveEnabled: s.settings.autoSave,
    })),
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (!autoSaveEnabled && saveStatus === 'idle') return null;

  if (saveStatus === 'saving') {
    return (
      <span
        className="flex items-center gap-1 text-[10px] text-muted-foreground"
        aria-live="polite"
        title="Saving your game…"
      >
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">Saving…</span>
      </span>
    );
  }

  if (saveStatus === 'failed') {
    return (
      <span
        className="flex items-center gap-1 text-[10px] text-destructive"
        aria-live="polite"
        title={saveFailureMessage || 'Save failed'}
      >
        <CloudOff className="w-3 h-3" aria-hidden="true" />
        <span className="hidden sm:inline">Save failed</span>
      </span>
    );
  }

  if (saveStatus === 'saved' && lastSavedAt) {
    const justSaved = now - lastSavedAt < 3000;
    return (
      <span
        className={cn(
          'flex items-center gap-1 text-[10px] transition-colors',
          justSaved ? 'text-emerald-400' : 'text-muted-foreground',
        )}
        aria-live="polite"
        title={`Saved ${formatRelative(lastSavedAt, now)}`}
      >
        {justSaved ? (
          <Check className="w-3 h-3" aria-hidden="true" />
        ) : (
          <Cloud className="w-3 h-3" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {justSaved ? 'Saved' : formatRelative(lastSavedAt, now)}
        </span>
      </span>
    );
  }

  return null;
}
