import { ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { getRatingColor, getTop3Attributes, getPlayerTier } from '@/utils/uiHelpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import { TierBorderFrame } from '@/components/game/TierBorderFrame';

interface TransferPlayerCardProps {
  player: Player;
  onSelect: (id: string) => void;
  rightContent: ReactNode;
  actions: ReactNode;
  subtitle?: ReactNode;
  showFlag?: boolean;
  showPotential?: boolean;
  animationIndex?: number;
}

export function TransferPlayerCard({
  player,
  onSelect,
  rightContent,
  actions,
  subtitle,
  showFlag = false,
  showPotential = false,
  animationIndex,
}: TransferPlayerCardProps) {
  const top3 = useMemo(() => getTop3Attributes(player.attributes), [player.attributes]);
  const tier = getPlayerTier(player.overall);

  const card = (
    <GlassPanel className="p-4">
      <div className="flex items-start gap-3">
        <TierBorderFrame
          tier={tier}
          glow
          outerRadiusClass="rounded-full"
          innerRadiusClass="rounded-full"
          className="shrink-0"
        >
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
            <span className={cn('font-mono font-black text-lg', tier.textClass)}>
              {player.overall}
            </span>
          </div>
        </TierBorderFrame>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            className="text-left w-full"
            aria-label={`View ${player.firstName} ${player.lastName}`}
            onClick={() => onSelect(player.id)}
          >
            <p className="font-bold text-foreground text-sm">
              {showFlag && <FlagIcon nationality={player.nationality} size={16} />}
              {showFlag ? ' ' : ''}{player.firstName} {player.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {player.position} {'\u2022'} {player.age}y
              {showPotential && <> {'\u2022'} POT {player.potential || player.overall}</>}
            </p>
          </button>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          <div className="flex gap-2 mt-1.5">
            {top3.map(attr => (
              <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                <span className="text-muted-foreground">{attr.label}</span>{' '}
                <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">{rightContent}</div>
      </div>
      <div className="flex gap-2 mt-3">{actions}</div>
    </GlassPanel>
  );

  if (animationIndex != null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(animationIndex * 0.04, 0.4), duration: 0.2 }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}
