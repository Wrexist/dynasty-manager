/**
 * One-tap "share this moment" button (G7). Renders a branded story image from
 * the passed `MomentCardData` and hands it to the platform share flow
 * (`shareMomentCard`), degrading share → download exactly like the save backup.
 *
 * - Hides itself when neither share nor download is possible on this platform.
 * - Async with an on-button spinner so it never blocks the celebration UI.
 * - Consent-gated `track('moment_shared')` fires only on a delivered share.
 * - Free for everyone — no Pro gate.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Share2 } from 'lucide-react';
import { detectShareCapability, shareMomentCard, type MomentCardData } from '@/utils/shareCard';
import { track } from '@/utils/analytics';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';

export function ShareMomentButton({ data, label = 'Share this moment', className }: {
  data: MomentCardData;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  // Capability is fixed for the session — evaluate once.
  const capable = useMemo(() => detectShareCapability() !== 'none', []);
  if (!capable) return null;

  const handleClick = async () => {
    if (busy) return;
    hapticMedium();
    setBusy(true);
    try {
      const res = await shareMomentCard(data);
      if (res.ok) {
        track('moment_shared', { type: data.type });
        if (res.method === 'download') toast.success('Image saved — share it anywhere');
      } else if (res.error === 'unsupported') {
        toast.error('Could not create the image right now');
      }
      // 'cancelled' → user dismissed the sheet; stay silent.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        'w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm text-foreground bg-white/[0.06] border border-white/[0.08] active:scale-[0.98] transition-transform disabled:opacity-70',
        className,
      )}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
      {busy ? 'Preparing…' : label}
    </button>
  );
}
