/**
 * The Dashboard's one-line Manager Pass entry: tier reached and, when there
 * is something to collect, a count badge. It sits below the Continue button,
 * "Needs your attention" and the next match, so it never competes with the
 * core loop — the Pass used to have no home-screen entry at all (only a row
 * deep in the More drawer), so rewards sat uncollected.
 *
 * The numbers come from `passHomeSummary`, which rolls the record into the
 * current season in memory; the Pass page itself does the persisted roll.
 */
import { ChevronRight, Ticket } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { CountBadge } from '@/components/game/CountBadge';
import { isPro } from '@/utils/monetization';
import { passHomeSummary } from '@/utils/managerPass';
import { observeClock } from '@/store/helpers/persistence';
import { MANAGER_PASS_TIER_COUNT } from '@/config/managerPass';
import { hapticLight } from '@/utils/haptics';
import { cn } from '@/lib/utils';

export function DashboardPassRow() {
  const { t } = useTranslation();
  const record = useGameStore(s => s.managerPass);
  const monetization = useGameStore(s => s.monetization);
  const setScreen = useGameStore(s => s.setScreen);
  // Same clock as the slice's actions (the furthest time this device has seen).
  const { tier, claimable } = passHomeSummary(record, isPro(monetization), new Date(observeClock()));

  return (
    <button
      type="button"
      onClick={() => { hapticLight(); setScreen('manager-pass'); }}
      className={cn(
        'w-full min-h-11 flex items-center gap-3 px-4 rounded-2xl border transition-colors text-left',
        claimable > 0
          ? 'border-primary/40 bg-primary/10 hover:bg-primary/15'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
      )}
    >
      <Ticket className="w-4 h-4 text-primary shrink-0" aria-hidden />
      <span className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground truncate">{t('dashboard.pass.title')}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {t('dashboard.pass.tier', { tier, max: MANAGER_PASS_TIER_COUNT })}
        </span>
      </span>
      {claimable > 0 && (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-primary">{t('dashboard.pass.toCollect', { n: claimable })}</span>
          <CountBadge count={claimable} tone="primary" cap={99} />
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
    </button>
  );
}
