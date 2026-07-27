import { useState, useMemo } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { formatMoney } from '@/utils/helpers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PlayerCard } from '@/components/game/PlayerCard';
import { LIST_PRICE_MULTIPLIER, LISTING_PRICE_FLOOR, LISTING_PRICE_MIN_RATIO, LISTING_PRICE_MAX_RATIO } from '@/config/transfers';
import { LISTING_ATTRACTIVENESS } from '@/config/ui';
import { hapticMedium } from '@/utils/haptics';
import {
  X, Tag, TrendingUp, TrendingDown, Minus, Wallet, Users, Star, ArrowRight,
} from 'lucide-react';

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

  // Guard against zero/tiny values — use LISTING_PRICE_FLOOR as absolute minimum
  const safeValue = Math.max(player.value, LISTING_PRICE_FLOOR);
  const defaultPrice = Math.max(LISTING_PRICE_FLOOR, Math.round(safeValue * LIST_PRICE_MULTIPLIER));
  const minPrice = Math.max(LISTING_PRICE_FLOOR, Math.round(safeValue * LISTING_PRICE_MIN_RATIO));
  const maxPrice = Math.max(LISTING_PRICE_FLOOR * 2, Math.round(safeValue * LISTING_PRICE_MAX_RATIO));
  const step = Math.max(10_000, Math.round(safeValue * 0.02));

  const [askingPrice, setAskingPrice] = useState(defaultPrice);

  useScrollLock();
  useEscapeClose(onClose);

  const top3 = useMemo(() => getTop3Attributes(player.attributes), [player]);

  const priceRatio = safeValue > 0 ? ((askingPrice - safeValue) / safeValue) * 100 : 0;
  // Slider fill percentage — the visible rail is painted separately from the
  // (transparent, 44pt-tall) input, so the filled portion is computed here.
  const pricePercent = maxPrice > minPrice
    ? ((askingPrice - minPrice) / (maxPrice - minPrice)) * 100
    : 0;

  const contractYears = Math.max(0, player.contractEnd - season);

  // Estimate how attractive this listing is to buyers
  const attractiveness = useMemo(() => {
    const ratio = askingPrice / safeValue;
    const tier = LISTING_ATTRACTIVENESS.find(t => ratio <= t.maxRatio) || LISTING_ATTRACTIVENESS[LISTING_ATTRACTIVENESS.length - 1];
    return { label: tier.label, color: tier.color };
  }, [askingPrice, safeValue]);

  const positionCount = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.position === player.position).length;
  }, [club, players, player.position]);

  const hasPotential = player.potential > player.overall;

  const handleList = () => {
    hapticMedium();
    const result = listPlayerForSale(player.id, askingPrice);
    onListed(result.appeased);
    onClose();
  };

  if (!club) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-[env(safe-area-inset-top,40px)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border border-border/50 rounded-b-2xl sm:rounded-2xl sm:mx-4"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="list-for-sale-title"
        >
          {/* Player Header */}
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" aria-hidden />
                <p id="list-for-sale-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">List for Sale</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="min-w-11 min-h-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <PlayerCard player={player} size="md" interactive="none" compact />
                {hasPotential && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[9px] font-black flex items-center gap-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.5)] z-10">
                    <Star className="w-2.5 h-2.5" />{player.potential}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground font-display text-base leading-tight">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {player.position} · {player.age}y · <FlagIcon nationality={player.nationality} size={14} /> {player.nationality}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Wage: <span className="text-foreground/80">{formatWage(player.wage)}</span>
                  <span className="mx-1">·</span>
                  Contract: <span className="text-foreground/80">{contractYears}y</span>
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
                <span className="text-foreground font-semibold">{formatMoney(player.value)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Suggested </span>
                <span className="text-primary font-bold">{formatMoney(defaultPrice)}</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Asking Price</span>
              <span className="text-xl font-black text-primary font-display tabular-nums">
                {formatMoney(askingPrice)}
              </span>
            </div>

            {/* 44pt-tall grab area with the rail painted as an absolute
                sibling — the input's own box IS its hit box. */}
            <div className="relative h-11">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-muted overflow-hidden"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pricePercent}%` }} />
              </div>
              <input
                type="range"
                min={minPrice}
                max={maxPrice}
                step={step}
                value={askingPrice}
                onChange={(e) => setAskingPrice(Number(e.target.value))}
                aria-label="Asking price"
                className="range-touch relative z-10"
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums mt-0.5">
              <span>{formatMoney(minPrice)}</span>
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
              <span>{formatMoney(maxPrice)}</span>
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

          {/* Action button — extra bottom inset on mobile keeps the CTA clear
              of the iOS home indicator when the modal stretches near 85vh. */}
          <div className="border-t border-border/30 bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={handleList}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(16,185,129,0.25)]"
            >
              List for {formatMoney(askingPrice)} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
