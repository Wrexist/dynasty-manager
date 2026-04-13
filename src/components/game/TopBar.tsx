import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Calendar, Settings, ArrowLeft, Star, Mail, Crown, Briefcase } from 'lucide-react';
import { getXPProgress } from '@/utils/managerPerks';
import { getReputationTierLabel, getReputationTierShortLabel } from '@/utils/managerCareer';
import { getSuffix } from '@/utils/helpers';
import { getRecentForm } from '@/utils/formGuide';
import { FormGuide } from '@/components/game/FormGuide';
import { LEAGUES } from '@/data/league';
import { DETAIL_SCREENS, BACK_TARGET, SCREEN_TITLES, UNEMPLOYED_MAIN_TABS } from '@/config/navigation';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { useFlash } from '@/hooks/useFlash';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';
import { XP_GLOW_MS } from '@/config/ui';

export function TopBar() {
  const {
    season, week, playerClubId, clubs, leagueTable, playerDivision, fixtures,
    currentScreen, previousScreen, managerProgression, gameMode, careerManager,
    messages,
  } = useGameStore(useShallow(s => ({
    season: s.season, week: s.week,
    playerClubId: s.playerClubId, clubs: s.clubs, leagueTable: s.leagueTable,
    playerDivision: s.playerDivision, fixtures: s.fixtures,
    currentScreen: s.currentScreen, previousScreen: s.previousScreen,
    managerProgression: s.managerProgression, gameMode: s.gameMode, careerManager: s.careerManager,
    messages: s.messages,
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
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xpProgress.percentage;
  }, [xpProgress.percentage]);

  if (!club && !isUnemployed) return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
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
  const rawBack = BACK_TARGET[currentScreen] || previousScreen || 'dashboard';
  // When unemployed, redirect any back target that would hit a club screen to job-market
  const backTarget = isUnemployed
    ? (rawBack === 'dashboard' || rawBack === 'squad' ? 'job-market' : rawBack)
    : rawBack;

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
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
        <div className="flex items-center gap-1.5 min-w-0">
          {showBack && (
            <button
              onClick={() => setScreen(backTarget)}
              aria-label="Go back"
              className="p-2 -ml-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
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
            className="relative p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Mail className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            disabled={matchLocked}
            onClick={() => { setScreen('shop'); hapticMedium(); }}
            aria-label="Shop"
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
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
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            <span>W{week} · S{season}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
