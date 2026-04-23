import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Player } from '@/types/game';
import { GlassPanel } from '@/components/game/GlassPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PlayerCard } from '@/components/game/PlayerCard';

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

/**
 * Transfer-market list row. The left column is a {@link PlayerCard}
 * (size="lg", 150×200) in 'detail' mode — tapping the card opens the
 * player page. The right column shows age + optional POT + a caller-
 * provided subtitle (e.g. "From: Liverpool") and right-aligned price /
 * status metadata. Action buttons span the full row below.
 *
 * The stat chips that used to live here have been retired: the shield
 * card already shows all six attributes on its face.
 */
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
  const card = (
    <GlassPanel className="relative overflow-hidden p-3">
      <div className="flex gap-3">
        <PlayerCard
          player={player}
          size="lg"
          interactive="detail"
          showConditionView={false}
          onDetailClick={(p) => onSelect(p.id)}
          className="shrink-0"
        />

        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm flex items-center gap-1.5 min-w-0">
              {showFlag && <FlagIcon nationality={player.nationality} size={14} className="shrink-0" />}
              <span className="truncate">{player.firstName} {player.lastName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {player.position} {'•'} {player.age}y
              {showPotential && <> {'•'} POT {player.potential || player.overall}</>}
            </p>
            {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          <div className="text-right shrink-0">{rightContent}</div>
        </div>
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
