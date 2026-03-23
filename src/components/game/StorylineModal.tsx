import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { X, BookOpen } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';

export function StorylineModal() {
  const { pendingStoryline, respondToStoryline, dismissStoryline } = useGameStore();

  useEffect(() => {
    if (pendingStoryline) hapticMedium();
  }, [pendingStoryline]);

  if (!pendingStoryline) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-card/80 backdrop-blur-xl border border-amber-500/30 rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <DynamicIcon name={pendingStoryline.icon} className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Storyline Event</p>
            <p className="text-[10px] text-muted-foreground">{pendingStoryline.title}</p>
          </div>
        </div>
        <button
          onClick={dismissStoryline}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">{pendingStoryline.body}</p>
        </div>
      </div>

      {/* Response Options */}
      <div className="space-y-2">
        {pendingStoryline.options.map((option, index) => {
          return (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
              onClick={() => respondToStoryline(index)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98]',
                'border-border/50 hover:bg-muted/30'
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
                  {option.effects.boardConfidence && option.effects.boardConfidence > 0 && <span className="text-[9px] text-primary">Board +{option.effects.boardConfidence}</span>}
                  {option.effects.boardConfidence && option.effects.boardConfidence < 0 && <span className="text-[9px] text-destructive">Board {option.effects.boardConfidence}</span>}
                  {option.effects.playerMorale && option.effects.playerMorale > 0 && <span className="text-[9px] text-emerald-400">Player +{option.effects.playerMorale}</span>}
                  {option.effects.playerMorale && option.effects.playerMorale < 0 && <span className="text-[9px] text-destructive">Player {option.effects.playerMorale}</span>}
                  {option.effects.fanMood && option.effects.fanMood > 0 && <span className="text-[9px] text-amber-400">Fans +{option.effects.fanMood}</span>}
                  {option.effects.fanMood && option.effects.fanMood < 0 && <span className="text-[9px] text-destructive">Fans {option.effects.fanMood}</span>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
