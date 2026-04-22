import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CURRENT_VERSION } from '@/utils/saveMigration';

/**
 * Modal that appears when `GameState.loadError` is set — populated by the
 * load path in orchestrationSlice when a slot can't be loaded cleanly.
 * Mounted once at the app root so it can surface from any route.
 *
 * UX:
 *  - Corrupt / migration_failed / validation_failed → "Try Recovery" +
 *    "Skip" (recovery loads the backup, skip just dismisses).
 *  - newer_version → single "OK" action. Refusing to load is the whole
 *    point; there's nothing to recover to.
 */
export function SaveRecoveryDialog() {
  const loadError = useGameStore(s => s.loadError);
  const attemptSaveRecovery = useGameStore(s => s.attemptSaveRecovery);
  const clearLoadError = useGameStore(s => s.clearLoadError);
  const navigate = useNavigate();

  if (!loadError) return null;

  const { kind, slot, reason, saveVersion, canRecover } = loadError;

  const handleRecover = () => {
    const ok = attemptSaveRecovery(slot);
    if (ok) {
      clearLoadError();
      navigate('/game');
    }
    // If recovery fails the slice sets a fresh loadError; this dialog
    // re-renders with canRecover=false and offers only "Skip".
  };

  const handleSkip = () => {
    clearLoadError();
  };

  const { title, body } = messageFor(kind, saveVersion);

  return (
    <Dialog open={true} onOpenChange={(next) => { if (!next) handleSkip(); }}>
      <DialogContent className="max-w-sm mx-auto bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/15 border border-amber-400/30">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-sm leading-relaxed text-foreground/80">
            {body}
          </DialogDescription>
        </DialogHeader>

        {import.meta.env.DEV && reason && (
          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-md p-2 font-mono break-all">
            {reason}
          </p>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {canRecover && (
            <button
              type="button"
              onClick={handleRecover}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Try Recovery from Backup
            </button>
          )}
          <button
            type="button"
            onClick={handleSkip}
            className="w-full h-11 rounded-full bg-white/[0.08] border border-white/15 text-foreground/90 font-semibold text-sm hover:bg-white/[0.12] transition-colors"
          >
            {kind === 'newer_version' ? 'OK' : 'Skip'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function messageFor(kind: NonNullable<ReturnType<typeof useGameStore.getState>['loadError']>['kind'], saveVersion?: number): { title: string; body: string } {
  switch (kind) {
    case 'corrupt':
      return {
        title: 'This save appears corrupted',
        body: "We couldn't read this save file. Your backup slot is also unreadable, so there's nothing to recover from.",
      };
    case 'newer_version':
      return {
        title: 'Save from a newer version',
        body: `This save (v${saveVersion ?? '?'}) was written by a newer version of the game than you have installed (v${CURRENT_VERSION}). Update the app to load it.`,
      };
    case 'validation_failed':
      return {
        title: 'This save appears corrupted',
        body: 'The save file is readable but missing required data. You can try recovering from the backup if one exists.',
      };
    case 'migration_failed':
      return {
        title: 'Save upgrade failed',
        body: 'Something went wrong upgrading this save to the current version. You can try recovering from the backup if one exists.',
      };
  }
}
