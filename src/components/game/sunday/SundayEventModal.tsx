/**
 * The decision modal — the mode's main interactive beat.
 *
 * Two states, in one component because they are one interaction: the question,
 * then what came of it. Splitting them meant the outcome could be dismissed
 * before it was read, and re-mounting lost which choice had been taken.
 *
 * The modal is deliberately NOT dismissible by tapping away or pressing Escape.
 * `advanceSundayWeek` refuses to run while an event is pending, so a dismissed
 * event would silently stall the week with nothing on screen explaining why.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LiquidButton } from '@/components/game/LiquidButton';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SUNDAY_EVENT_CATEGORY_ICON, SUNDAY_EVENT_CATEGORY_TONE } from '@/config/sundayIcons';

export function SundayEventModal() {
  const { t } = useTranslation();
  const event = useGameStore(s => s.sunday?.pendingEvent ?? null);
  const resolve = useGameStore(s => s.resolveSundayEvent);
  const [outcome, setOutcome] = useState<string | null>(null);
  // Guards the window between the click and the store update: without it a
  // double tap resolves the same event twice and applies its effects twice.
  const [resolving, setResolving] = useState(false);

  if (!event && !outcome) return null;

  const Icon = event ? SUNDAY_EVENT_CATEGORY_ICON[event.category] : SUNDAY_EVENT_CATEGORY_ICON.comedy;
  const tone = event ? SUNDAY_EVENT_CATEGORY_TONE[event.category] : SUNDAY_EVENT_CATEGORY_TONE.club;

  const choose = async (choiceId: string) => {
    // Set synchronously, BEFORE the await: the action is async (the mode's
    // implementation is a lazy chunk), so a second tap in the same frame would
    // otherwise resolve the same event twice.
    if (resolving) return;
    setResolving(true);
    const result = await resolve(choiceId);
    setOutcome(result?.outcome ?? '');
    setResolving(false);
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        {outcome !== null ? (
          <>
            <DialogTitle className="text-title font-display">{t('sunday.event.outcome')}</DialogTitle>
            <DialogDescription className="text-body text-foreground/90 leading-relaxed">
              {outcome || t('sunday.event.acknowledge')}
            </DialogDescription>
            <LiquidButton tone="primary" className="w-full mt-2" onClick={() => setOutcome(null)}>
              {t('sunday.event.continue')}
            </LiquidButton>
          </>
        ) : event ? (
          <>
            <div className="flex items-start gap-3">
              <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', tone)} aria-hidden>
                <Icon className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-title font-display leading-tight">{event.title}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-body text-foreground/85 leading-relaxed">
              {event.body}
            </DialogDescription>
            <div className="space-y-2 mt-1">
              {event.choices.map(choice => (
                <LiquidButton
                  key={choice.id}
                  className="w-full py-2.5 text-left"
                  disabled={resolving}
                  onClick={() => { void choose(choice.id); }}
                >
                  <span className="block w-full">
                    <span className="block text-body font-semibold">{choice.label}</span>
                    {choice.hint && (
                      <span className="block text-micro text-muted-foreground mt-0.5">{choice.hint}</span>
                    )}
                  </span>
                </LiquidButton>
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
