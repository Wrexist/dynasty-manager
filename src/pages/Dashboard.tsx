import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { getConfidenceColor, getFanConfidenceColor } from '@/utils/uiHelpers';
import { usePlayerClub, useLeaguePosition, useCurrentMatch, useUnreadCount } from '@/hooks/useGameSelectors';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PressConference } from '@/components/game/PressConference';
import { WelcomeOverlay } from '@/components/game/WelcomeOverlay';
import { Button } from '@/components/ui/button';
import {
  Play, ChevronRight, TrendingUp, DollarSign, Heart, Trophy, Calendar, Mail,
  Dumbbell, AlertTriangle, Banknote, Users, Shield, Settings, BarChart3, UserPlus, Award,
} from 'lucide-react';
import { getRoundName } from '@/data/cup';
import { DIVISIONS } from '@/data/league';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getWeeklyIncome, getNetWeeklyIncome } from '@/utils/financeHelpers';
import { checkCelebrations, getWinStreak } from '@/utils/celebrations';
import type { Celebration } from '@/utils/celebrations';
import { celebrationToast } from '@/utils/gameToast';
import { CelebrationModal } from '@/components/game/CelebrationModal';
import { StorylineModal } from '@/components/game/StorylineModal';
import { FarewellModal } from '@/components/game/FarewellModal';
import { BoardWarning } from '@/components/game/BoardWarning';
import { getWeekPreview } from '@/utils/weekPreview';
import { hapticLight, hapticMedium, hapticHeavy } from '@/utils/haptics';

const WELCOME_KEY = 'dynasty-welcome-shown';

const Dashboard = () => {
  const store = useGameStore();
  const {
    playerClubId, clubs, players, week, season, fixtures, leagueTable,
    boardConfidence, boardObjectives, setScreen, advanceWeek,
    currentMatchResult, messages, incomingOffers, endSeason, trainingFocus, cup,
  } = store;
  const club = usePlayerClub();
  const { match: nextMatch, isHome, opponent } = useCurrentMatch();
  const pos = useLeaguePosition();
  const unread = useUnreadCount();

  const [showWelcome, setShowWelcome] = useState(() => {
    if (season === 1 && week === 1 && !localStorage.getItem(WELCOME_KEY)) return true;
    return false;
  });

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(WELCOME_KEY, '1');
  };

  const [boardWarningDismissed, setBoardWarningDismissed] = useState(false);
  // Reset board warning dismissal when confidence changes significantly
  const prevConfRef = useRef(boardConfidence);
  useEffect(() => {
    if (Math.abs(prevConfRef.current - boardConfidence) >= 5) {
      setBoardWarningDismissed(false);
      prevConfRef.current = boardConfidence;
    }
  }, [boardConfidence]);

  // Celebration toasts & modals: fire when week changes (after advanceWeek)
  const prevWeekRef = useRef(week);
  const shownCelebrationsRef = useRef<Set<string>>(new Set());
  const prevSeasonRef = useRef(season);
  const [majorCelebration, setMajorCelebration] = useState<Celebration | null>(null);
  useEffect(() => {
    if (prevSeasonRef.current !== season) {
      shownCelebrationsRef.current.clear();
      prevSeasonRef.current = season;
    }
  }, [season]);
  useEffect(() => {
    if (!club) return;
    if (prevWeekRef.current !== week && prevWeekRef.current > 0) {
      const celebrations = checkCelebrations(
        playerClubId, players, club.playerIds, fixtures, leagueTable, season
      );
      const unseen = celebrations.filter(c => {
        const key = `${c.title}-${season}`;
        if (shownCelebrationsRef.current.has(key)) return false;
        shownCelebrationsRef.current.add(key);
        return true;
      });
      // Route major/legendary to modal, minor to toast
      const majorOnes = unseen.filter(c => c.severity === 'major' || c.severity === 'legendary');
      const minorOnes = unseen.filter(c => c.severity === 'minor');
      if (majorOnes.length > 0) {
        setMajorCelebration(majorOnes[0]);
        hapticHeavy();
      }
      if (minorOnes.length > 0) hapticMedium();
      minorOnes.forEach((c, i) => {
        setTimeout(() => celebrationToast(c.title, c.description), i * 800);
      });
    }
    prevWeekRef.current = week;
  }, [week, playerClubId, players, club, fixtures, leagueTable, season]);

  if (!club) return null;

  // ── Derived data ──

  const lastResults = fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week)
    .slice(0, 5);

  const entry = leagueTable.find(e => e.clubId === playerClubId);

  const avgMorale = club.playerIds.length > 0
    ? Math.round(club.playerIds.reduce((s, id) => s + (players[id]?.morale || 0), 0) / club.playerIds.length) : 0;

  const pendingOffers = incomingOffers.length;

  // Injured players
  const injuredPlayers = club.playerIds
    .map(id => players[id])
    .filter(p => p && p.injured && p.clubId === playerClubId);

  // Expiring contracts (end this season)
  const expiringPlayers = club.playerIds
    .map(id => players[id])
    .filter(p => p && p.contractEnd <= season && !p.injured);

  // Net weekly income
  const weeklyIncome = getWeeklyIncome(club);
  const netWeeklyIncome = getNetWeeklyIncome(club);

  // Win streak
  const winStreak = getWinStreak(playerClubId, fixtures);

  // Week preview teasers
  const weekPreviews = club ? getWeekPreview({
    playerClubId, players, clubs, fixtures, facilities: store.facilities,
    scouting: store.scouting, week, season,
  }) : [];

  // Fan confidence
  const fanConfidence = Math.min(100, Math.round(club.fanBase * 0.5 + boardConfidence * 0.5));

  // Next 3 unplayed fixtures for player club
  const upcomingFixtures = fixtures
    .filter(m => !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId) && m.week > week)
    .sort((a, b) => a.week - b.week)
    .slice(0, 3);

  // Season over check — 46-week season, but only when all player matches done and not in playoffs
  const allMatchesPlayed = fixtures
    .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    .every(m => m.played);
  const inPlayoffs = store.seasonPhase === 'playoffs';
  const seasonOver = !inPlayoffs && (week > store.totalWeeks || (allMatchesPlayed && fixtures.filter(m => m.played).length > 0));

  // Training focus label map
  const trainingLabels: Record<string, string> = {
    fitness: 'Fitness',
    attacking: 'Attacking',
    defending: 'Defending',
    mentality: 'Mentality',
  };

  // Quick links
  const quickLinks = [
    { label: 'Schedule', screen: 'calendar' as const, icon: Calendar },
    { label: 'League', screen: 'league-table' as const, icon: Trophy },
    { label: 'Squad', screen: 'squad' as const, icon: Users },
    { label: 'Tactics', screen: 'tactics' as const, icon: Shield },
    { label: 'Training', screen: 'training' as const, icon: Dumbbell },
    { label: 'Club', screen: 'club' as const, icon: Settings },
    { label: 'Transfers', screen: 'transfers' as const, icon: UserPlus },
    { label: 'Stats', screen: 'league-table' as const, icon: BarChart3 },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Welcome overlay for first-time players */}
      {showWelcome && <WelcomeOverlay onComplete={dismissWelcome} />}

      {/* Press Conference (shown after matches) */}
      {store.pendingPressConference && <PressConference />}

      {/* Storyline Event (shown when triggered) */}
      {store.pendingStoryline && <StorylineModal />}

      {/* Farewell Modal (shown when a long-serving player departs) */}
      <FarewellModal />

      {/* Board Warning (low confidence) */}
      {!boardWarningDismissed && boardConfidence <= 35 && (
        <BoardWarning confidence={boardConfidence} onDismiss={() => setBoardWarningDismissed(true)} />
      )}

      {/* Major Celebration Modal */}
      <CelebrationModal
        open={!!majorCelebration}
        onClose={() => setMajorCelebration(null)}
        title={majorCelebration?.title || ''}
        description={majorCelebration?.description || ''}
        icon={majorCelebration?.icon}
      />

      {/* Active Challenge Banner */}
      {store.activeChallenge && !store.activeChallenge.completed && !store.activeChallenge.failed && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-semibold text-primary">Challenge Active</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{store.activeChallenge.seasonsRemaining} season(s) left</span>
        </div>
      )}
      {store.activeChallenge?.completed && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-center">
          <span className="text-xs font-bold text-emerald-400">Challenge Complete!</span>
        </div>
      )}
      {store.activeChallenge?.failed && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-center">
          <span className="text-xs font-bold text-destructive">Challenge Failed</span>
        </div>
      )}

      {/* Season End */}
      {seasonOver && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <GlassPanel className="p-5 border-primary/40 text-center">
            <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-lg font-black text-foreground font-display">Season {season} Complete!</p>
            <p className="text-sm text-muted-foreground mb-3">Final Position: {pos}{getSuffix(pos)}</p>
            <Button className="w-full gap-2" onClick={endSeason}>
              View Season Summary
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Playoff Banner */}
      {inPlayoffs && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Promotion Playoffs</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Week {week} / Season {season}</span>
          </div>
        </motion.div>
      )}

      {/* Training Status Chip + Win Streak */}
      {!seasonOver && !inPlayoffs && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
            <Dumbbell className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">
              Training: {trainingLabels[trainingFocus] || trainingFocus}
            </span>
          </div>
          {winStreak >= 3 && (
            <div className="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
              <span className="text-xs">🔥</span>
              <span className="text-xs font-bold text-orange-400">{winStreak} Win Streak</span>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">Week {week} / Season {season}</span>
        </div>
      )}

      {/* Weekly Objectives */}
      {!seasonOver && store.weeklyObjectives.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Weekly Objectives</p>
            <span className="text-[10px] text-primary font-semibold">
              {store.weeklyObjectives.filter(o => o.completed).length}/{store.weeklyObjectives.length}
            </span>
          </div>
          <div className="space-y-2">
            {store.weeklyObjectives.map((obj) => (
              <div
                key={obj.objectiveId}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
                  obj.completed ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-muted/30 border border-border/30'
                )}
              >
                <span className="text-sm">{obj.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold truncate', obj.completed ? 'text-emerald-400 line-through' : 'text-foreground')}>{obj.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{obj.description}</p>
                </div>
                <span className={cn('text-[10px] font-bold', obj.completed ? 'text-emerald-400' : 'text-primary')}>
                  {obj.completed ? '✓' : `+${obj.xpReward} XP`}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Next Match */}
      {!seasonOver && nextMatch && opponent ? (
        <GlassPanel className="p-5" onClick={() => setScreen('match-prep')}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">{inPlayoffs ? 'Playoff Match' : 'Match Day'} -- Week {week}</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: club.color, color: club.secondaryColor }}
              >
                {club.shortName}
              </div>
              <p className="text-sm font-bold text-foreground">{club.shortName}</p>
              <p className="text-[10px] text-muted-foreground">{isHome ? 'HOME' : 'AWAY'}</p>
            </div>
            <div className="px-4">
              <p className="text-2xl font-black text-muted-foreground">VS</p>
            </div>
            <div className="text-center flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: opponent.color, color: opponent.secondaryColor }}
              >
                {opponent.shortName}
              </div>
              <p className="text-sm font-bold text-foreground">{opponent.shortName}</p>
              <p className="text-[10px] text-muted-foreground">{isHome ? 'AWAY' : 'HOME'}</p>
            </div>
          </div>
          <Button
            className="w-full mt-4 gap-2"
            onClick={(e) => { e.stopPropagation(); setScreen('match-prep'); }}
          >
            <Play className="w-4 h-4" /> Match Prep
          </Button>
        </GlassPanel>
      ) : !seasonOver && (
        <GlassPanel className="p-5">
          <p className="text-sm text-muted-foreground text-center">No match this week</p>
          <Button className="w-full mt-3" onClick={() => { hapticLight(); advanceWeek(); }}>
            Advance to Week {week + 1}
          </Button>
        </GlassPanel>
      )}

      {/* Week Preview Teasers */}
      {!seasonOver && weekPreviews.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Coming Up</p>
          <div className="space-y-2">
            {weekPreviews.map((preview, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                  preview.type === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                  preview.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-muted/30 text-muted-foreground'
                )}
              >
                <span className="text-sm">{preview.icon}</span>
                <span className="font-medium">{preview.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Last match result */}
      {currentMatchResult && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <GlassPanel className="p-4 border-primary/30">
            <p className="text-[10px] text-primary uppercase tracking-wider mb-1">Last Result</p>
            <p className="text-lg font-black text-foreground tabular-nums">
              {clubs[currentMatchResult.homeClubId]?.shortName} {currentMatchResult.homeGoals} - {currentMatchResult.awayGoals} {clubs[currentMatchResult.awayClubId]?.shortName}
            </p>
          </GlassPanel>
        </motion.div>
      )}

      {/* Alerts Row */}
      {(unread > 0 || pendingOffers > 0) && (
        <div className="flex gap-3">
          {unread > 0 && (
            <GlassPanel className="flex-1 p-3 flex items-center gap-2" onClick={() => setScreen('inbox')}>
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground font-medium">{unread} unread</span>
            </GlassPanel>
          )}
          {pendingOffers > 0 && (
            <GlassPanel className="flex-1 p-3 flex items-center gap-2" onClick={() => setScreen('transfers')}>
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground font-medium">{pendingOffers} offer{pendingOffers > 1 ? 's' : ''}</span>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Injury Alert Panel */}
      {injuredPlayers.length > 0 && (
        <GlassPanel className="p-4 border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-xs text-destructive uppercase tracking-wider font-semibold">
              Injuries ({injuredPlayers.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {injuredPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {p.firstName[0]}. {p.lastName}
                  <span className="text-xs text-muted-foreground ml-1.5">({p.position})</span>
                </span>
                <span className="text-xs text-destructive font-medium tabular-nums">
                  {p.injuryWeeks} wk{p.injuryWeeks !== 1 ? 's' : ''} remaining
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Contract Expiry Warning */}
      {expiringPlayers.length > 0 && (
        <GlassPanel className="p-4 border-amber-500/30" onClick={() => setScreen('squad')}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold">
              Expiring Contracts ({expiringPlayers.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {expiringPlayers.slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {p.firstName[0]}. {p.lastName}
                  <span className="text-xs text-muted-foreground ml-1.5">({p.position})</span>
                </span>
                <span className="text-xs text-amber-400 font-medium">End of season</span>
              </div>
            ))}
            {expiringPlayers.length > 3 && (
              <p className="text-xs text-muted-foreground">+{expiringPlayers.length - 3} more</p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Tap to view squad and renew contracts</p>
        </GlassPanel>
      )}

      {/* Transfer Alerts Card */}
      {pendingOffers > 0 && (
        <GlassPanel className="p-4 border-primary/20" onClick={() => setScreen('transfers')}>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Incoming Offers</span>
          </div>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {pendingOffers}
            <span className="text-sm text-muted-foreground font-normal ml-1">
              pending offer{pendingOffers !== 1 ? 's' : ''}
            </span>
          </p>
        </GlassPanel>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-4" onClick={() => setScreen('league-table')}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">League Pos</span>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {pos}<span className="text-sm text-muted-foreground">/{leagueTable.length}</span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{DIVISIONS.find(d => d.id === store.playerDivision)?.shortName || ''} {'\u2022'} {entry?.points || 0} pts</p>
        </GlassPanel>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Budget</span>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            £{(club.budget / 1e6).toFixed(1)}<span className="text-sm">M</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Wage: £{(club.wageBill / 1e3).toFixed(0)}K/w
          </p>
        </GlassPanel>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Morale</span>
          </div>
          <p className={cn(
            'text-2xl font-black tabular-nums',
            avgMorale > 70 ? 'text-emerald-400' : avgMorale > 40 ? 'text-amber-400' : 'text-destructive'
          )}>
            {avgMorale}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {avgMorale > 70 ? 'Excellent' : avgMorale > 40 ? 'Decent' : 'Low — affects performance'}
          </p>
        </GlassPanel>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Board</span>
          </div>
          <p className={cn(
            'text-2xl font-black tabular-nums',
            getConfidenceColor(boardConfidence).textClass
          )}>
            {boardConfidence}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {boardConfidence > 70 ? 'Secure' : boardConfidence > 40 ? 'Under pressure' : 'Sacking risk!'}
          </p>
        </GlassPanel>
      </div>

      {/* Finance Snapshot + Fan Confidence Row */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Net Income</span>
          </div>
          <p className={cn(
            'text-xl font-black tabular-nums',
            netWeeklyIncome >= 0 ? 'text-emerald-400' : 'text-destructive'
          )}>
            {netWeeklyIncome >= 0 ? '+' : ''}£{(Math.abs(netWeeklyIncome) / 1e3).toFixed(0)}K
          </p>
          <p className="text-[10px] text-muted-foreground">per week</p>
        </GlassPanel>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Fan Confidence</span>
          </div>
          <p className={cn(
            'text-xl font-black tabular-nums',
            getFanConfidenceColor(fanConfidence)
          )}>
            {fanConfidence}%
          </p>
        </GlassPanel>
      </div>

      {/* Recent Form */}
      {lastResults.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Recent Form</p>
          <div className="flex gap-2">
            {lastResults.map((m, i) => {
              const isH = m.homeClubId === playerClubId;
              const won = isH ? m.homeGoals > m.awayGoals : m.awayGoals > m.homeGoals;
              const lost = isH ? m.homeGoals < m.awayGoals : m.awayGoals < m.homeGoals;
              return (
                <div key={i} className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold',
                  won ? 'bg-emerald-500/20 text-emerald-400' : lost ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                )}>
                  {won ? 'W' : lost ? 'L' : 'D'}
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Next 3 Fixtures */}
      {upcomingFixtures.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upcoming Fixtures</p>
          <div className="space-y-2">
            {upcomingFixtures.map((fix) => {
              const fixIsHome = fix.homeClubId === playerClubId;
              const oppClub = clubs[fixIsHome ? fix.awayClubId : fix.homeClubId];
              return (
                <div key={fix.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                      style={{ backgroundColor: oppClub?.color, color: oppClub?.secondaryColor }}
                    >
                      {oppClub?.shortName?.slice(0, 2)}
                    </div>
                    <span className="text-sm text-foreground font-medium">{oppClub?.shortName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      fixIsHome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                    )}>
                      {fixIsHome ? 'H' : 'A'}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">Wk {fix.week}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Cup Status */}
      {cup.currentRound && (
        <GlassPanel className="p-4" onClick={() => setScreen('cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className={cn('w-5 h-5', cup.winner === playerClubId ? 'text-primary' : cup.eliminated ? 'text-destructive' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold text-foreground">League Cup</p>
                <p className="text-xs text-muted-foreground">
                  {cup.winner ? `Winner: ${clubs[cup.winner]?.shortName}` : cup.eliminated ? 'Eliminated' : getRoundName(cup.currentRound)}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Board Objectives */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Board Objectives</p>
        <div className="space-y-2">
          {boardObjectives.map(obj => (
            <div key={obj.id} className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                obj.priority === 'critical' ? 'bg-destructive' : obj.priority === 'important' ? 'bg-primary' : 'bg-muted-foreground'
              )} />
              <span className="text-sm text-foreground">{obj.description}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Quick Links - Horizontal scrollable row */}
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
        <div className="flex gap-3 w-max pb-1">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <GlassPanel
                key={link.label}
                className="px-4 py-3 flex flex-col items-center gap-1.5 min-w-[80px]"
                onClick={() => setScreen(link.screen)}
              >
                <Icon className="w-5 h-5 text-primary" />
                <span className="text-[11px] font-medium text-foreground whitespace-nowrap">{link.label}</span>
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
