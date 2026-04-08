import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Calendar, Settings, ArrowLeft, Star, Mail } from 'lucide-react';
import { getXPProgress } from '@/utils/managerPerks';
import { getReputationTierLabel, getReputationTierShortLabel } from '@/utils/managerCareer';
import { getSuffix } from '@/utils/helpers';
import { getRecentForm } from '@/utils/formGuide';
import { LEAGUES } from '@/data/league';
import { DETAIL_SCREENS, BACK_TARGET, SCREEN_TITLES } from '@/config/navigation';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { useFlash } from '@/hooks/useFlash';
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
  const club = clubs[playerClubId];
  const entry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = entry ? leagueTable.indexOf(entry) + 1 : '-';
  const xpProgress = getXPProgress(managerProgression);
  const posFlash = useFlash(typeof pos === 'number' ? pos : 0);
  const reputationTier = careerManager?.reputationTier ?? 'unknown';
  const reputationLabel = getReputationTierShortLabel(reputationTier);
  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const league = LEAGUES.find(l => l.id === playerDivision);
  const recentForm = useMemo(() => getRecentForm(playerClubId, fixtures), [playerClubId, fixtures]);
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

  if (!club) return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
      <div className="flex items-center justify-center h-14 px-4 max-w-lg mx-auto">
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    </header>
  );

  const showBack = DETAIL_SCREENS.includes(currentScreen);
  const backTarget = BACK_TARGET[currentScreen] || previousScreen || 'dashboard';

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={() => setScreen(backTarget)}
              aria-label="Go back"
              className="p-3 -ml-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {showBack && SCREEN_TITLES[currentScreen] ? (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{SCREEN_TITLES[currentScreen]}</p>
              <p className={cn('text-[10px] text-muted-foreground truncate', posFlash)}>{club.shortName} {pos !== '-' ? `· ${pos}${getSuffix(Number(pos))}` : ''}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: club.color }} />
              {hasPlayedMatches && (
                <div className="flex items-center gap-0.5">
                  {recentForm.map((r, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white',
                        r === 'W' ? 'bg-emerald-500' : r === 'D' ? 'bg-amber-500' : 'bg-destructive'
                      )}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setScreen('inbox'); hapticMedium(); }}
            aria-label={unreadCount > 0 ? `Inbox — ${unreadCount} unread` : 'Inbox'}
            className="relative p-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Mail className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* Career mode: reputation badge or XP Level */}
          {gameMode === 'career' && careerManager ? (
            <button
              onClick={() => setScreen('career-overview')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title={`${getReputationTierLabel(reputationTier)} (${Math.round(careerManager.reputationScore)})`}
            >
              <Star className="w-3 h-3 fill-primary" />
              <span className="font-bold capitalize">{reputationLabel}</span>
            </button>
          ) : (
            <button
              onClick={() => setScreen('perks')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title={`Level ${managerProgression.level} — ${xpProgress.current}/${xpProgress.needed} XP`}
            >
              <Star className="w-3 h-3 fill-primary" />
              <span className="font-bold">Lv.{managerProgression.level}</span>
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>W{week} · S{season}</span>
          </div>
          <button
            onClick={() => { setScreen('settings'); hapticMedium(); }}
            aria-label="Settings"
            className="p-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* XP Progress Bar */}
      <div className="max-w-lg mx-auto px-4 pb-1">
        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-primary rounded-full transition-all duration-500',
              xpGlow && 'shadow-[0_0_8px_hsl(var(--primary)/0.5)] transition-shadow duration-700'
            )}
            style={{ width: `${xpProgress.percentage}%` }}
          />
        </div>
      </div>
    </header>
  );
}
