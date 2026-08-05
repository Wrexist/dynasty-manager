import { HeartPulse, LogOut, Repeat2, Tag, FileText, ShieldAlert } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Player } from '@/types/game';
import { getContractUrgency } from '@/utils/contracts';
import { StatusPill } from './StatusPill';

interface PlayerStatusBadgesProps {
  player: Player;
  /** Current season — required to resolve contract urgency. */
  season: number;
  /** Current week — required to hide stale suspensions. */
  week?: number;
  /**
   * Mutually exclusive top pills (caller-provided, context-dependent).
   * Shown above the intrinsic player-state pills. E.g. XI / SUB on the
   * squad page; READY on the youth page.
   */
  contextBadge?: React.ReactNode;
  /**
   * When true, omit the contract-urgency pill. Useful in contexts where
   * the card already surfaces contract state another way (e.g. signing
   * negotiation modals).
   */
  hideContract?: boolean;
}

/**
 * Stack of at-a-glance player status pills. Reads intrinsic player state
 * (injured / suspended / wantsToLeave / onLoan / listedForSale /
 * contract-near-expiry) and renders them in a consistent, priority-
 * ordered list. Pills suppress each other when they'd be redundant (no
 * OUT pill for injured players, no LOAN pill when wantsToLeave overrides).
 *
 * Position the wrapping `<div>` with absolute / flex parent styles.
 */
export function PlayerStatusBadges({
  player,
  season,
  week,
  contextBadge,
  hideContract = false,
}: PlayerStatusBadgesProps) {
  const { t } = useTranslation();
  const isSuspended =
    player.suspendedUntilWeek != null &&
    (week === undefined || player.suspendedUntilWeek > week);
  const contractUrgency = hideContract
    ? null
    : getContractUrgency(player.contractEnd, season);

  return (
    <div className="flex flex-col gap-1 items-end">
      {contextBadge}
      {player.injured && (
        <StatusPill
          tone="red"
          Icon={HeartPulse}
          label={`${player.injuryWeeks || '?'}w`}
          title={`Injured — ${player.injuryWeeks || '?'} wk(s)`}
        />
      )}
      {!player.injured && isSuspended && (
        <StatusPill
          tone="red"
          Icon={ShieldAlert}
          label={
            week !== undefined && player.suspendedUntilWeek
              ? `${Math.max(1, player.suspendedUntilWeek - week)}w`
              : undefined
          }
          title={
            week !== undefined && player.suspendedUntilWeek
              ? `Suspended until week ${player.suspendedUntilWeek}`
              : 'Suspended'
          }
        />
      )}
      {!player.injured && !isSuspended && player.wantsToLeave && (
        <StatusPill tone="amber" Icon={LogOut} label="OUT" title={t('playerStatusBadges.wantsToLeave')} />
      )}
      {!player.injured && !isSuspended && !player.wantsToLeave && player.onLoan && (
        <StatusPill tone="sky" Icon={Repeat2} label="LOAN" title={t('playerStatusBadges.onLoan')} />
      )}
      {!player.injured &&
        !isSuspended &&
        !player.wantsToLeave &&
        !player.onLoan &&
        player.listedForSale && (
          <StatusPill tone="primary" Icon={Tag} label="LIST" title={t('playerStatusBadges.listedForSale')} />
        )}
      {contractUrgency && !player.onLoan && !player.injured && (
        <StatusPill
          tone={contractUrgency === 'expired' ? 'red' : 'amber'}
          Icon={FileText}
          title={
            contractUrgency === 'expired'
              ? `Contract expires end of this season (S${player.contractEnd})`
              : `Contract expires end of next season (S${player.contractEnd})`
          }
        />
      )}
    </div>
  );
}
