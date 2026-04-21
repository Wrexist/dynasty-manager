import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CommunityPackPopupProps {
  open: boolean;
  onChoice: (enabled: boolean) => void;
  onClose: () => void;
}

export function CommunityPackPopup({ open, onChoice, onClose }: CommunityPackPopupProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl bg-card/90 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="font-display text-foreground">Community Pack</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Play with real players and real squads, a dynamic transfer market,
            new leagues, and ratings inspired by FC26.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full"
            onClick={() => onChoice(true)}
          >
            Enable Real Players
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onChoice(false)}
          >
            Generated Players
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
