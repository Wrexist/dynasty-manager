import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Sparkles, MapPin, TrendingUp, Banknote, Briefcase, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticHeavy } from '@/utils/haptics';
import { calculateWageDemand, formatWage } from '@/utils/contracts';
import { darken, lighten } from '@/utils/colorUtils';
import { getPersonalityLabel } from '@/utils/personality';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { formatMoney } from '@/utils/helpers';

export function GemRevealModal() {
  const { gem, players, clubs, playerClubId, transferMarket } = useGameStore(useShallow(s => ({
    gem: s.pendingGemReveal, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, transferMarket: s.transferMarket,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const [showNegotiation, setShowNegotiation] = useState(false);

  useEffect(() => {
    if (gem) hapticHeavy();
  }, [gem]);

  // Reset negotiation state when gem changes
  useEffect(() => {
    setShowNegotiation(false);
  }, [gem?.playerId]);

  if (!gem) return null;

  const player = players[gem.playerId];
  if (!player) return null;

  const myClub = clubs[playerClubId];
  const playerClub = clubs[player.clubId];
  const jerseyColor = playerClub?.color || '#d4a843';

  const potentialGap = player.potential - player.overall;
  const wageDemand = myClub ? calculateWageDemand(player, myClub.reputation) : player.wage;
  const personalityLabel = player.personality ? getPersonalityLabel(player.personality) : null;

  const listing = transferMarket.find(l => l.playerId === gem.playerId);

  const dismiss = () => {
    useGameStore.setState({ pendingGemReveal: null });
  };

  const handleSignPlayer = () => {
    if (listing) {
      setShowNegotiation(true);
    }
  };

  const handleViewReports = () => {
    dismiss();
    setScreen('scouting');
  };

  // Show transfer negotiation overlay
  if (showNegotiation && listing) {
    return (
      <TransferNegotiation
        listing={listing}
        onClose={() => {
          setShowNegotiation(false);
          dismiss();
        }}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[58] flex items-center justify-center bg-black/70 px-4"
        onClick={dismiss}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full max-w-sm bg-card border border-primary/40 rounded-2xl overflow-hidden shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary/10 px-5 py-4 text-center border-b border-primary/20">
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
            </motion.div>
            <p className="text-lg font-black text-primary font-display uppercase tracking-wide">Hidden Gem Found!</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Discovered in {gem.region}</p>
            </div>
          </div>

          {/* Player Info */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              {/* Player Card */}
              <div
                className="w-[52px] h-[66px] rounded-xl flex flex-col items-center justify-between py-1.5 relative overflow-hidden border shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${lighten(jerseyColor, 0.1)} 0%, ${darken(jerseyColor, 0.35)} 100%)`,
                  borderColor: `${darken(jerseyColor, 0.15)}`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
                <span className="relative z-10 text-[8px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded-full leading-tight tracking-wide">
                  {player.position}
                </span>
                <span className={cn('relative z-10 text-xl font-black font-display tabular-nums leading-none drop-shadow-md',
                  player.overall >= 80 ? 'text-emerald-400' : player.overall >= 70 ? 'text-sky-400' : player.overall >= 60 ? 'text-amber-400' : 'text-white'
                )}>
                  {player.overall}
                </span>
                <span className="relative z-10 text-[9px] font-bold text-white/60 tabular-nums leading-tight">
                  #{player.squadNumber ?? '—'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground">{player.position} · Age {player.age}</p>
                {personalityLabel && (
                  <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 font-medium">
                    {personalityLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Overall</p>
                <p className={cn(
                  'text-lg font-black tabular-nums',
                  player.overall >= 80 ? 'text-emerald-400' : player.overall >= 70 ? 'text-sky-400' : player.overall >= 60 ? 'text-amber-400' : 'text-foreground'
                )}>{player.overall}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-center">
                <p className="text-[10px] text-primary/70">Potential</p>
                <p className="text-lg font-black text-primary tabular-nums">{player.potential}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Growth</p>
                <p className={cn('text-lg font-black tabular-nums', potentialGap > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
                  {potentialGap > 0 ? `+${potentialGap}` : potentialGap === 0 ? 'Max' : `${potentialGap}`}
                </p>
              </div>
            </div>

            {/* Market Value & Wage */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                <Banknote className="w-4 h-4 text-primary/60 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Market Value</p>
                  <p className="text-sm font-bold text-foreground">{formatMoney(player.value)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                <Briefcase className="w-4 h-4 text-primary/60 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Wage Demand</p>
                  <p className="text-sm font-bold text-foreground">{formatWage(wageDemand)}</p>
                </div>
              </div>
            </div>

            {/* Asking Price (if listed) */}
            {listing && (
              <div className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">Asking Price</span>
                <span className="text-sm font-bold text-primary">{formatMoney(listing.askingPrice)}</span>
              </div>
            )}

            {/* Recommendation */}
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 font-medium">
                {potentialGap <= 0 ? 'Already at peak — ready to contribute now' :
                 potentialGap >= 15 ? 'Generational talent — sign immediately!' :
                 potentialGap >= 10 ? 'Exceptional potential — a star in the making' :
                 'Quality prospect — could become a key player'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 space-y-2">
            {listing && (
              <Button className="w-full gap-2" onClick={handleSignPlayer}>
                <UserCheck className="w-4 h-4" />
                Sign Player
              </Button>
            )}
            <button
              onClick={handleViewReports}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors font-medium"
            >
              View Scouting Reports
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
