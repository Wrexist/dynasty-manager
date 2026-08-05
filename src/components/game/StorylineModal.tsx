import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { X, BookOpen } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { GlassPanel } from '@/components/game/GlassPanel';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';
import { STORYLINE_CHAINS } from '@/data/storylineChains';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';

export function StorylineModal() {
  const { t } = useTranslation();
  const pendingStoryline = useGameStore(s => s.pendingStoryline);
  const activeStorylineChains = useGameStore(s => s.activeStorylineChains);
  const respondToStoryline = useGameStore(s => s.respondToStoryline);
  const dismissStoryline = useGameStore(s => s.dismissStoryline);
  // Presentation queue (G3): show + buzz only when we're the active overlay.
  const active = usePresentationSlot('storyline', !!pendingStoryline);
  const visible = !!pendingStoryline && active;

  // Derive chain context for multi-step storylines
  const chainContext = useMemo(() => {
    if (!pendingStoryline?.id.startsWith('chain-')) return null;
    const parts = pendingStoryline.id.split('-');
    const chainId = parts.slice(1, parts.length - 2).join('-');
    const stepIdxRaw = parseInt(parts[parts.length - 1], 10);
    const stepIdx = Number.isFinite(stepIdxRaw) ? stepIdxRaw : 0;
    const chain = activeStorylineChains.find(c => c.chainId === chainId);
    const chainDef = STORYLINE_CHAINS.find(c => c.id === chainId);
    if (!chainDef) return null;
    return { name: chainDef.name, step: stepIdx + 1, total: chainDef.steps.length, chain };
  }, [pendingStoryline, activeStorylineChains]);

  useEffect(() => {
    if (visible) hapticMedium();
  }, [visible]);

  if (!visible) return null;

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
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              {chainContext ? chainContext.name : 'Storyline Event'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {chainContext
                ? `${pendingStoryline.title} — Step ${chainContext.step} of ${chainContext.total}`
                : pendingStoryline.title}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissStoryline}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-2.5 rounded-lg hover:bg-muted/50 transition-colors"
          aria-label={t('storylineModal.dismissStorylineEvent')}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <GlassPanel className="p-3 ring-1 ring-amber-500/20">
        {/* Left accent stripe — amber for storyline narrative tone. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-400/70 to-amber-400/15"
        />
        <div className="flex items-start gap-2 pl-1">
          <BookOpen className="w-4 h-4 text-amber-400/80 mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-relaxed">{pendingStoryline.body}</p>
        </div>
      </GlassPanel>

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
