/**
 * The title screen's settings sheet, split out so it can be lazy-loaded.
 *
 * TitleScreen is eagerly imported by `App.tsx` — it is the first screen and
 * making it lazy would put a round trip in front of the very first paint. But it
 * held a Radix `Sheet` inline, and `Sheet` is built on `@radix-ui/react-dialog`,
 * so the whole dialog primitive sat in the boot graph of every launch for a
 * panel that only opens when the user taps Settings.
 *
 * Extracting it here, behind a `lazy()` on the title screen, keeps the trigger
 * button eager (it is part of the first paint) and defers the ~40 kB gz of
 * dialog until it is actually needed. `SettingsPage` comes along for the ride
 * for the same reason.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SettingsBody } from '../SettingsPage';

interface TitleSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TitleSettingsSheet({ open, onOpenChange }: TitleSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-background border-border/50 rounded-t-2xl h-[85vh] max-h-[85vh] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Settings</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
          <SettingsBody variant="title" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TitleSettingsSheet;
