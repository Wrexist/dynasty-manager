import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { cn } from '@/lib/utils';
import {
  Mail, Trophy, Target, DollarSign, Building2, Calendar, Home,
  Settings, MoreHorizontal, ChevronRight, GitCompare, User, Star, Award, ShoppingBag, Crown, HelpCircle
} from 'lucide-react';
import { hapticLight } from '@/utils/haptics';

interface DrawerItem {
  screen: GameScreen;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface DrawerSection {
  title: string;
  items: DrawerItem[];
}

const drawerSections: DrawerSection[] = [
  {
    title: 'Competition',
    items: [
      { screen: 'inbox', label: 'Inbox', icon: Mail, description: 'Messages & news' },
      { screen: 'league-table', label: 'League', icon: Trophy, description: 'Standings & results' },
      { screen: 'cup', label: 'Cup', icon: Award, description: 'Knockout tournament' },
      { screen: 'calendar', label: 'Calendar', icon: Calendar, description: 'Season schedule' },
    ],
  },
  {
    title: 'Management',
    items: [
      { screen: 'club', label: 'Club', icon: Home, description: 'Club overview & squad info' },
      { screen: 'board', label: 'Board', icon: Target, description: 'Your objectives & job security' },
      { screen: 'finance', label: 'Finance', icon: DollarSign, description: 'Budget, wages & revenue' },
      { screen: 'merchandise', label: 'Merchandise', icon: ShoppingBag, description: 'Products, pricing & campaigns' },
      { screen: 'facilities', label: 'Facilities', icon: Building2, description: 'Stadium & training upgrades' },
    ],
  },
  {
    title: 'Career',
    items: [
      { screen: 'manager-profile', label: 'Profile', icon: User, description: 'Your career history' },
      { screen: 'trophy-cabinet', label: 'Trophies', icon: Trophy, description: 'Your honours & achievements' },
      { screen: 'perks', label: 'Perks', icon: Star, description: 'Earn XP & unlock bonuses' },
      { screen: 'comparison', label: 'Compare', icon: GitCompare, description: 'Side-by-side player stats' },
      { screen: 'hall-of-managers', label: 'Hall of Fame', icon: Trophy, description: 'Cross-save leaderboard' },
      { screen: 'shop', label: 'Shop', icon: Crown, description: 'Dynasty Pro & cosmetics' },
      { screen: 'help', label: 'Game Guide', icon: HelpCircle, description: 'How to play & glossary' },
      { screen: 'settings', label: 'Settings', icon: Settings, description: 'Save, load & preferences' },
    ],
  },
];

export function MoreDrawer() {
  const [open, setOpen] = useState(false);
  const { setScreen, messages, currentScreen, cupState } = useGameStore();
  const unread = messages.filter(m => !m.read).length;
  const hasPendingCupMatch = cupState?.bracket?.some(t => !t.played && (t.homeClubId || t.awayClubId));

  const handleNav = (screen: GameScreen) => {
    hapticLight();
    setScreen(screen);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 relative',
            open ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <div className="relative">
            <MoreHorizontal className={cn('w-5 h-5', open && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
            {(unread > 0 || hasPendingCupMatch) && (
              <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-destructive-foreground">{unread > 9 ? '9+' : unread || '!'}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="bg-card/95 backdrop-blur-xl border-border/50 rounded-t-2xl max-w-lg mx-auto pb-8 max-h-[70vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground font-display text-lg">Quick Access</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {drawerSections.map(section => (
            <div key={section.title}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-3 mb-1">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ screen, label, icon: Icon, description }) => (
                  <button
                    key={screen}
                    onClick={() => handleNav(screen)}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-xl active:scale-[0.98] transition-all",
                      currentScreen === screen
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        {screen === 'inbox' && unread > 0 && (
                          <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold">
                            {unread}
                          </span>
                        )}
                        {screen === 'cup' && hasPendingCupMatch && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
