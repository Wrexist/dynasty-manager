import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}

/**
 * Apple-style "Liquid Glass" confirm dialog.
 *
 * The container uses the same gradient + backdrop-blur + multi-layer inset
 * shadow recipe as `<GlassPanel>` (see GlassPanel.tsx) with an additional
 * specular crescent overlay for the polished-glass highlight. Buttons are
 * wide rounded pills with a glassy Cancel and a solid Confirm.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'destructive',
  onConfirm,
}: ConfirmDialogProps) {
  const handleCancel = () => { hapticLight(); onOpenChange(false); };
  const handleConfirm = () => { hapticLight(); onConfirm(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Sizing + layout
          'max-w-sm w-[calc(100%-2rem)] mx-auto p-5 gap-3',
          // Liquid-glass surface (gradient + blur + multi-layer rim)
          'rounded-3xl border-0 transform-gpu overflow-hidden',
          'bg-gradient-to-br from-[hsl(222_35%_14%/0.78)] via-[hsl(222_28%_10%/0.82)] to-[hsl(222_40%_7%/0.9)]',
          'backdrop-blur-2xl backdrop-saturate-150',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.4),0_30px_60px_-20px_rgba(0,0,0,0.7)]',
        )}
      >
        {/* Specular crescent — bright sky reflected on polished glass.
            Matches GlassPanel's overlay for a consistent material across
            cards and modals. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 32%, rgba(255,255,255,0) 62%)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Edge refraction streak on the left — thin bright rim that catches
            light, completing the "thick glass" illusion. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-3 left-0 w-px"
          style={{
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0.18) 65%, rgba(255,255,255,0) 100%)',
          }}
        />

        <DialogHeader className="relative space-y-1.5 text-center">
          <DialogTitle className="text-[17px] font-semibold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="relative flex-row gap-2 pt-1 sm:flex-row sm:justify-stretch sm:space-x-0">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              'flex-1 h-11 rounded-2xl text-[14px] font-semibold transition-all',
              'bg-white/[0.06] text-foreground hover:bg-white/[0.10] active:scale-[0.98]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_0_0_1px_rgba(255,255,255,0.06)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              'flex-1 h-11 rounded-2xl text-[14px] font-semibold transition-all active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_-8px_hsl(0_72%_51%/0.6)] focus-visible:ring-destructive/60'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_20px_-8px_hsl(43_96%_46%/0.55)] focus-visible:ring-primary/60',
            )}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
