import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { resolveClub } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, TrendingDown, Minus, Zap, Shield, Star, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { xpForLevel, hasPerk } from '@/utils/managerPerks';
import { getSuffix } from '@/utils/helpers';
import { getMatchRatingColor } from '@/utils/uiHelpers';
import { RotateCcw } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { hapticHeavy, hapticLight } from '@/utils/haptics';

interface PostMatchPopupProps {
  onContinue: () => void;
}

export function PostMatchPopup({ onContinue }: PostMatchPopupProps) {
  const { currentMatchResult, clubs, playerClubId, preMatchLeaguePosition, lastMatchXPGain, leagueTable, managerProgression, matchPlayerRatings, players, virtualClubs, invincibleUsedThisSeason, preMatchSnapshot, lastMatchCompetition } = useGameStore(
    useShallow(s => ({
      currentMatchResult: s.currentMatchResult,
      clubs: s.clubs,
      playerClubId: s.playerClubId,
      preMatchLeaguePosition: s.preMatchLeaguePosition,
      lastMatchXPGain: s.lastMatchXPGain,
      leagueTable: s.leagueTable,
      managerProgression: s.managerProgression,
      matchPlayerRatings: s.matchPlayerRatings,
      players: s.players,
      virtualClubs: s.virtualClubs,
      invincibleUsedThisSeason: s.invincibleUsedThisSeason,
      preMatchSnapshot: s.preMatchSnapshot,
      lastMatchCompetition: s.lastMatchCompetition,
    }))
  );
  const rewindMatch = useGameStore(s => s.rewindMatch);

  useScrollLock(!!currentMatchResult);

  if (!currentMatchResult) return null;

  const isHome = currentMatchResult.homeClubId === playerClubId;
  const goalsFor = isHome ? currentMatchResult.homeGoals : currentMatchResult.awayGoals;
  const goalsAgainst = isHome ? currentMatchResult.awayGoals : currentMatchResult.homeGoals;
  const won = goalsFor > goalsAgainst;
  const lost = goalsFor < goalsAgainst;


  const homeClub = resolveClub(clubs, virtualClubs, currentMatchResult.homeClubId);
  const awayClub = resolveClub(clubs, virtualClubs, currentMatchResult.awayClubId);
  if (!homeClub || !awayClub) return null;

  // League position only applies to league matches (non-league = friendlies, cups, super cups)
  const isLeagueMatch = !lastMatchCompetition;
  const currentEntry = leagueTable.find(e => e.clubId === playerClubId);
  const currentPosition = currentEntry ? leagueTable.indexOf(currentEntry) + 1 : preMatchLeaguePosition;
  const positionChange = preMatchLeaguePosition - currentPosition; // positive = moved up

  // Clean sheet
  const cleanSheet = goalsAgainst === 0;

  // Team average match rating (shown in place of league position for non-league games)
  const clubRatingsAll = matchPlayerRatings.filter(r => players[r.playerId]?.clubId === playerClubId);
  const teamAvgRating = clubRatingsAll.length
    ? clubRatingsAll.reduce((sum, r) => sum + r.rating, 0) / clubRatingsAll.length
    : 0;

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
      role="dialog"
      aria-modal="true"
      aria-label="Post-match summary"
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
                <div
                  className="w-9 h-9 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[9px] font-bold relative"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${homeClub?.color} 75%, white) 0%, ${homeClub?.color} 55%, color-mix(in srgb, ${homeClub?.color} 70%, black) 100%)`,
                    color: homeClub?.secondaryColor,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 8px -2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  }}
                >
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
                <div
                  className="w-9 h-9 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[9px] font-bold relative"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${awayClub?.color} 75%, white) 0%, ${awayClub?.color} 55%, color-mix(in srgb, ${awayClub?.color} 70%, black) 100%)`,
                    color: awayClub?.secondaryColor,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 8px -2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  }}
                >
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

            {/* League Position (league only) or Team Rating (friendlies/cups) */}
            {isLeagueMatch ? (
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
            ) : (
              <div className="text-center">
                <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center mx-auto mb-1">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <p className={cn(
                  'text-sm font-bold tabular-nums',
                  teamAvgRating > 0 ? getMatchRatingColor(teamAvgRating) : 'text-muted-foreground'
                )}>
                  {teamAvgRating > 0 ? teamAvgRating.toFixed(1) : '—'}
                </p>
                <p className="text-[9px] text-muted-foreground">Team Rating</p>
              </div>
            )}

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
            <PremiumProgress value={xpProgress} glow />
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

          {lost && hasPerk(managerProgression, 'invincible') && !invincibleUsedThisSeason && preMatchSnapshot && (
            <button
              onClick={() => { hapticHeavy(); rewindMatch(); }}
              className="w-full flex items-center justify-center gap-2 h-10 mb-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/25 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Rewind Match (1 per season)
            </button>
          )}
          <Button className="w-full h-11 text-sm font-bold" onClick={() => { hapticLight(); onContinue(); }}>
            Continue
          </Button>
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}
