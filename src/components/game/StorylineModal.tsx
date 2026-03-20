import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { X, BookOpen } from 'lucide-react';

export function StorylineModal() {
  const { pendingStoryline, respondToStoryline, dismissStoryline } = useGameStore();

  if (!pendingStoryline) return null;

  return (
    <div className="bg-card/80 backdrop-blur-xl border border-amber-500/30 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg">
            {pendingStoryline.icon}
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
          const hasPositive = (option.effects.morale && option.effects.morale > 0) ||
            (option.effects.boardConfidence && option.effects.boardConfidence > 0) ||
            (option.effects.playerMorale && option.effects.playerMorale > 0);
          const hasNegative = (option.effects.morale && option.effects.morale < 0) ||
            (option.effects.boardConfidence && option.effects.boardConfidence < 0) ||
            (option.effects.playerMorale && option.effects.playerMorale < 0);

          return (
            <button
              key={index}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
