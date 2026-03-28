import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { X, ArrowLeftRight, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';

export function PlayerTransferTalk() {
  const { pendingTransferTalk, respondToTransferTalk, dismissTransferTalk, players } = useGameStore();

  useEffect(() => {
    if (pendingTransferTalk) hapticMedium();
  }, [pendingTransferTalk]);

  if (!pendingTransferTalk) return null;

  const player = players[pendingTransferTalk.playerId];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-card/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">Transfer Request</p>
            <p className="text-[10px] text-muted-foreground">{pendingTransferTalk.playerName}</p>
          </div>
        </div>
        <button
          onClick={dismissTransferTalk}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Player Info */}
      {player && (
        <div className="flex items-center gap-3 bg-muted/20 rounded-lg px-3 py-2">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-sm font-bold text-foreground/70">
            {player.firstName[0]}{player.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{player.firstName} {player.lastName}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{player.position}</span>
              <span>Age {player.age}</span>
              <span className={cn(
                'font-bold',
                player.overall >= 80 ? 'text-emerald-400' :
                player.overall >= 70 ? 'text-primary' :
                player.overall >= 60 ? 'text-amber-400' : 'text-muted-foreground'
              )}>{player.overall} OVR</span>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Body */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <MessageCircle className="w-4 h-4 text-orange-400/70 mt-0.5 shrink-0" />
          <p className="text-sm text-foreground italic leading-relaxed">{pendingTransferTalk.body}</p>
        </div>
      </div>

      {/* Response Options */}
      <div className="space-y-2">
        {pendingTransferTalk.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
            onClick={() => respondToTransferTalk(index)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98]',
              option.tone === 'refuse'
                ? 'border-destructive/30 hover:bg-destructive/10'
                : option.tone === 'convince'
                ? 'border-emerald-500/30 hover:bg-emerald-500/10'
                : 'border-border/50 hover:bg-muted/30'
            )}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground mb-0.5">{option.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{option.text}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {option.effects.morale && option.effects.morale > 0 && <span className="text-[9px] text-emerald-400">Morale +{option.effects.morale}</span>}
                {option.effects.morale && option.effects.morale < 0 && <span className="text-[9px] text-destructive">Morale {option.effects.morale}</span>}
                {option.effects.teamMorale && option.effects.teamMorale < 0 && <span className="text-[9px] text-destructive">Team {option.effects.teamMorale}</span>}
                {option.effects.listForSale && <span className="text-[9px] text-amber-400">Lists player</span>}
                {option.effects.withdrawChance && <span className="text-[9px] text-emerald-400">May convince</span>}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
