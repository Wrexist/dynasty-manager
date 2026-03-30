import { useState, useMemo } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { getFlag } from '@/utils/nationality';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { LoanNegotiation } from '@/components/game/LoanNegotiation';
import { X, Banknote, Repeat2 } from 'lucide-react';

interface Props {
  playerId: string;
  onClose: () => void;
}

type ApproachMode = 'choose' | 'transfer' | 'loan';

export function TransferApproach({ playerId, onClose }: Props) {
  const players = useGameStore(s => s.players);
  const clubs = useGameStore(s => s.clubs);
  const transferMarket = useGameStore(s => s.transferMarket);

  const player = players[playerId];
  const club = player ? clubs[player.clubId] : null;

  // Check if the player is already listed on the transfer market
  const existingListing = transferMarket.find(l => l.playerId === playerId);

  const [mode, setMode] = useState<ApproachMode>(existingListing ? 'transfer' : 'choose');

  const top3 = useMemo(() => player ? getTop3Attributes(player.attributes) : [], [player]);

  useScrollLock(mode === 'choose');

  if (!player || !club) return null;

  // If the player is listed, go straight to TransferNegotiation
  if (mode === 'transfer' && existingListing) {
    return <TransferNegotiation listing={existingListing} onClose={onClose} />;
  }

  // For unlisted players, create a synthetic listing with a premium
  if (mode === 'transfer' && !existingListing) {
    const syntheticListing = {
      playerId: player.id,
      askingPrice: Math.round(player.value * 1.5),
      sellerClubId: player.clubId,
    };
    return <TransferNegotiation listing={syntheticListing} onClose={onClose} />;
  }

  if (mode === 'loan') {
    return <LoanNegotiation playerId={playerId} onClose={onClose} />;
  }

  // Choice screen
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm mx-4 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden"
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <p className="text-sm font-bold text-foreground font-display">Approach Player</p>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Player Card */}
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <span className={cn('font-mono font-black text-2xl', getRatingColor(player.overall))}>
                  {player.overall}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground font-display">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground">{player.position} · {player.age}y · {getFlag(player.nationality)} {player.nationality}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  At <span className="text-foreground">{club.name}</span>
                </p>
                <div className="flex gap-1.5 mt-2">
                  {top3.map(attr => (
                    <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                      <span className="text-muted-foreground">{attr.label}</span>{' '}
                      <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-muted/20 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs font-bold text-foreground tabular-nums">{'\u00A3'}{(player.value / 1e6).toFixed(1)}M</p>
                <p className="text-[10px] text-muted-foreground">Value</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{formatWage(player.wage)}</p>
                <p className="text-[10px] text-muted-foreground">Wage</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground tabular-nums">{player.overall}/{player.potential}</p>
                <p className="text-[10px] text-muted-foreground">OVR/POT</p>
              </div>
            </div>

            {/* Approach Options */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMode('transfer')}
                className="w-full flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Banknote className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">Transfer Offer</p>
                  <p className="text-[10px] text-muted-foreground">
                    Make a bid to sign permanently · Est. {'\u00A3'}{(Math.round(player.value * 1.5) / 1e6).toFixed(1)}M
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('loan')}
                className="w-full flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Repeat2 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">Loan Request</p>
                  <p className="text-[10px] text-muted-foreground">
                    Borrow on a temporary deal · Negotiate terms
                  </p>
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
