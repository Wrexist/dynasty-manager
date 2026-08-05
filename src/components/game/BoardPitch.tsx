import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Briefcase, MessageSquare, X, Users, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import { getReputationTierLabel } from '@/utils/managerCareer';
import type { PitchTone } from '@/types/game';

const PITCH_TONE_STYLES: Record<PitchTone, { label: string; color: string; icon: string }> = {
  ambitious: { label: 'Ambitious', color: 'border-primary/50 hover:bg-primary/10', icon: 'rocket' },
  pragmatic: { label: 'Pragmatic', color: 'border-emerald-500/50 hover:bg-emerald-500/10', icon: 'scale' },
  developmental: { label: 'Developmental', color: 'border-amber-500/50 hover:bg-amber-500/10', icon: 'sprout' },
  defensive: { label: 'Defensive', color: 'border-blue-500/50 hover:bg-blue-500/10', icon: 'shield' },
};

export function BoardPitch() {
  const { t } = useTranslation();
  const { activeInterview } = useGameStore(useShallow(s => ({
    activeInterview: s.activeInterview,
  })));
  const submitPitchResponse = useGameStore(s => s.submitPitchResponse);
  const completeInterview = useGameStore(s => s.completeInterview);
  const dismissInterview = useGameStore(s => s.dismissInterview);

  // Track score feedback animation
  const [scoreFlash, setScoreFlash] = useState<{ value: number; key: number } | null>(null);
  const [prevQuestionIndex, setPrevQuestionIndex] = useState(0);

  const questionIndex = activeInterview?.currentQuestionIndex ?? 0;
  const interviewStep = activeInterview?.step;

  // Detect question advance to show score feedback
  useEffect(() => {
    if (activeInterview && questionIndex > prevQuestionIndex && activeInterview.step === 'pitch') {
      // A question was just answered — show the score delta
      const lastResponse = activeInterview.responses[activeInterview.responses.length - 1];
      if (lastResponse) {
        const prevQ = activeInterview.pitchQuestions[prevQuestionIndex];
        if (prevQ) {
          const option = prevQ.options.find(o => o.tone === lastResponse);
          if (option) {
            setScoreFlash({ value: option.scoreModifier, key: Date.now() });
          }
        }
      }
      setPrevQuestionIndex(questionIndex);
    }
  }, [questionIndex, prevQuestionIndex, activeInterview]);

  // Clear flash after animation
  useEffect(() => {
    if (scoreFlash) {
      const timer = setTimeout(() => setScoreFlash(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [scoreFlash]);

  // Clear flash when step transitions (pitch → result)
  useEffect(() => {
    setScoreFlash(null);
  }, [interviewStep]);

  // Reset tracking when interview starts/ends
  useEffect(() => {
    if (!activeInterview) {
      setPrevQuestionIndex(0);
      setScoreFlash(null);
    }
  }, [activeInterview]);

  if (!activeInterview) return null;

  const { step, pitchQuestions, currentQuestionIndex, competitors, result, resultMessage, clubName } = activeInterview;
  const totalQuestions = pitchQuestions.length;
  const currentQuestion = step === 'pitch' ? pitchQuestions[currentQuestionIndex] : null;

  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Board Interview</p>
            <p className="text-[10px] text-muted-foreground">{clubName}</p>
          </div>
        </div>
        {step === 'pitch' && (
          <div className="flex items-center gap-2">
            {/* Score flash feedback */}
            {scoreFlash && (
              <span
                key={scoreFlash.key}
                className={cn(
                  'text-[10px] font-bold animate-bounce',
                  scoreFlash.value > 0 ? 'text-emerald-400' : scoreFlash.value < 0 ? 'text-red-400' : 'text-muted-foreground'
                )}
              >
                {scoreFlash.value > 0 ? '+' : ''}{scoreFlash.value}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground font-semibold">
              {currentQuestionIndex + 1} / {totalQuestions}
            </span>
            <button
              onClick={dismissInterview}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label={t('boardPitch.withdrawApplication')}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Progress dots */}
      {step === 'pitch' && (
        <div className="flex gap-1.5 justify-center">
          {pitchQuestions.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i < currentQuestionIndex ? 'bg-primary w-4' :
                i === currentQuestionIndex ? 'bg-primary w-6 animate-pulse' :
                'bg-muted/50 w-4'
              )}
            />
          ))}
        </div>
      )}

      {/* Competitors */}
      {competitors.length > 0 && activeInterview.step === 'pitch' && (
        <div className="bg-muted/20 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Competing Candidates
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c, i) => (
              <span
                key={i}
                className="text-[9px] bg-muted/40 text-muted-foreground px-2 py-1 rounded-full"
              >
                {c.name} ({getReputationTierLabel(c.reputationTier)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pitch Question — keyed for CSS transition */}
      {step === 'pitch' && currentQuestion && (
        <div key={currentQuestion.id} className="animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="bg-muted/30 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-foreground italic">"{currentQuestion.question}"</p>
            </div>
          </div>

          <div className="space-y-2">
            {currentQuestion.options.map((option) => {
              const style = PITCH_TONE_STYLES[option.tone];
              return (
                <button
                  key={option.tone}
                  onClick={() => submitPitchResponse(option.tone)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all active:scale-[0.98]',
                    style.color
                  )}
                  aria-label={`${style.label}: ${option.text}`}
                >
                  <div className="flex items-start gap-2">
                    <DynamicIcon name={style.icon} className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground mb-0.5">{style.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">"{option.text}"</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {step === 'result' && (
        <div className="space-y-3 animate-in fade-in duration-500">
          {result === 'hired' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-emerald-400">You're Hired!</p>
              <p className="text-xs text-muted-foreground">{resultMessage}</p>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-center space-y-2">
              <XCircle className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-bold text-foreground">Not Selected</p>
              <p className="text-xs text-muted-foreground">{resultMessage}</p>
            </div>
          )}

          {/* Competitors summary on rejection */}
          {result === 'rejected' && competitors.length > 0 && (
            <div className="bg-muted/20 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground font-semibold mb-1">Other candidates:</p>
              {competitors.map((c, i) => (
                <p key={i} className="text-[10px] text-muted-foreground/70">
                  {c.name} — {getReputationTierLabel(c.reputationTier)} (prev. {c.previousClub})
                </p>
              ))}
            </div>
          )}

          <Button
            size="sm"
            className="w-full h-9 text-xs gap-1.5"
            variant={result === 'hired' ? 'default' : 'outline'}
            onClick={completeInterview}
          >
            {result === 'hired' ? (
              <>
                <ArrowRight className="w-3.5 h-3.5" /> View Offer
              </>
            ) : (
              'Back to Job Market'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
