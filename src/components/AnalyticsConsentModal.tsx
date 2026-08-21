import { ShieldCheck, ChartBar } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LiquidButton } from '@/components/game/LiquidButton';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { writeAnalyticsConsent } from '@/store/helpers/persistence';
import { refreshAnalyticsConsent } from '@/utils/analytics';

interface Props {
  open: boolean;
  onChoice: (granted: boolean) => void;
}

/** First-launch consent gate for anonymous analytics. Mandatory opt-in —
 *  defaults to `denied` until the user clicks "Allow". Apple guidelines
 *  (and common-sense privacy) require we don't collect anything until the
 *  user actively agrees. */
export function AnalyticsConsentModal({ open, onChoice }: Props) {
  const choose = (granted: boolean) => {
    hapticLight();
    writeAnalyticsConsent(granted ? 'granted' : 'denied');
    refreshAnalyticsConsent();
    onChoice(granted);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        // Non-dismissible: no close button, no onOpenChange handler. The user
        // must make an explicit choice before the game proceeds.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          'max-w-sm mx-auto overflow-hidden border-0 p-0',
          'bg-gradient-to-br from-[hsl(222_35%_14%/0.88)] via-[hsl(222_30%_9%/0.88)] to-[hsl(222_40%_7%/0.92)]',
          'backdrop-blur-2xl backdrop-saturate-150 rounded-3xl',
          'shadow-[0_0_0_0.5px_rgba(255,255,255,0.22)_inset,inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.45),0_30px_80px_-20px_rgba(0,0,0,0.75)]',
          // Hide the shadcn-injected close button — consent must be explicit.
          '[&>button[type="button"]]:hidden',
        )}
      >
        <div className="relative p-6 space-y-4">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-primary/15 border border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <ChartBar className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center font-display tracking-tight text-lg">
              Help improve Dynasty Manager?
            </DialogTitle>
            <DialogDescription className="text-center text-xs leading-relaxed text-muted-foreground">
              Send anonymous usage stats so we can fix bugs and improve the game.
              You can change this any time in Settings.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl p-3 bg-white/5 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">We collect</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Anonymous game events (app opens, matches, purchases, packs, saves,
                  crash category), the app version, and whole days since you installed.
                </p>
              </div>
            </div>
            <div className="border-t border-white/10" />
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">We do not collect</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Your name, players, tactics, save data, device fingerprints, or IP.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <LiquidButton tone="primary" onClick={() => choose(true)}>
              <span className="flex items-center justify-center gap-2 px-3">Allow anonymous stats</span>
            </LiquidButton>
            <LiquidButton onClick={() => choose(false)}>
              <span className="flex items-center justify-center gap-2 px-3">No thanks</span>
            </LiquidButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
