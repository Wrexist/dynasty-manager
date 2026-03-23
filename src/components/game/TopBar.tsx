import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Calendar, Trophy, Save, ArrowLeft, Star, Check } from 'lucide-react';
import { getXPProgress } from '@/utils/managerPerks';
import { getSuffix } from '@/utils/helpers';
import { DETAIL_SCREENS, BACK_TARGET, SCREEN_TITLES } from '@/config/navigation';
import { hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { useFlash } from '@/hooks/useFlash';

export function TopBar() {
  const { season, week, totalWeeks, playerClubId, clubs, leagueTable, saveGame, currentScreen, previousScreen, setScreen, managerProgression } = useGameStore();
  const club = clubs[playerClubId];
  const entry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = entry ? leagueTable.indexOf(entry) + 1 : '-';
  const xpProgress = getXPProgress(managerProgression);
  const posFlash = useFlash(typeof pos === 'number' ? pos : 0);

  // Save button feedback state
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    saveGame();
    hapticMedium();
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1200);
  };

  // XP bar glow on gain
  const prevXpRef = useRef(xpProgress.percentage);
  const [xpGlow, setXpGlow] = useState(false);
  useEffect(() => {
    if (xpProgress.percentage > prevXpRef.current) {
      setXpGlow(true);
      const timer = setTimeout(() => setXpGlow(false), 1500);
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xpProgress.percentage;
  }, [xpProgress.percentage]);

  if (!club) return null;

  const showBack = DETAIL_SCREENS.includes(currentScreen);
  const backTarget = BACK_TARGET[currentScreen] || previousScreen || 'dashboard';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
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
            <>
              <div className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: club.color }} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{club.shortName}</p>
                <p className={cn('text-[10px] text-muted-foreground', posFlash)}>{pos !== '-' ? `${pos}${getSuffix(Number(pos))}` : ''} in league</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* XP Level Badge */}
          <button
            onClick={() => setScreen('perks')}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            title={`Level ${managerProgression.level} — ${xpProgress.current}/${xpProgress.needed} XP`}
          >
            <Star className="w-3 h-3 fill-primary" />
            <span className="font-bold">Lv.{managerProgression.level}</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Week {week}/{totalWeeks}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="w-3 h-3" />
            <span>S{season}</span>
          </div>
          <button
            onClick={handleSave}
            aria-label="Save game"
            className={cn(
              'p-3 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
              saveState === 'saved' ? 'text-emerald-400' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {saveState === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {/* XP Progress Bar */}
      <div className="max-w-lg mx-auto px-4 pb-1">
        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-primary rounded-full transition-all duration-500',
              xpGlow && 'shadow-[0_0_8px_hsl(43_96%_46%/0.5)] transition-shadow duration-700'
            )}
            style={{ width: `${xpProgress.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
