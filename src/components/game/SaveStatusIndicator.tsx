import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { hapticMedium } from '@/utils/haptics';

const JUST_SAVED_MS = 1500;
const REFRESH_INTERVAL_MS = 15_000;

/** Format "42s ago" / "3m ago" / "just now" from a timestamp. */
function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

/**
 * Settings row for the autosave state — icon + label + relative time, with a
 * "Save now" affordance on the right. Renders nothing when autosave is off and
 * the store has never attempted a save (nothing meaningful to show).
 *
 * Previously lived in the top bar as a compact pill; moved into Settings so
 * the header stays quiet and the save state has a dedicated, proper place.
 */
export function SaveStatusIndicator() {
  const { saveStatus, lastSavedAt, saveFailureMessage, autoSaveEnabled } = useGameStore(
    useShallow(s => ({
      saveStatus: s.saveStatus,
      lastSavedAt: s.lastSavedAt,
      saveFailureMessage: s.saveFailureMessage,
      autoSaveEnabled: s.settings.autoSave,
    })),
  );

  // Only tick the clock while we're showing a timestamp, AND only while the
  // tab is visible — no point re-rendering the "saved Xs ago" label when the
  // app is backgrounded. Resumes (and refreshes immediately) on focus.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (saveStatus !== 'saved' || !lastSavedAt) return;
    let id: number | undefined;
    const stop = () => { if (id !== undefined) { window.clearInterval(id); id = undefined; } };
    const start = () => {
      setNow(Date.now());
      id = window.setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    };
    const onVisibility = () => { stop(); if (!document.hidden) start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [saveStatus, lastSavedAt]);

  const handleTap = () => {
    hapticMedium();
    useGameStore.getState().flushSave();
  };

  if (!autoSaveEnabled && saveStatus === 'idle' && !lastSavedAt) return null;

  let icon: React.ReactNode;
  let label: string;
  let detail: string;
  let tone: string;

  if (saveStatus === 'saving') {
    icon = <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />;
    label = 'Saving…';
    detail = 'Writing your progress to this device';
    tone = 'text-muted-foreground';
  } else if (saveStatus === 'failed') {
    icon = <CloudOff className="w-4 h-4" aria-hidden="true" />;
    label = 'Save failed';
    detail = saveFailureMessage || 'Tap "Save now" to retry.';
    tone = 'text-destructive';
  } else if (saveStatus === 'saved' && lastSavedAt) {
    const justSaved = now - lastSavedAt < JUST_SAVED_MS;
    const relative = formatRelative(lastSavedAt, now);
    icon = justSaved
      ? <Check className="w-4 h-4" aria-hidden="true" />
      : <Cloud className="w-4 h-4" aria-hidden="true" />;
    label = justSaved ? 'Just saved' : `Last saved ${relative}`;
    detail = autoSaveEnabled ? 'Autosave is on' : 'Autosave is off';
    tone = justSaved ? 'text-emerald-400' : 'text-muted-foreground';
  } else {
    icon = <Cloud className="w-4 h-4" aria-hidden="true" />;
    label = 'No save yet';
    detail = autoSaveEnabled ? 'Your game will save automatically' : 'Autosave is off — tap "Save now"';
    tone = 'text-muted-foreground';
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className={cn('mt-0.5 shrink-0 transition-colors', tone)} aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className={cn('text-sm leading-tight', saveStatus === 'failed' ? 'text-destructive' : 'text-foreground')}>
            {label}
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleTap}
        disabled={saveStatus === 'saving'}
        aria-label="Save now"
        className={cn(
          'text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0 transition-colors',
          'bg-white/5 border border-white/15 backdrop-blur-md text-foreground/90',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.28)]',
          'hover:bg-white/10 active:bg-white/15 disabled:opacity-50 disabled:cursor-default',
        )}
      >
        Save now
      </button>
    </div>
  );
}
