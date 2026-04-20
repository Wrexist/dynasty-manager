import { useState, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import { cn } from '@/lib/utils';
import {
  Mail, Trophy, Target, DollarSign, Building2, Calendar, Home,
  Settings, MoreHorizontal, ChevronRight, ChevronDown, GitCompare, User, Star, Award, ShoppingBag, Crown, HelpCircle, Globe, Briefcase, Search
} from 'lucide-react';
import { hapticLight } from '@/utils/haptics';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PINNED_DRAWER_SCREENS, DRAWER_PROGRESSIVE_SCREENS, UNEMPLOYED_ALLOWED_SCREENS } from '@/config/navigation';
import { NEW_PLAYER_DRAWER_WEEK_THRESHOLD } from '@/config/ui';
import { getSuffix } from '@/utils/helpers';
import { useCareerUnemployed } from '@/hooks/useGameSelectors';

interface DrawerItem {
  screen: GameScreen;
  label: string;
  icon: React.ElementType;
  description: string;
  gold?: boolean;
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
      { screen: 'league-cup', label: 'League Cup', icon: Award, description: 'Secondary cup competition' },
      { screen: 'champions-cup', label: 'Champions Cup', icon: Trophy, description: 'Elite continental tournament' },
      { screen: 'shield-cup', label: 'Shield Cup', icon: Trophy, description: 'Secondary continental cup' },
      { screen: 'conference-cup', label: 'Conference Cup', icon: Award, description: 'Third-tier continental cup' },
      { screen: 'super-cup', label: 'Super Cup', icon: Award, description: 'Season-opening showcase' },
      { screen: 'national-team', label: 'National Team', icon: Globe, description: 'International management' },
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
      { screen: 'ballon-dor', label: "Ballon d'Or", icon: Award, description: 'Top 25 players each season' },
      { screen: 'perks', label: 'Perks', icon: Star, description: 'Earn XP & unlock bonuses' },
      { screen: 'comparison', label: 'Compare', icon: GitCompare, description: 'Side-by-side player stats' },
      { screen: 'hall-of-managers', label: 'Hall of Fame', icon: Trophy, description: 'Cross-save leaderboard' },
      { screen: 'shop', label: 'Shop', icon: Crown, description: 'Dynasty Pro & cosmetics', gold: true },
      { screen: 'help', label: 'Game Guide', icon: HelpCircle, description: 'How to play & glossary' },
      { screen: 'settings', label: 'Settings', icon: Settings, description: 'Save, load & preferences' },
    ],
  },
];

// Career mode items to prepend to the Career section
const CAREER_MODE_ITEMS: DrawerItem[] = [
  { screen: 'career-overview', label: 'Career Overview', icon: Briefcase, description: 'Your stats, traits & reputation' },
  { screen: 'job-market', label: 'Job Market', icon: Globe, description: 'Browse vacancies & offers' },
];

// Build a lookup for pinned items from drawer sections (preserves icon/label/description)
const ALL_ITEMS: DrawerItem[] = drawerSections.flatMap(s => s.items);
const PINNED_ITEMS = PINNED_DRAWER_SCREENS.map(screen => ALL_ITEMS.find(i => i.screen === screen)).filter(Boolean) as DrawerItem[];
const PINNED_SET = new Set(PINNED_DRAWER_SCREENS);

// Sections that collapse by default for new players
const NEW_PLAYER_COLLAPSED_SECTIONS = new Set(['Management', 'Career']);

interface MoreDrawerProps {
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MoreDrawer({ disabled, open: openProp, onOpenChange }: MoreDrawerProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = useCallback((next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setOpenInternal(next);
  }, [onOpenChange]);
  const [search, setSearch] = useState('');
  const reduceMotion = useReducedMotion();
  const {
    messages, currentScreen, cup, leagueCup, gameMode, nationalTeamOffer,
    championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup,
    internationalTournament, nationalTeam, season, week,
    fixtures, playerClubId, leagueTable,
  } = useGameStore(useShallow(s => ({
    messages: s.messages, currentScreen: s.currentScreen, cup: s.cup, leagueCup: s.leagueCup,
    gameMode: s.gameMode, nationalTeamOffer: s.nationalTeamOffer,
    championsCup: s.championsCup, shieldCup: s.shieldCup, conferenceCup: s.conferenceCup,
    domesticSuperCup: s.domesticSuperCup, continentalSuperCup: s.continentalSuperCup,
    internationalTournament: s.internationalTournament, nationalTeam: s.nationalTeam,
    season: s.season, week: s.week,
    fixtures: s.fixtures, playerClubId: s.playerClubId, leagueTable: s.leagueTable,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const isUnemployed = useCareerUnemployed();
  const unread = messages.filter(m => !m.read).length;
  const hasPendingCupMatch = cup?.ties?.some(t => !t.played && (t.homeClubId || t.awayClubId));
  const hasPendingLeagueCupMatch = leagueCup?.ties?.some(t => !t.played && (t.homeClubId || t.awayClubId));

  // Contextual data for pinned items
  const hasMatchThisWeek = useMemo(() =>
    fixtures.some(m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)),
    [fixtures, week, playerClubId]
  );
  const leaguePosition = useMemo(() => {
    const entry = leagueTable.find(e => e.clubId === playerClubId);
    return entry ? leagueTable.indexOf(entry) + 1 : null;
  }, [leagueTable, playerClubId]);

  const isNewPlayer = season === 1 && week <= NEW_PLAYER_DRAWER_WEEK_THRESHOLD;

  // Section collapse state — smart defaults for new players
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((title: string) => {
    hapticLight();
    setCollapsed(prev => {
      const currentlyCollapsed = prev[title] !== undefined
        ? prev[title]
        : (isNewPlayer && NEW_PLAYER_COLLAPSED_SECTIONS.has(title));
      return { ...prev, [title]: !currentlyCollapsed };
    });
  }, [isNewPlayer]);

  // Compute effective collapsed state: use explicit toggle if set, otherwise smart default
  const isSectionCollapsed = useCallback((title: string) => {
    if (collapsed[title] !== undefined) return collapsed[title];
    return isNewPlayer && NEW_PLAYER_COLLAPSED_SECTIONS.has(title);
  }, [collapsed, isNewPlayer]);

  // Hide competition screens when the player isn't participating
  const hiddenScreens = useMemo(() => {
    const hidden = new Set<GameScreen>();
    if (!championsCup) hidden.add('champions-cup');
    if (!shieldCup) hidden.add('shield-cup');
    if (!conferenceCup) hidden.add('conference-cup');
    if (!domesticSuperCup && !continentalSuperCup) hidden.add('super-cup');
    if (!internationalTournament && !nationalTeam) hidden.add('national-team');
    return hidden;
  }, [championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup, internationalTournament, nationalTeam]);

  const handleNav = useCallback((screen: GameScreen) => {
    hapticLight();
    setScreen(screen);
    setOpen(false);
  }, [setScreen, setOpen]);

  const isSearching = search.trim().length > 0;
  const searchLower = search.toLowerCase();

  return (
    <Sheet open={open} onOpenChange={(v) => { if (disabled && v) return; setOpen(v); if (!v) setSearch(''); }}>
      <SheetTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-full transition-colors min-h-[44px]',
            disabled ? 'pointer-events-none' : open ? 'text-primary-foreground' : 'text-foreground/70',
          )}
          aria-disabled={disabled || undefined}
        >
          {open && (
            <motion.span
              layoutId="bottom-tab-pill"
              initial={false}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }
              }
              className="absolute inset-0 rounded-full bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_2px_8px_hsl(var(--primary)/0.3)] will-change-transform"
            />
          )}
          <span className="relative inline-flex flex-col items-center gap-0.5">
            <span className="relative">
              <MoreHorizontal className="w-5 h-5" />
              {(unread > 0 || (!isUnemployed && hasPendingCupMatch)) && (
                <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-destructive rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold text-destructive-foreground">{unread > 9 ? '9+' : unread || '!'}</span>
                </div>
              )}
            </span>
            <span className="text-[10px] font-medium">More</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="bg-card/95 backdrop-blur-xl border-border/50 rounded-t-2xl max-w-lg mx-auto pb-8 max-h-[70vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground font-display text-lg">Quick Access</SheetTitle>
        </SheetHeader>

        {/* Pinned essentials row */}
        {!isSearching && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PINNED_ITEMS.filter(i => !isUnemployed || UNEMPLOYED_ALLOWED_SCREENS.has(i.screen)).map(({ screen, label, icon: Icon }) => (
              <button
                key={screen}
                onClick={() => handleNav(screen)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl active:scale-[0.96] transition-all min-h-[56px] justify-center",
                  currentScreen === screen
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted/30 hover:bg-muted/50"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 text-primary" />
                  {screen === 'inbox' && unread > 0 && (
                    <div className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 bg-destructive rounded-full flex items-center justify-center px-1">
                      <span className="text-[9px] font-bold text-destructive-foreground">{unread > 9 ? '9+' : unread}</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium text-foreground">{label}</span>
                {/* Contextual hints on pinned items */}
                {screen === 'calendar' && hasMatchThisWeek && (
                  <span className="text-[9px] text-emerald-400 font-semibold -mt-1">Match Day</span>
                )}
                {screen === 'league-table' && leaguePosition && (
                  <span className="text-[9px] text-muted-foreground -mt-1">{leaguePosition}{getSuffix(leaguePosition)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all features..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="space-y-3">
          {drawerSections.map(section => {
            // In career mode, prepend career-specific items to the Career section
            const baseItems = (section.title === 'Career' && gameMode === 'career')
              ? [...CAREER_MODE_ITEMS, ...section.items]
              : section.items;
            // Hide competitions the player isn't participating in
            let visibleItems = baseItems.filter(i => !hiddenScreens.has(i.screen));
            // Hide club-specific screens when unemployed
            if (isUnemployed) visibleItems = visibleItems.filter(i => UNEMPLOYED_ALLOWED_SCREENS.has(i.screen));

            if (isSearching) {
              // When searching, show ALL items (including progressive ones) that match
              const items = visibleItems.filter(i =>
                i.label.toLowerCase().includes(searchLower) || i.description.toLowerCase().includes(searchLower)
              );
              if (items.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-3 mb-1">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {items.map(item => (
                      <DrawerListItem
                        key={item.screen}
                        item={item}
                        currentScreen={currentScreen}
                        onNav={handleNav}
                        unread={unread}
                        hasPendingCupMatch={hasPendingCupMatch}
                        hasPendingLeagueCupMatch={hasPendingLeagueCupMatch}
                        nationalTeamOffer={nationalTeamOffer}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            // Progressive disclosure: hide advanced items for new players (but not from search)
            visibleItems = visibleItems.filter(i => {
              const minSeason = DRAWER_PROGRESSIVE_SCREENS[i.screen];
              return !minSeason || season >= minSeason;
            });

            // Remove pinned items from section lists to avoid duplication
            visibleItems = visibleItems.filter(i => !PINNED_SET.has(i.screen));

            if (visibleItems.length === 0) return null;

            const sectionCollapsed = isSectionCollapsed(section.title);

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 -my-1 rounded-lg active:bg-muted/30 transition-colors"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {section.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground/50">
                    {visibleItems.length}
                  </span>
                  <ChevronDown className={cn(
                    "w-3 h-3 text-muted-foreground/50 transition-transform duration-200 ml-auto",
                    sectionCollapsed && "-rotate-90"
                  )} />
                </button>
                <AnimatePresence initial={false}>
                  {sectionCollapsed ? (
                    <motion.p
                      key="peek"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10px] text-muted-foreground/40 px-3 pb-1 truncate overflow-hidden"
                    >
                      {visibleItems.map(i => i.label).join(' \u00b7 ')}
                    </motion.p>
                  ) : (
                    <motion.div
                      key="list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5">
                        {visibleItems.map(item => (
                          <DrawerListItem
                            key={item.screen}
                            item={item}
                            currentScreen={currentScreen}
                            onNav={handleNav}
                            unread={unread}
                            hasPendingCupMatch={hasPendingCupMatch}
                            hasPendingLeagueCupMatch={hasPendingLeagueCupMatch}
                            nationalTeamOffer={nationalTeamOffer}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Extracted as a proper component for clean key handling and potential memoization
function DrawerListItem({ item, currentScreen, onNav, unread, hasPendingCupMatch, hasPendingLeagueCupMatch, nationalTeamOffer }: {
  item: DrawerItem;
  currentScreen: GameScreen;
  onNav: (screen: GameScreen) => void;
  unread: number;
  hasPendingCupMatch: boolean | undefined;
  hasPendingLeagueCupMatch: boolean | undefined;
  nationalTeamOffer: { status: string } | null | undefined;
}) {
  const { screen, label, icon: Icon, description, gold } = item;
  return (
    <button
      onClick={() => onNav(screen)}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl active:scale-[0.98] transition-all",
        currentScreen === screen
          ? "bg-primary/10 border border-primary/30"
          : gold
            ? "bg-[hsl(var(--gold)/0.05)] hover:bg-[hsl(var(--gold)/0.1)]"
            : "hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        gold ? "bg-[hsl(var(--gold)/0.1)]" : "bg-muted/50"
      )}>
        <Icon className={cn("w-5 h-5", gold ? "text-[hsl(var(--gold))]" : "text-primary")} />
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
          {screen === 'league-cup' && hasPendingLeagueCupMatch && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
              LIVE
            </span>
          )}
          {screen === 'national-team' && nationalTeamOffer?.status === 'pending' && (
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className={cn("w-4 h-4 shrink-0", gold ? "text-[hsl(var(--gold)/0.5)]" : "text-muted-foreground")} />
    </button>
  );
}
