import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, TrendingDown, Minus, Zap, Shield, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { xpForLevel } from '@/utils/managerPerks';
import { getSuffix } from '@/utils/helpers';
import { useScrollLock } from '@/hooks/useScrollLock';

interface PostMatchPopupProps {
  onContinue: () => void;
}

export function PostMatchPopup({ onContinue }: PostMatchPopupProps) {
  const { currentMatchResult, clubs, playerClubId, preMatchLeaguePosition, lastMatchXPGain, leagueTable, managerProgression, matchPlayerRatings, players } = useGameStore();

  useScrollLock(!!currentMatchResult);

  if (!currentMatchResult) return null;

  const isHome = currentMatchResult.homeClubId === playerClubId;
  const goalsFor = isHome ? currentMatchResult.homeGoals : currentMatchResult.awayGoals;
  const goalsAgainst = isHome ? currentMatchResult.awayGoals : currentMatchResult.homeGoals;
  const won = goalsFor > goalsAgainst;
  const lost = goalsFor < goalsAgainst;


  const homeClub = clubs[currentMatchResult.homeClubId];
  const awayClub = clubs[currentMatchResult.awayClubId];

  // Current league position
  const currentEntry = leagueTable.find(e => e.clubId === playerClubId);
  const currentPosition = currentEntry ? leagueTable.indexOf(currentEntry) + 1 : preMatchLeaguePosition;
  const positionChange = preMatchLeaguePosition - currentPosition; // positive = moved up

  // Clean sheet
  const cleanSheet = goalsAgainst === 0;

  // MOTM: highest rated player from player's club
  const clubRatings = matchPlayerRatings
    .filter(r => players[r.playerId]?.clubId === playerClubId)
    .sort((a, b) => b.rating - a.rating);
  const motm = clubRatings[0];
  const motmPlayer = motm ? players[motm.playerId] : null;

  // XP progress
  const xpNeeded = xpForLevel(managerProgression.level);
  const xpProgress = Math.min(100, Math.round((managerProgression.xp / xpNeeded) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      style={{ touchAction: 'none' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <GlassPanel className="p-5 space-y-4 border-primary/30">
          {/* Result Banner */}
          <div className={cn(
            'text-center py-3 rounded-lg',
            won ? 'bg-emerald-500/15' : lost ? 'bg-destructive/15' : 'bg-amber-500/15'
          )}>
            <p className={cn(
              'text-xs font-bold uppercase tracking-wider mb-1',
              won ? 'text-emerald-400' : lost ? 'text-destructive' : 'text-amber-400'
            )}>
              {won ? 'Victory' : lost ? 'Defeat' : 'Draw'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: homeClub?.color, color: homeClub?.secondaryColor }}>
                  {homeClub?.shortName}
                </div>
              </div>
              <div className="text-center">
              <p className="text-2xl font-black text-foreground tabular-nums font-display">
                {currentMatchResult.homeGoals} - {currentMatchResult.awayGoals}
              </p>
              {currentMatchResult.stats?.homeXG != null && (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  xG: {currentMatchResult.stats.homeXG.toFixed(1)} - {(currentMatchResult.stats.awayXG ?? 0).toFixed(1)}
                </p>
              )}
            </div>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: awayClub?.color, color: awayClub?.secondaryColor }}>
                  {awayClub?.shortName}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* XP Gained */}
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-1">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-bold text-primary tabular-nums">+{lastMatchXPGain}</p>
              <p className="text-[9px] text-muted-foreground">XP Gained</p>
            </div>

            {/* League Position */}
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center mx-auto mb-1">
                {positionChange > 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> :
                 positionChange < 0 ? <TrendingDown className="w-4 h-4 text-destructive" /> :
                 <Minus className="w-4 h-4 text-muted-foreground" />}
              </div>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                positionChange > 0 ? 'text-emerald-400' : positionChange < 0 ? 'text-destructive' : 'text-foreground'
              )}>
                {currentPosition}{getSuffix(currentPosition)}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {positionChange > 0 ? `Up ${positionChange}` : positionChange < 0 ? `Down ${Math.abs(positionChange)}` : 'No change'}
              </p>
            </div>

            {/* Clean Sheet or Goals */}
            <div className="text-center">
              <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center mx-auto mb-1">
                {cleanSheet ? <Shield className="w-4 h-4 text-emerald-400" /> : <Trophy className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {cleanSheet ? 'Yes' : `${goalsFor}`}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {cleanSheet ? 'Clean Sheet' : goalsFor === 1 ? 'Goal Scored' : 'Goals Scored'}
              </p>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Level {managerProgression.level}</span>
              <span className="text-primary font-semibold">{managerProgression.xp}/{xpNeeded} XP</span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: `${Math.max(0, xpProgress - (lastMatchXPGain / xpNeeded) * 100)}%` }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          </div>

          {/* MOTM */}
          {motmPlayer && motm && (
            <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
              <Star className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Man of the Match</p>
                <p className="text-xs font-semibold text-foreground truncate">{motmPlayer.firstName} {motmPlayer.lastName}</p>
              </div>
              <span className="text-sm font-bold text-primary tabular-nums">{motm.rating.toFixed(1)}</span>
            </div>
          )}

          <Button className="w-full h-11 text-sm font-bold" onClick={onContinue}>
            Continue
          </Button>
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}
