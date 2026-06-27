import { useState } from 'react';
import { CloudUpload, CloudDownload } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { LiquidButton } from '@/components/game/LiquidButton';
import { successToast, errorToast } from '@/utils/gameToast';
import { hapticMedium } from '@/utils/haptics';
import { backupSlot, restoreSlot, type CloudReason } from '@/utils/cloudSave';

const REASON_MSG: Record<CloudReason, string> = {
  unconfigured: 'Cloud backup is not available on this build.',
  unavailable: 'Could not reach the cloud. Check your connection and try again.',
  empty: 'There is no save in this slot to back up yet.',
  not_found: 'No cloud backup was found for this slot.',
  corrupt: 'The cloud backup was unreadable — your local save was left untouched.',
  error: 'Something went wrong. Please try again.',
};

/**
 * Manual cloud Back up / Restore for the active save slot (Online Slice 1).
 *
 * Only rendered when the Supabase backend is configured (the caller gates on
 * `isCloudConfigured()`), so on un-provisioned builds it never appears. Sync is
 * deliberately manual: the player chooses when to push to / pull from the
 * cloud, and a restore overwrites the local slot only after the download
 * validates (see cloudSave.ts).
 */
export function CloudBackupSection() {
  const activeSlot = useGameStore(s => s.activeSlot);
  const loadGame = useGameStore(s => s.loadGame);
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const onBackup = async () => {
    hapticMedium();
    setBusy('backup');
    const r = await backupSlot(activeSlot);
    setBusy(null);
    if (r.ok) successToast('Backed Up', 'Your save is safe in the cloud.');
    else errorToast('Backup Failed', REASON_MSG[r.reason ?? 'error']);
  };

  const onRestore = async () => {
    hapticMedium();
    setBusy('restore');
    const r = await restoreSlot(activeSlot);
    setConfirmRestore(false);
    if (!r.ok) {
      setBusy(null);
      errorToast('Restore Failed', REASON_MSG[r.reason ?? 'error']);
      return;
    }
    // The download is now in the local slot — load it so the player sees it.
    const loaded = loadGame(activeSlot);
    setBusy(null);
    if (loaded) successToast('Restored', 'Your cloud save is now loaded.');
    else errorToast('Restore Failed', 'The save was downloaded but could not be loaded.');
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground leading-snug">
        Back up the current save (slot {activeSlot}) to the cloud, or restore it on a new device.
        Nothing syncs automatically — you choose when.
      </p>
      <LiquidButton onClick={onBackup} disabled={busy !== null}>
        <span className="flex items-center justify-start gap-3 px-3">
          <CloudUpload className="w-4 h-4" />
          {busy === 'backup' ? 'Backing up…' : 'Back Up to Cloud'}
        </span>
      </LiquidButton>
      {!confirmRestore ? (
        <LiquidButton tone="amber" onClick={() => setConfirmRestore(true)} disabled={busy !== null}>
          <span className="flex items-center justify-start gap-3 px-3">
            <CloudDownload className="w-4 h-4" />
            Restore from Cloud
          </span>
        </LiquidButton>
      ) : (
        <div className="flex gap-2">
          <LiquidButton tone="amber" className="flex-1" onClick={onRestore} disabled={busy !== null}>
            {busy === 'restore' ? 'Restoring…' : `Overwrite Slot ${activeSlot}`}
          </LiquidButton>
          <LiquidButton className="flex-1" onClick={() => setConfirmRestore(false)} disabled={busy !== null}>
            Cancel
          </LiquidButton>
        </div>
      )}
    </div>
  );
}
