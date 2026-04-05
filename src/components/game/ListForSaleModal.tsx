import { useState, useMemo } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { getFlag } from '@/utils/nationality';
import { LIST_PRICE_MULTIPLIER, LISTING_PRICE_FLOOR } from '@/config/transfers';
import {
  X, Tag, TrendingUp, TrendingDown, Minus, Wallet, Users, Star, ArrowRight,
} from 'lucide-react';

/** Format money values compactly */
function fmtM(v: number): string {
  if (Math.abs(v) >= 1e6) return `£${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `£${(v / 1e3).toFixed(0)}K`;
  return `£${v}`;
}

interface Props {
  player: Player;
  onClose: () => void;
  onListed: (appeased: boolean) => void;
}

export function ListForSaleModal({ player, onClose, onListed }: Props) {
  const { clubs, playerClubId, players, season } = useGameStore(useShallow(s => ({
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    players: s.players,
    season: s.season,
  })));
  const listPlayerForSale = useGameStore(s => s.listPlayerForSale);

  const club = clubs[playerClubId];

  const defaultPrice = Math.max(LISTING_PRICE_FLOOR, Math.round(player.value * LIST_PRICE_MULTIPLIER));
  const minPrice = Math.max(LISTING_PRICE_FLOOR, Math.round(player.value * 0.5));
  const maxPrice = Math.round(player.value * 2.0);
  const step = Math.max(50_000, Math.round(player.value * 0.02));

  const [askingPrice, setAskingPrice] = useState(defaultPrice);

  useScrollLock();

  const top3 = useMemo(() => getTop3Attributes(player.attributes), [player]);

  const priceRatio = player.value > 0 ? ((askingPrice - player.value) / player.value) * 100 : 0;

  // Estimate how attractive this listing is to buyers
  const attractiveness = useMemo(() => {
    const ratio = askingPrice / player.value;
    if (ratio <= 0.8) return { label: 'Bargain', color: 'text-emerald-400' };
    if (ratio <= 1.1) return { label: 'Fair', color: 'text-emerald-400' };
    if (ratio <= 1.4) return { label: 'Normal', color: 'text-amber-400' };
    if (ratio <= 1.7) return { label: 'Steep', color: 'text-amber-400' };
    return { label: 'Unlikely', color: 'text-red-400' };
  }, [askingPrice, player.value]);

  const positionCount = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.position === player.position).length;
  }, [club, players, player.position]);

  const hasPotential = player.potential > player.overall;

  const handleList = () => {
    const result = listPlayerForSale(player.id, askingPrice);
    onListed(result.appeased);
    onClose();
  };

  if (!club) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-card/95 backdrop-blur-xl border border-border/50 rounded-t-2xl sm:rounded-2xl overflow-hidden sm:mx-4"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          {/* Player Header */}
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">List for Sale</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 relative">
                <span className={cn('font-mono font-black text-2xl', getRatingColor(player.overall))}>
                  {player.overall}
                </span>
                {hasPotential && (
                  <span className="absolute -top-1 -right-1 bg-primary/20 border border-primary/40 rounded-md px-1 py-px text-[9px] font-bold text-primary flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5" />{player.potential}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground font-display text-base leading-tight">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {player.position} · {player.age}y · {getFlag(player.nationality)} {player.nationality}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Wage: <span className="text-foreground/80">{formatWage(player.wage)}</span>
                  <span className="mx-1">·</span>
                  Contract: <span className="text-foreground/80">{player.contractEnd - season}y</span>
                </p>
              </div>
            </div>
            {/* Top attributes */}
            <div className="flex gap-1.5 mt-2.5">
              {top3.map(attr => (
                <span key={attr.label} className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                  <span className="text-muted-foreground">{attr.label}</span>{' '}
                  <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          {/* Price picker */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between text-xs mb-3">
              <div>
                <span className="text-muted-foreground">Market Value </span>
                <span className="text-foreground font-semibold">{fmtM(player.value)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Suggested </span>
                <span className="text-primary font-bold">{fmtM(defaultPrice)}</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Asking Price</span>
              <span className="text-xl font-black text-primary font-display tabular-nums">
                {fmtM(askingPrice)}
              </span>
            </div>

            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={step}
              value={askingPrice}
              onChange={(e) => setAskingPrice(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums mt-0.5">
              <span>{fmtM(minPrice)}</span>
              <div className="flex items-center gap-1">
                {priceRatio > 5 && <TrendingUp className="w-3 h-3 text-amber-400" />}
                {priceRatio < -5 && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                {Math.abs(priceRatio) <= 5 && <Minus className="w-3 h-3 text-muted-foreground" />}
                <span className={cn('font-semibold',
                  priceRatio > 5 ? 'text-amber-400' : priceRatio < -5 ? 'text-emerald-400' : 'text-muted-foreground'
                )}>
                  {priceRatio > 0 ? '+' : ''}{priceRatio.toFixed(0)}% vs value
                </span>
              </div>
              <span>{fmtM(maxPrice)}</span>
            </div>

            {/* Buyer interest indicator */}
            <div className="flex items-center justify-between text-xs mt-3">
              <span className="text-muted-foreground">Buyer Interest</span>
              <span className={cn('font-bold text-[11px]', attractiveness.color)}>{attractiveness.label}</span>
            </div>
          </div>

          <div className="h-px bg-border/30" />

          {/* Impact row */}
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5 flex-1">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Wage saved:</span>
                <span className="font-bold text-emerald-400 tabular-nums">{formatWage(player.wage)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{player.position}s left:</span>
                <span className={cn('font-bold', positionCount <= 2 ? 'text-amber-400' : 'text-foreground')}>{positionCount - 1}</span>
              </div>
            </div>
            {positionCount <= 2 && (
              <p className="text-[10px] text-amber-400 mt-1.5">
                Low cover at {player.position} — consider a replacement first
              </p>
            )}
            {player.wantsToLeave && (
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                Player wants to leave — listing may improve morale
              </p>
            )}
          </div>

          {/* Action button */}
          <div className="border-t border-border/30 bg-card/95 px-4 py-3">
            <button
              type="button"
              onClick={handleList}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(16,185,129,0.25)]"
            >
              List for {fmtM(askingPrice)} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
