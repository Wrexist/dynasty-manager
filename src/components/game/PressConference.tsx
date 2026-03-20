import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { Mic, X, MessageSquare } from 'lucide-react';
import type { PressResponseTone } from '@/types/game';

const TONE_STYLES: Record<PressResponseTone, { label: string; color: string; icon: string }> = {
  confident: { label: 'Bold', color: 'border-primary/50 hover:bg-primary/10', icon: '💪' },
  humble: { label: 'Humble', color: 'border-emerald-500/50 hover:bg-emerald-500/10', icon: '🤝' },
  deflect: { label: 'Deflect', color: 'border-muted-foreground/50 hover:bg-muted/30', icon: '🤐' },
};

export function PressConference() {
  const { pendingPressConference, respondToPress, dismissPress } = useGameStore();

  if (!pendingPressConference) return null;

  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Mic className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Press Conference</p>
            <p className="text-[10px] text-muted-foreground">Post-match interview</p>
          </div>
        </div>
        <button
          onClick={dismissPress}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          title="Skip (small penalty)"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Question */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-foreground italic">"{pendingPressConference.question}"</p>
        </div>
      </div>

      {/* Response Options */}
      <div className="space-y-2">
        {pendingPressConference.options.map((option) => {
          const style = TONE_STYLES[option.tone];
          return (
            <button
              key={option.tone}
              onClick={() => respondToPress(option.tone)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98]',
                style.color
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground mb-0.5">{style.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">"{option.text}"</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {option.effects.morale > 0 && <span className="text-[9px] text-emerald-400">Morale +{option.effects.morale}</span>}
                  {option.effects.morale < 0 && <span className="text-[9px] text-destructive">Morale {option.effects.morale}</span>}
                  {option.effects.boardConfidence > 0 && <span className="text-[9px] text-primary">Board +{option.effects.boardConfidence}</span>}
                  {option.effects.boardConfidence < 0 && <span className="text-[9px] text-destructive">Board {option.effects.boardConfidence}</span>}
                  {option.effects.fanMood > 3 && <span className="text-[9px] text-amber-400">Fans +{option.effects.fanMood}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
