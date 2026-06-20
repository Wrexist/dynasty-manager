import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Settings, ArrowLeft, Star, Mail, Crown, Briefcase } from 'lucide-react';
import { getXPProgress } from '@/utils/managerPerks';
import { getReputationTierLabel, getReputationTierShortLabel } from '@/utils/managerCareer';
import { getSuffix } from '@/utils/helpers';
import { getRecentForm } from '@/utils/formGuide';
import { FormGuide } from '@/components/game/FormGuide';
import { CountBadge } from '@/components/game/CountBadge';
import { FlagIcon } from '@/components/game/FlagIcon';
import { LEAGUES } from '@/data/league';
import { DETAIL_SCREENS, BACK_TARGET, SCREEN_TITLES, UNEMPLOYED_MAIN_TABS } from '@/config/navigation';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { useFlash } from '@/hooks/useFlash';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';
import { XP_GLOW_MS } from '@/config/ui';

export function TopBar() {
  const {
    playerClubId, clubs, leagueTable, playerDivision, fixtures,
    currentScreen, previousScreen, managerProgression, gameMode, careerManager,
    messages, managerNationality, internationalTournament,
  } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, leagueTable: s.leagueTable,
    playerDivision: s.playerDivision, fixtures: s.fixtures,
    currentScreen: s.currentScreen, previousScreen: s.previousScreen,
    managerProgression: s.managerProgression, gameMode: s.gameMode, careerManager: s.careerManager,
    messages: s.messages, managerNationality: s.managerNationality, internationalTournament: s.internationalTournament,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const club = clubs[playerClubId];
  const entry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = entry ? leagueTable.indexOf(entry) + 1 : '-';
  const xpProgress = getXPProgress(managerProgression);
  const posFlash = useFlash(typeof pos === 'number' ? pos : 0);
  const reputationTier = careerManager?.reputationTier ?? 'unknown';
  const reputationLabel = getReputationTierShortLabel(reputationTier);
  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const league = LEAGUES.find(l => l.id === playerDivision);
  const recentForm = useMemo(() => getRecentForm(playerClubId, fixtures, 3), [playerClubId, fixtures]);
  const hasPlayedMatches = recentForm.length > 0;

  // XP bar glow on gain
  const prevXpRef = useRef(xpProgress.percentage);
  const [xpGlow, setXpGlow] = useState(false);
  useEffect(() => {
    if (xpProgress.percentage > prevXpRef.current) {
      setXpGlow(true);
      const timer = setTimeout(() => setXpGlow(false), XP_GLOW_MS);
      prevXpRef.current = xpProgress.percentage;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xpProgress.percentage;
  }, [xpProgress.percentage]);

  // World Cup mode has no club — show a nation + tournament-round header
  // instead of the club/league chrome. Display-only (the squad picker and
  // tournament pages carry their own controls), keeping navigation linear.
  if (gameMode === 'world-cup') {
    const t = internationalTournament;
    const roundLabel = !t ? 'World Cup'
      : t.phase === 'group' ? 'Group Stage'
      : t.phase === 'complete' ? 'Final Result'
      : ({ R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' }[t.currentRound || ''] || 'Knockout');
    return (
      <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/95 border-b border-border/30 safe-area-top transform-gpu">
        <div className="flex items-center gap-2.5 h-14 px-4 max-w-lg mx-auto">
          {managerNationality && <FlagIcon nationality={managerNationality} size={26} className="rounded-sm shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{managerNationality || 'World Cup'}</p>
            <p className="text-[10px] text-amber-400 truncate font-medium">World Cup · {roundLabel}</p>
          </div>
        </div>
      </header>
    );
  }

  if (!club && !isUnemployed) return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/95 border-b border-border/30 safe-area-top transform-gpu">
      <div className="flex items-center justify-center h-14 px-4 max-w-lg mx-auto">
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    </header>
  );

  // Don't show back arrow on main tabs (including unemployed main tabs like job-market)
  const isMainTab = isUnemployed
    ? UNEMPLOYED_MAIN_TABS.includes(currentScreen)
    : !DETAIL_SCREENS.includes(currentScreen);
  const showBack = !matchLocked && !isMainTab;
  // Context-aware back: when a detail screen was opened *from another detail
  // screen* (e.g. team-detail → player-detail), honour that trail rather than
  // the static BACK_TARGET fallback, so the round back button returns the user
  // to where they actually came from.
  const rawBack = (currentScreen === 'player-detail' && previousScreen === 'team-detail')
    ? 'team-detail'
    : (BACK_TARGET[currentScreen] || previousScreen || 'dashboard');
  // When unemployed, redirect any back target that would hit a club screen to job-market
  const backTarget = isUnemployed
    ? (rawBack === 'dashboard' || rawBack === 'squad' ? 'job-market' : rawBack)
    : rawBack;

  return (
    // `transform-gpu` (translateZ(0)) pins the bar to its own compositor
    // layer that tracks the viewport — this is the same pattern BottomNav
    // uses and is what keeps a `position: fixed` bar from drifting mid-page
    // on iOS WebKit during long scrolls (e.g. the Transfer market list).
    //
    // NOTE: we deliberately do NOT add `contain: layout` here. On iOS
    // WebKit, `contain` on a fixed element makes it establish its own
    // containing block and breaks viewport scroll-tracking, which made the
    // TopBar (but never the contain-free BottomNav) float into the middle
    // of the page after scrolling the Free Agents / Market list.
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/95 border-b border-border/30 safe-area-top transform-gpu">
      {/* XP Progress Bar — positioned at top edge to avoid looking like a tab indicator */}
      <div className="max-w-lg mx-auto px-4 pt-0.5">
        <div className="h-[3px] bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-primary rounded-full transition-all duration-500',
              xpGlow && 'shadow-[0_0_8px_hsl(var(--primary)/0.5)] transition-shadow duration-700'
            )}
            style={{ width: `${xpProgress.percentage}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          {showBack && (
            <button
              onClick={() => { setScreen(backTarget); hapticMedium(); }}
              aria-label="Go back"
              className={cn(
                // Round Liquid Glass back button — translucent, outlined, sees
                // through to the background with subtle refraction + specular
                // highlight. Single source of styling for the top-bar back.
                'group relative shrink-0 w-11 h-11 -ml-1 rounded-full overflow-hidden',
                'flex items-center justify-center text-foreground/90 hover:text-foreground',
                'bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-white/[0.02]',
                'backdrop-blur-xl backdrop-saturate-150',
                'border border-white/25',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-1px_0_rgba(0,0,0,0.35),0_6px_16px_-8px_rgba(0,0,0,0.55)]',
                'transition-[transform,background-color] duration-200',
                'hover:bg-white/[0.08] active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <ArrowLeft className="w-[18px] h-[18px] relative z-10" />
              {/* Specular highlight — bright crescent on top of the glass. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(120% 80% at 50% -20%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 60%)',
                  mixBlendMode: 'screen',
                }}
              />
              {/* Rim refraction — subtle inner bright ring to catch the edge. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.22)',
                }}
              />
            </button>
          )}
          {isUnemployed ? (
            showBack && SCREEN_TITLES[currentScreen] ? (
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{SCREEN_TITLES[currentScreen]}</p>
                <p className="text-[10px] text-muted-foreground truncate">Between Jobs</p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full shrink-0 bg-amber-500/20 flex items-center justify-center">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-amber-400">Between Jobs</span>
              </div>
            )
          ) : showBack && SCREEN_TITLES[currentScreen] ? (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{SCREEN_TITLES[currentScreen]}</p>
              <p className={cn('text-[10px] text-muted-foreground truncate', posFlash)}>{club?.shortName} {pos !== '-' ? `· ${pos}${getSuffix(Number(pos))}` : ''}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: club?.color }} />
              {hasPlayedMatches && <FormGuide form={recentForm} size="sm" />}
              {hasPlayedMatches && pos !== '-' && league && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  Number(pos) <= league.replacedSlots ? 'bg-emerald-500/20 text-emerald-400' :
                  Number(pos) <= league.replacedSlots + 4 ? 'bg-primary/20 text-primary' :
                  Number(pos) > league.teamCount - league.replacedSlots ? 'bg-destructive/20 text-destructive' :
                  'bg-muted/50 text-muted-foreground',
                  posFlash
                )}>
                  {pos}{getSuffix(Number(pos))}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-2", matchLocked && "opacity-40")}>
          <button
            disabled={matchLocked}
            onClick={() => { setScreen('inbox'); hapticMedium(); }}
            aria-label={unreadCount > 0 ? `Inbox — ${unreadCount} unread` : 'Inbox'}
            className="relative p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Mail className="w-4 h-4" />
            <CountBadge
              count={unreadCount}
              pulse
              className="absolute top-0.5 right-0.5"
            />
          </button>
          <button
            disabled={matchLocked}
            onClick={() => { setScreen('shop'); hapticMedium(); }}
            aria-label="Shop"
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Crown className="w-4 h-4 text-[hsl(var(--gold))] drop-shadow-[0_0_4px_hsl(var(--gold)/0.4)]" />
          </button>
          {/* Career mode: reputation badge or XP Level */}
          {gameMode === 'career' && careerManager ? (
            <button
              disabled={matchLocked}
              onClick={() => setScreen('career-overview')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title={`${getReputationTierLabel(reputationTier)} (${Math.round(careerManager.reputationScore)})`}
            >
              <Star className="w-3 h-3 fill-primary" />
              <span className="font-bold capitalize">{reputationLabel}</span>
            </button>
          ) : (
            <button
              disabled={matchLocked}
              onClick={() => setScreen('perks')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title={`Level ${managerProgression.level} — ${xpProgress.current}/${xpProgress.needed} XP`}
            >
              <Star className="w-3 h-3 fill-primary" />
              <span className="font-bold">Lv.{managerProgression.level}</span>
            </button>
          )}
          <button
            disabled={matchLocked}
            onClick={() => { setScreen('settings'); hapticMedium(); }}
            aria-label="Settings"
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
