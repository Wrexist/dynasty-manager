import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ChevronRight, Flame, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getConfidenceColor, getMatchRatingColor } from '@/utils/uiHelpers';
import { getDerbyName, getDerbyIntensity } from '@/data/league';
import { getSuffix } from '@/utils/helpers';
import { motion } from 'framer-motion';

const MatchReview = () => {
  const { currentMatchResult, clubs, players, playerClubId, boardConfidence, matchPlayerRatings, advanceWeek, setScreen, week, divisionFixtures, playerDivision, divisionTables } = useGameStore();

  if (!currentMatchResult) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No match to review</p>
          <Button variant="secondary" className="mt-3" onClick={() => setScreen('dashboard')}>Back to Dashboard</Button>
        </GlassPanel>
      </div>
    );
  }

  const match = currentMatchResult;
  const homeClub = clubs[match.homeClubId];
  const awayClub = clubs[match.awayClubId];
  const isHome = match.homeClubId === playerClubId;
  const won = isHome ? match.homeGoals > match.awayGoals : match.awayGoals > match.homeGoals;
  const drew = match.homeGoals === match.awayGoals;
  const lost = !won && !drew;

  // Goals
  const goals = match.events.filter(e => e.type === 'goal');
  const injuries = match.events.filter(e => e.type === 'injury');
  const cards = match.events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');

  const handleContinue = () => {
    advanceWeek();
    setScreen('dashboard');
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      {/* Result Header */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
        <GlassPanel className={cn('p-6 text-center', won ? 'border-emerald-500/30' : lost ? 'border-destructive/30' : 'border-amber-500/30')}>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className={cn('text-sm font-semibold mb-1',
              won ? 'text-emerald-400' : lost ? 'text-destructive' : 'text-amber-400'
            )}
          >
            {won ? 'VICTORY' : lost ? 'DEFEAT' : 'DRAW'}
          </motion.p>
          <div className="flex items-center justify-center gap-4 my-3">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-1" style={{ backgroundColor: homeClub.color }} />
              <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
            </div>
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4, type: 'spring', stiffness: 200 }}
              className="text-4xl font-black text-foreground font-display tabular-nums"
            >
              {match.homeGoals} - {match.awayGoals}
            </motion.p>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-1" style={{ backgroundColor: awayClub.color }} />
              <p className="text-xs font-bold text-foreground">{awayClub.shortName}</p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Scorers */}
      {goals.length > 0 && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Goals</h3>
          <div className="space-y-1.5">
            {goals.map((g, i) => {
              const scorer = g.playerId ? players[g.playerId] : null;
              const assister = g.assistPlayerId ? players[g.assistPlayerId] : null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">{g.minute}'</span>
                  <span className="text-xs text-foreground">
                    {scorer ? `${scorer.firstName} ${scorer.lastName}` : 'Unknown'}
                    {assister && <span className="text-muted-foreground"> (ast. {assister.lastName})</span>}
                  </span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clubs[g.clubId]?.color }} />
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Match Stats */}
      {match.stats && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Match Stats</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Possession', home: `${match.stats.homePossession}%`, away: `${match.stats.awayPossession}%`, homeVal: match.stats.homePossession, awayVal: match.stats.awayPossession },
              { label: 'Shots', home: match.stats.homeShots, away: match.stats.awayShots, homeVal: match.stats.homeShots, awayVal: match.stats.awayShots },
              { label: 'On Target', home: match.stats.homeShotsOnTarget, away: match.stats.awayShotsOnTarget, homeVal: match.stats.homeShotsOnTarget, awayVal: match.stats.awayShotsOnTarget },
              { label: 'Fouls', home: match.stats.homeFouls, away: match.stats.awayFouls, homeVal: match.stats.homeFouls, awayVal: match.stats.awayFouls },
              { label: 'Corners', home: match.stats.homeCorners, away: match.stats.awayCorners, homeVal: match.stats.homeCorners, awayVal: match.stats.awayCorners },
            ].map(({ label, home, away, homeVal, awayVal }) => {
              const total = (homeVal as number) + (awayVal as number) || 1;
              const homePct = ((homeVal as number) / total) * 100;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground tabular-nums">{home}</span>
                    <span className="text-muted-foreground text-[10px]">{label}</span>
                    <span className="text-foreground tabular-nums">{away}</span>
                  </div>
                  <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-primary/60 rounded-full" style={{ width: `${homePct}%` }} />
                    <div className="bg-muted-foreground/30 rounded-full flex-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Player Ratings */}
      {matchPlayerRatings.length > 0 && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Player Ratings</h3>
          <div className="space-y-1.5">
            {matchPlayerRatings
              .filter(r => players[r.playerId]?.clubId === playerClubId)
              .sort((a, b) => b.rating - a.rating).map(r => {
              const player = players[r.playerId];
              if (!player) return null;
              return (
                <div key={r.playerId} className="flex items-center gap-2">
                  <span className={cn(
                    'w-6 text-center text-xs font-bold',
                    getMatchRatingColor(r.rating)
                  )}>
                    {r.rating.toFixed(1)}
                  </span>
                  <span className="text-xs text-foreground flex-1 truncate">{player.lastName}</span>
                  {r.goals > 0 && <span className="text-[10px] text-emerald-400">{r.goals}G</span>}
                  {r.assists > 0 && <span className="text-[10px] text-primary">{r.assists}A</span>}
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Injuries & Cards */}
      {(injuries.length > 0 || cards.length > 0) && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Incidents</h3>
          <div className="space-y-1.5">
            {injuries.map((e, i) => {
              const p = e.playerId ? players[e.playerId] : null;
              return (
                <div key={`inj-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="text-destructive">🏥</span>
                  <span className="text-foreground">{p?.lastName || 'Unknown'} — Injured</span>
                  <span className="text-muted-foreground">{e.minute}'</span>
                </div>
              );
            })}
            {cards.map((e, i) => {
              const p = e.playerId ? players[e.playerId] : null;
              return (
                <div key={`card-${i}`} className="flex items-center gap-2 text-xs">
                  <span>{e.type === 'yellow_card' ? '🟨' : '🟥'}</span>
                  <span className="text-foreground">{p?.lastName || 'Unknown'}</span>
                  <span className="text-muted-foreground">{e.minute}'</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Performance Summary */}
      {match.stats && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Performance Summary</h3>
          <div className="space-y-1.5">
            {(() => {
              const insights: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
              const myPoss = isHome ? match.stats.homePossession : match.stats.awayPossession;
              const myShots = isHome ? match.stats.homeShots : match.stats.awayShots;
              const mySoT = isHome ? match.stats.homeShotsOnTarget : match.stats.awayShotsOnTarget;
              const oppShots = isHome ? match.stats.awayShots : match.stats.homeShots;
              const oppSoT = isHome ? match.stats.awayShotsOnTarget : match.stats.homeShotsOnTarget;
              const myGoals = isHome ? match.homeGoals : match.awayGoals;
              const oppGoals = isHome ? match.awayGoals : match.homeGoals;

              if (myPoss >= 60) insights.push({ text: 'Dominated possession — your midfield controlled the game.', tone: 'good' });
              else if (myPoss <= 40) insights.push({ text: 'Lost the possession battle — opponent dictated the tempo.', tone: 'bad' });

              if (myShots > 0 && mySoT / myShots < 0.3) insights.push({ text: 'Poor shot accuracy — too many wayward efforts.', tone: 'bad' });
              else if (myShots > 0 && mySoT / myShots >= 0.6) insights.push({ text: 'Clinical finishing — most shots tested the keeper.', tone: 'good' });

              if (myGoals > 0 && mySoT > 0 && myGoals / mySoT >= 0.5) insights.push({ text: 'Lethal conversion rate — made the most of your chances.', tone: 'good' });
              else if (mySoT >= 5 && myGoals === 0) insights.push({ text: 'Created chances but couldn\'t find the net. Unlucky or poor finishing.', tone: 'bad' });

              if (oppSoT <= 2 && oppGoals === 0) insights.push({ text: 'Defensive masterclass — barely gave them a sniff.', tone: 'good' });
              else if (oppSoT >= 6) insights.push({ text: 'Defensively exposed — opponent had too many clear sights on goal.', tone: 'bad' });

              if (insights.length === 0) insights.push({ text: 'A balanced contest with nothing to separate the sides.', tone: 'neutral' });

              return insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn('text-xs mt-0.5', ins.tone === 'good' ? 'text-emerald-400' : ins.tone === 'bad' ? 'text-amber-400' : 'text-muted-foreground')}>
                    {ins.tone === 'good' ? '▲' : ins.tone === 'bad' ? '▼' : '—'}
                  </span>
                  <p className="text-xs text-muted-foreground">{ins.text}</p>
                </div>
              ));
            })()}
          </div>
        </GlassPanel>
      )}

      {/* Man of the Match */}
      {matchPlayerRatings.length > 0 && (() => {
        const myRatings = matchPlayerRatings.filter(r => players[r.playerId]?.clubId === playerClubId);
        const best = myRatings.sort((a, b) => b.rating - a.rating)[0];
        const bestPlayer = best ? players[best.playerId] : null;
        if (!bestPlayer || best.rating < 7.0) return null;
        return (
          <GlassPanel className="p-3 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-black text-primary">{best.rating.toFixed(1)}</span>
              </div>
              <div>
                <p className="text-[10px] text-primary uppercase tracking-wider font-semibold">Man of the Match</p>
                <p className="text-sm font-bold text-foreground">{bestPlayer.firstName} {bestPlayer.lastName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {best.goals > 0 ? `${best.goals}G ` : ''}{best.assists > 0 ? `${best.assists}A ` : ''}{bestPlayer.position}
                </p>
              </div>
            </div>
          </GlassPanel>
        );
      })()}

      {/* Board Reaction */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Board Reaction</h3>
        <p className="text-xs text-muted-foreground">
          {boardConfidence >= 70
            ? won ? 'The board is delighted with this result. Keep it up!' : 'A solid position overall. The board trusts your process.'
            : boardConfidence >= 40
            ? won ? 'A much-needed result. The board is cautiously optimistic.' : 'The board expects improvement in upcoming fixtures.'
            : 'The board is concerned. Results must improve immediately.'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground">Confidence:</span>
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', getConfidenceColor(boardConfidence).bgClass)}
              style={{ width: `${boardConfidence}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-foreground tabular-nums">{boardConfidence}%</span>
        </div>
      </GlassPanel>

      {/* Next Up Preview */}
      {(() => {
        const nextFixture = divisionFixtures[playerDivision]?.find(
          f => !f.played && f.week > week && (f.homeClubId === playerClubId || f.awayClubId === playerClubId)
        );
        if (!nextFixture) return null;

        const opponentId = nextFixture.homeClubId === playerClubId ? nextFixture.awayClubId : nextFixture.homeClubId;
        const opponent = clubs[opponentId];
        const isNextHome = nextFixture.homeClubId === playerClubId;
        if (!opponent) return null;

        const derbyName = getDerbyName(playerClubId, opponentId);
        const derbyIntensity = getDerbyIntensity(playerClubId, opponentId);

        // Build a contextual hook line
        const table = divisionTables[playerDivision] || [];
        const myPos = table.findIndex(e => e.clubId === playerClubId) + 1;
        const oppPos = table.findIndex(e => e.clubId === opponentId) + 1;
        const oppForm = table.find(e => e.clubId === opponentId)?.form?.slice(-5) || [];

        let hookLine = '';
        if (derbyName) {
          hookLine = `${derbyName}!`;
        } else if (myPos > 0 && myPos <= 4 && oppPos > 0 && oppPos <= 4) {
          hookLine = 'Top of the table clash!';
        } else if (myPos > 0 && myPos > 3 && oppPos > 0 && myPos - 1 === oppPos) {
          hookLine = `Win this and you climb to ${myPos - 1}${getSuffix(myPos - 1)}!`;
        } else if (myPos > table.length - 4) {
          hookLine = 'Must-win in the battle for survival.';
        } else if (oppForm.filter(f => f === 'W').length >= 4) {
          hookLine = `${opponent.shortName} are on a hot streak.`;
        } else if (oppForm.filter(f => f === 'L').length >= 4) {
          hookLine = `${opponent.shortName} are struggling — time to pounce.`;
        } else {
          hookLine = isNextHome ? 'Home advantage awaits.' : 'A tough trip on the road.';
        }

        return (
          <GlassPanel className="p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coming Up — Week {nextFixture.week}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: opponent.color, color: opponent.secondaryColor }}>
                  {opponent.shortName}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{opponent.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isNextHome ? 'Home' : 'Away'}{oppPos > 0 ? ` · ${oppPos}${getSuffix(oppPos)} in table` : ''}
                  </p>
                </div>
              </div>
              {oppForm.length > 0 && (
                <div className="flex gap-0.5">
                  {oppForm.map((f, i) => (
                    <span key={i} className={cn(
                      'w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold',
                      f === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
                      f === 'L' ? 'bg-destructive/20 text-destructive' :
                      'bg-amber-500/20 text-amber-400'
                    )}>{f}</span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-primary font-semibold mt-2">
              {derbyIntensity > 0 && <Flame className="w-3 h-3 inline mr-1 text-amber-400" />}
              {hookLine}
            </p>
          </GlassPanel>
        );
      })()}

      {/* Continue */}
      <Button size="lg" className="w-full h-14 text-lg font-bold gap-3" onClick={handleContinue}>
        Continue <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default MatchReview;
