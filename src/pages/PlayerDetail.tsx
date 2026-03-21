import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { StatBar } from '@/components/game/StatBar';
import { Button } from '@/components/ui/button';
import { POSITION_COMPATIBILITY, Position } from '@/types/game';
import { ArrowLeft, Heart, Zap, TrendingUp, TrendingDown, Tag, X, Target, Activity, FileText, Brain, Award, HeartPulse, Stethoscope } from 'lucide-react';
import { getPlayerNarratives } from '@/utils/playerNarratives';
import { cn } from '@/lib/utils';
import { getRatingColor, getMoodColor, getMoodLabel } from '@/utils/uiHelpers';
import { successToast, infoToast, errorToast } from '@/utils/gameToast';
import { getPersonalityLabel } from '@/utils/personality';

const PlayerDetail = () => {
  const {
    selectedPlayerId, players, clubs, playerClubId,
    incomingOffers, setScreen, selectPlayer,
    listPlayerForSale, unlistPlayer, respondToOffer, season, week, facilities, startNegotiation,
  } = useGameStore();

  const player = selectedPlayerId ? players[selectedPlayerId] : null;

  if (!player) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Player not found</p>
        <Button variant="ghost" className="mt-2" onClick={() => setScreen('squad')}>Back to Squad</Button>
      </div>
    );
  }

  const club = clubs[player.clubId];
  const isOwnPlayer = player.clubId === playerClubId;
  const ratingColor = getRatingColor(player.overall);

  const playerOffers = incomingOffers.filter(o => o.playerId === player.id);

  const handleSell = () => {
    if (player.listedForSale) {
      unlistPlayer(player.id);
      infoToast(`${player.lastName} removed from transfer list.`);
    } else {
      listPlayerForSale(player.id);
      successToast(`${player.lastName} listed for sale!`, `Asking price: £${(player.value / 1_000_000).toFixed(1)}M`);
    }
  };

  const handleOffer = (offerId: string, accept: boolean) => {
    const result = respondToOffer(offerId, accept);
    if (result.success) {
      successToast(result.message);
      if (accept) { selectPlayer(null); setScreen('squad'); }
    } else {
      errorToast(result.message);
    }
  };

  // Narrative tags
  const narratives = getPlayerNarratives(player, season, player.joinedSeason, player.isFromYouthAcademy);

  // Development curve
  const isGrowing = player.age < 24;
  const isDeclining = player.age >= 31;
  const devPct = Math.min(100, (player.overall / player.potential) * 100);

  // Role suitability: find all positions where this player appears as compatible
  const naturalPosition = player.position;
  const compatiblePositions = POSITION_COMPATIBILITY[naturalPosition] || [naturalPosition];

  // Morale factors
  const moraleFactors: { label: string; impact: 'positive' | 'neutral' | 'negative' }[] = [];
  if (player.appearances > 0 && week > 0) {
    const playingTimePct = player.appearances / Math.max(1, week) * 100;
    if (playingTimePct > 50) moraleFactors.push({ label: 'Regular playing time', impact: 'positive' });
    else if (playingTimePct < 20) moraleFactors.push({ label: 'Lack of playing time', impact: 'negative' });
    else moraleFactors.push({ label: 'Limited playing time', impact: 'neutral' });
  }
  if (player.form > 70) moraleFactors.push({ label: 'Good form', impact: 'positive' });
  else if (player.form < 40) moraleFactors.push({ label: 'Poor form', impact: 'negative' });
  if (player.contractEnd <= season) moraleFactors.push({ label: 'Contract expiring', impact: 'negative' });
  if (player.injured) moraleFactors.push({ label: 'Currently injured', impact: 'negative' });
  if (player.personality?.temperament && player.personality.temperament < 40) moraleFactors.push({ label: 'Volatile temperament', impact: 'negative' });

  // Season performance derived stats
  const goalsPerApp = player.appearances > 0 ? (player.goals / player.appearances).toFixed(2) : '0.00';
  const assistsPerApp = player.appearances > 0 ? (player.assists / player.appearances).toFixed(2) : '0.00';
  const goalContributions = player.goals + player.assists;
  const gcPerApp = player.appearances > 0 ? (goalContributions / player.appearances).toFixed(2) : '0.00';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button
        onClick={() => { selectPlayer(null); setScreen('squad'); }}
        className="flex items-center gap-1 text-muted-foreground text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <GlassPanel className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center relative">
            <span className={cn('font-mono font-black text-3xl tabular-nums', ratingColor)}>
              {player.overall}
            </span>
            {player.growthDelta && player.growthDelta > 0 && (
              <TrendingUp className="absolute -top-1 -right-1 w-4 h-4 text-emerald-400" />
            )}
            {player.growthDelta && player.growthDelta < 0 && (
              <TrendingDown className="absolute -top-1 -right-1 w-4 h-4 text-destructive" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-xl font-black text-foreground">{player.firstName} {player.lastName}</p>
            <p className="text-sm text-muted-foreground">{player.position} · {player.age} · {player.nationality}</p>
            {club && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: club.color }} />
                <span className="text-xs text-muted-foreground">{club.name}</span>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Narrative Tags */}
      {narratives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {narratives.map(n => (
            <div key={n.tag} className="flex items-center gap-1.5 bg-muted/30 border border-border/40 rounded-full px-3 py-1">
              <Award className={cn('w-3 h-3', n.color)} />
              <span className={cn('text-[10px] font-bold', n.color)}>{n.tag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Key Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassPanel className="p-3 text-center">
          <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-black text-foreground tabular-nums">{player.fitness}%</p>
          <p className="text-[10px] text-muted-foreground">Fitness</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <Heart className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className={cn("text-lg font-black tabular-nums", getMoodColor(player.morale))}>{player.morale}%</p>
          <p className="text-[10px] text-muted-foreground">{getMoodLabel(player.morale)}</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-black text-foreground tabular-nums">{player.form}%</p>
          <p className="text-[10px] text-muted-foreground">Form</p>
        </GlassPanel>
      </div>

      {/* Morale Factors */}
      {moraleFactors.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Morale Factors</p>
          <div className="space-y-1">
            {moraleFactors.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  f.impact === 'positive' ? "bg-emerald-400" : f.impact === 'negative' ? "bg-destructive" : "bg-amber-400"
                )} />
                <span className="text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Development Curve */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Development</p>
          {isGrowing && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              Growing
            </span>
          )}
          {isDeclining && (
            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              Declining
            </span>
          )}
          {!isGrowing && !isDeclining && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              Peak
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground tabular-nums w-7">{player.overall}</span>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isGrowing ? 'bg-emerald-500' : isDeclining ? 'bg-destructive' : 'bg-primary'
              )}
              style={{ width: `${devPct}%` }}
            />
            {/* Potential marker line */}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/30" />
          </div>
          <span className="text-sm font-bold text-primary tabular-nums w-7">{player.potential}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">Current</span>
          <span className="text-[10px] text-muted-foreground">
            Gap: {player.potential - player.overall > 0 ? `+${player.potential - player.overall}` : '0'}
          </span>
          <span className="text-[10px] text-muted-foreground">Potential</span>
        </div>
      </GlassPanel>

      {/* Role Suitability */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Role Suitability</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {compatiblePositions.map((pos: Position) => {
            const isNatural = pos === naturalPosition;
            return (
              <div
                key={pos}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border',
                  isNatural
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/40 bg-muted/30'
                )}
              >
                <span className={cn(
                  'text-xs font-bold',
                  isNatural ? 'text-primary' : 'text-foreground'
                )}>
                  {pos}
                </span>
                <span className={cn(
                  'text-[9px] font-medium',
                  isNatural ? 'text-primary/70' : 'text-muted-foreground'
                )}>
                  {isNatural ? 'Natural' : 'Capable'}
                </span>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Grouped Attributes */}
      <GlassPanel className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Attributes</p>

        {/* Attack */}
        <div>
          <p className="text-[10px] text-red-400/80 uppercase tracking-wider font-semibold mb-2">Attack</p>
          <div className="space-y-2">
            <StatBar label="Pace" value={player.attributes.pace} />
            <StatBar label="Shooting" value={player.attributes.shooting} />
          </div>
        </div>

        {/* Playmaking */}
        <div>
          <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold mb-2">Playmaking</p>
          <div className="space-y-2">
            <StatBar label="Passing" value={player.attributes.passing} />
            <StatBar label="Mental" value={player.attributes.mental} />
          </div>
        </div>

        {/* Defense */}
        <div>
          <p className="text-[10px] text-blue-400/80 uppercase tracking-wider font-semibold mb-2">Defense</p>
          <div className="space-y-2">
            <StatBar label="Defending" value={player.attributes.defending} />
            <StatBar label="Physical" value={player.attributes.physical} />
          </div>
        </div>
      </GlassPanel>

      {/* Personality */}
      {player.personality && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Personality</p>
            <span className="ml-auto text-xs font-bold text-primary">{getPersonalityLabel(player.personality)}</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Professionalism', value: player.personality.professionalism },
              { label: 'Ambition', value: player.personality.ambition },
              { label: 'Temperament', value: player.personality.temperament },
              { label: 'Loyalty', value: player.personality.loyalty },
              { label: 'Leadership', value: player.personality.leadership },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24">{t.label}</span>
                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', t.value >= 15 ? 'bg-emerald-400' : t.value >= 10 ? 'bg-primary' : t.value >= 7 ? 'bg-amber-400' : 'bg-destructive')}
                    style={{ width: `${(t.value / 20) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-5 text-right tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Season Stats */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Season Stats</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Apps', value: player.appearances },
            { label: 'Goals', value: player.goals },
            { label: 'Assists', value: player.assists },
            { label: 'Yellow', value: player.yellowCards },
          ].map(s => (
            <div key={s.label}>
              <p className="text-lg font-black text-foreground tabular-nums">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Performance Ratios */}
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{goalsPerApp}</p>
              <p className="text-[9px] text-muted-foreground">Goals/App</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{assistsPerApp}</p>
              <p className="text-[9px] text-muted-foreground">Assists/App</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{gcPerApp}</p>
              <p className="text-[9px] text-muted-foreground">G+A/App</p>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Contract */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Contract</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-bold text-foreground tabular-nums">
              £{(player.value / 1e6).toFixed(1)}M
            </p>
            <p className="text-xs text-muted-foreground">Market Value</p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tabular-nums">
              £{(player.wage / 1e3).toFixed(0)}K/w
            </p>
            <p className="text-xs text-muted-foreground">Wage</p>
          </div>
          <div>
            <p className={cn(
              'text-sm font-bold tabular-nums',
              player.contractEnd <= season ? 'text-destructive' : 'text-foreground'
            )}>
              Season {player.contractEnd}
            </p>
            <p className="text-xs text-muted-foreground">
              Contract Until
              {player.contractEnd <= season && (
                <span className="text-destructive ml-1">· Expiring</span>
              )}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Transfer Clauses */}
      {(player.sellOnPercentage || player.releaseClause) && (
        <GlassPanel className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Clauses</p>
          <div className="space-y-1">
            {player.sellOnPercentage && player.sellOnClubId && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sell-on clause</span>
                <span className="text-amber-400">{player.sellOnPercentage}% to {clubs[player.sellOnClubId]?.shortName || 'Unknown'}</span>
              </div>
            )}
            {player.releaseClause && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Release clause</span>
                <span className="text-destructive">£{(player.releaseClause / 1e6).toFixed(1)}M</span>
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Injury Recovery Panel */}
      {player.injured && (
        <GlassPanel className="p-4 border-destructive/30">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive font-bold">
              Injured — {player.injuryWeeks} week{player.injuryWeeks !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Recovery Progress</span>
                <span>Est. return: Week {Math.min(week + player.injuryWeeks, 46)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-destructive to-amber-500 transition-all"
                  style={{ width: `${Math.max(5, 100 - (player.injuryWeeks / 5) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Stethoscope className="w-3 h-3" />
              <span>Medical Center Lv.{facilities.medicalLevel}</span>
              {facilities.medicalLevel >= 5 && <span className="text-emerald-400">— Enhanced recovery</span>}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Sell Button */}
      {isOwnPlayer && (
        <Button
          variant={player.listedForSale ? 'outline' : 'secondary'}
          className="w-full gap-2"
          onClick={handleSell}
        >
          {player.listedForSale ? <X className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
          {player.listedForSale ? 'Remove from Transfer List' : 'List for Sale'}
        </Button>
      )}

      {/* Contract Renewal */}
      {isOwnPlayer && player.contractEnd <= season + 1 && (
        <Button
          variant="outline"
          className="w-full gap-2 border-primary/30 text-primary"
          onClick={() => startNegotiation(player.id, true)}
        >
          <FileText className="w-4 h-4" /> Negotiate Renewal
          <span className="text-[10px] text-muted-foreground ml-auto">
            Expires end of S{player.contractEnd}
          </span>
        </Button>
      )}

      {/* Incoming Offers */}
      {playerOffers.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Incoming Offers</p>
          <div className="space-y-3">
            {playerOffers.map(offer => {
              const buyer = clubs[offer.buyerClubId];
              return (
                <div key={offer.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: buyer?.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{buyer?.name || '?'}</p>
                    <p className="text-xs text-primary font-bold tabular-nums">
                      £{(offer.fee / 1e6).toFixed(1)}M
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-10 text-xs px-3" onClick={() => handleOffer(offer.id, true)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" className="h-10 text-xs px-3" onClick={() => handleOffer(offer.id, false)}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}
    </div>
  );
};

export default PlayerDetail;
