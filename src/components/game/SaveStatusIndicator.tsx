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

/** Compact autosave indicator — spinner while saving, a green check when
 *  freshly saved, muted "Xm ago" afterwards, destructive state on failure.
 *  Tappable to force a manual save. */
export function SaveStatusIndicator() {
  const { saveStatus, lastSavedAt, saveFailureMessage, autoSaveEnabled } = useGameStore(
    useShallow(s => ({
      saveStatus: s.saveStatus,
      lastSavedAt: s.lastSavedAt,
      saveFailureMessage: s.saveFailureMessage,
      autoSaveEnabled: s.settings.autoSave,
    })),
  );

  // Only tick the clock while we're showing a timestamp. No interval for
  // idle/saving/failed, and cleanup is automatic when deps change.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (saveStatus !== 'saved' || !lastSavedAt) return;
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [saveStatus, lastSavedAt]);

  const handleTap = () => {
    hapticMedium();
    useGameStore.getState().flushSave();
  };

  if (!autoSaveEnabled && saveStatus === 'idle') return null;

  let content: { icon: React.ReactNode; text: string; className: string; label: string } | null = null;

  if (saveStatus === 'saving') {
    content = {
      icon: <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />,
      text: 'Saving…',
      className: 'text-muted-foreground',
      label: 'Saving your game',
    };
  } else if (saveStatus === 'failed') {
    const reason = saveFailureMessage ? ` — ${saveFailureMessage}` : '';
    content = {
      icon: <CloudOff className="w-3 h-3" aria-hidden="true" />,
      text: 'Save failed',
      className: 'text-destructive',
      label: `Save failed${reason}. Tap to retry.`,
    };
  } else if (saveStatus === 'saved' && lastSavedAt) {
    const justSaved = now - lastSavedAt < JUST_SAVED_MS;
    const relative = formatRelative(lastSavedAt, now);
    content = {
      icon: justSaved
        ? <Check className="w-3 h-3" aria-hidden="true" />
        : <Cloud className="w-3 h-3" aria-hidden="true" />,
      text: justSaved ? 'Saved' : relative,
      className: justSaved ? 'text-emerald-400' : 'text-muted-foreground',
      label: `Saved ${relative} — tap to save now`,
    };
  }

  if (!content) return null;

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={content.label}
      aria-live="polite"
      title={content.label}
      className={cn(
        'flex items-center gap-1 text-[10px] transition-colors duration-500 px-1 -mx-1 rounded hover:bg-muted/40',
        content.className,
      )}
    >
      {content.icon}
      <span className="hidden sm:inline">{content.text}</span>
    </button>
  );
}
