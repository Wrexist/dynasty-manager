import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { X, BookOpen } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { GlassPanel } from '@/components/game/GlassPanel';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';
import { STORYLINE_CHAINS } from '@/data/storylineChains';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

/**
 * The pending storyline decision, as a sheet the player opens.
 *
 * It used to render as a large inline card at the very top of the Dashboard —
 * above the Continue button, which a three-choice story pushed to y≈650
 * (playthrough 2026-09, R17). The decision is now a row in "Needs your
 * attention" (`selectAttentionItems`, id 'storyline') and this sheet opens
 * from it. Closing the sheet keeps the decision pending; "Ignore this story"
 * is the old dismiss. Not part of the post-advance presentation queue any
 * more: it only shows when asked for, so it never holds other popups back.
 */
export function StorylineModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const pendingStoryline = useGameStore(s => s.pendingStoryline);
  const activeStorylineChains = useGameStore(s => s.activeStorylineChains);
  const respondToStoryline = useGameStore(s => s.respondToStoryline);
  const dismissStoryline = useGameStore(s => s.dismissStoryline);
  const reduced = useReducedMotionPref();
  const visible = !!pendingStoryline;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, visible);
  useEscapeClose(onClose, visible);

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
    <div
      className="fixed inset-0 z-[60] flex cursor-pointer items-end justify-center bg-black/70 backdrop-blur-sm px-3 pb-3 sm:items-center safe-area-bottom"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyline-sheet-title"
      tabIndex={-1}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-lg max-h-[85dvh] overflow-y-auto cursor-auto outline-none bg-card/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <DynamicIcon name={pendingStoryline.icon} className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 id="storyline-sheet-title" className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              {chainContext ? chainContext.name : 'Storyline Event'}
            </h2>
            <p className="text-micro text-muted-foreground">
              {chainContext
                ? `${pendingStoryline.title} — Step ${chainContext.step} of ${chainContext.total}`
                : pendingStoryline.title}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-2.5 rounded-lg hover:bg-muted/50 transition-colors"
          aria-label={t('storylineModal.decideLater')}
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
              onClick={() => { respondToStoryline(index); onClose(); }}
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
                  {option.effects.morale && option.effects.morale > 0 && <span className="text-micro text-emerald-400">Morale +{option.effects.morale}</span>}
                  {option.effects.morale && option.effects.morale < 0 && <span className="text-micro text-destructive">Morale {option.effects.morale}</span>}
                  {option.effects.boardConfidence && option.effects.boardConfidence > 0 && <span className="text-micro text-primary">Board +{option.effects.boardConfidence}</span>}
                  {option.effects.boardConfidence && option.effects.boardConfidence < 0 && <span className="text-micro text-destructive">Board {option.effects.boardConfidence}</span>}
                  {option.effects.playerMorale && option.effects.playerMorale > 0 && <span className="text-micro text-emerald-400">Player +{option.effects.playerMorale}</span>}
                  {option.effects.playerMorale && option.effects.playerMorale < 0 && <span className="text-micro text-destructive">Player {option.effects.playerMorale}</span>}
                  {option.effects.fanMood && option.effects.fanMood > 0 && <span className="text-micro text-amber-400">Fans +{option.effects.fanMood}</span>}
                  {option.effects.fanMood && option.effects.fanMood < 0 && <span className="text-micro text-destructive">Fans {option.effects.fanMood}</span>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* The old dismiss: let the story go without answering it. */}
      <button
        type="button"
        onClick={() => { dismissStoryline(); onClose(); }}
        className="w-full min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('storylineModal.ignoreStory')}
      </button>
    </motion.div>
    </div>
  );
}
