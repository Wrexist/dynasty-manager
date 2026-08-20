/**
 * Teamsheet — pick who plays out of whoever is actually available.
 *
 * The screen's job is to make the constraint legible: three lists (named,
 * available, unavailable), a live count against the legal minimum, and a set of
 * warnings that only fire when they mean something. The warnings are the part
 * that matters — "your only keeper is a doubt" is the difference between a
 * squad screen and a management decision.
 */
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { AvailabilityPill, PlayerFlags } from '@/components/game/sunday/SundayBits';
import { SundayFitMeter, SundayTacticCard } from '@/components/game/sunday/SundayTacticCard';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  SUNDAY_FULL_XI, SUNDAY_MAX_BENCH, SUNDAY_MIN_START,
  SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK, sundayRingRoundCost,
  SUNDAY_TACTICS, getSundayTactic,
} from '@/config/sundayLeague';
import { isSundaySelectable } from '@/utils/sunday/availability';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { sundayTacticFit } from '@/utils/sunday/match';
import { upgradeLevel } from '@/store/slices/sunday/shared';
import { sundaySideIsSettled } from '@/utils/sunday/primaryAction';
import { canPlayPosition, FORMATION_POSITIONS } from '@/types/game';
import type { Player, SundaySquadMember, SundayTacticId } from '@/types/game';

const WarningIcon = SUNDAY_ICON.warning;
const StartingIcon = SUNDAY_ICON.starting;
const BenchIcon = SUNDAY_ICON.bench;
const AutoPickIcon = SUNDAY_ICON.autoPick;
const ConfirmIcon = SUNDAY_ICON.confirm;
const RingRoundIcon = SUNDAY_ICON.ringRound;
const TacticsIcon = SUNDAY_ICON.tactics;

interface Row {
  member: SundaySquadMember;
  player: Player;
}

/**
 * One name on the sheet.
 *
 * The row and whatever sits on its right are FLAT SIBLINGS, never nested. The
 * captain control used to live inside the row's own <button>, which is invalid
 * DOM (React warns), made the inner control unreachable by keyboard, and needed
 * an `e.stopPropagation()` to stop one tap doing two things. Two siblings in a
 * flex row look identical and behave correctly.
 */
function PlayerRow({ row, right, onClick, dim, captain }: {
  row: Row;
  right?: React.ReactNode;
  onClick?: () => void;
  dim?: boolean;
  captain?: boolean;
}) {
  const { player, member } = row;
  const body = (
    <>
      <span className="w-9 text-micro font-semibold text-muted-foreground shrink-0">{player.position}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-body font-medium text-foreground truncate">
            {player.firstName} {player.lastName}
          </span>
          {/* Form, mood, the armband and any promise — the inputs to the
              decision this screen exists to make. */}
          <PlayerFlags
            captain={captain}
            unsettled={member.unsettled}
            form={player.form}
            promised={!!member.promise}
          />
        </span>
        <span className="block text-micro text-muted-foreground truncate">
          {member.job} · {player.overall} OVR
        </span>
      </span>
    </>
  );
  return (
    <div className={cn('flex items-center gap-1.5', dim && 'opacity-55')}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'min-w-0 flex-1 flex items-center gap-2 py-2 min-h-[44px] text-left rounded-lg px-1 -mx-1',
            'hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
          )}
        >
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1 flex items-center gap-2 py-2">{body}</div>
      )}
      {right && <span className="flex items-center gap-1.5 shrink-0">{right}</span>}
    </div>
  );
}

/**
 * The armband, as a control that sits BESIDE a row rather than inside it.
 *
 * Lives on every list on this screen — the XI, the bench and the unpicked —
 * because the armband is a property of the man, not of whether he happens to
 * be named yet. It used to render only on the available-but-unpicked list, so
 * handing it to a starter meant leaving the teamsheet for the Squad screen.
 *
 * Same flat-sibling rule as `PlayerRow`'s `right` slot: never nested in the
 * row's own <button>.
 */
function CaptainButton({ playerId, isCaptain, onPress }: {
  playerId: string;
  isCaptain: boolean;
  onPress: (playerId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onPress(playerId)}
      aria-label={t('sunday.sheet.makeCaptain')}
      aria-pressed={isCaptain}
      className={cn(
        'text-micro font-semibold rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
        isCaptain ? 'text-primary' : 'text-muted-foreground hover:text-primary',
      )}
    >
      C
    </button>
  );
}

const SundayTeamsheet = () => {
  const { t } = useTranslation();
  const { sunday, players, week, season } = useGameStore(useShallow(s => ({
    sunday: s.sunday, players: s.players, week: s.week, season: s.season,
  })));
  const setTeamsheet = useGameStore(s => s.setSundayTeamsheet);
  const autoPick = useGameStore(s => s.autoPickSundayTeamsheet);
  const setTactic = useGameStore(s => s.setSundayTactic);
  const setCaptain = useGameStore(s => s.setSundayCaptain);
  const ringRound = useGameStore(s => s.ringRoundSunday);
  const setScreen = useGameStore(s => s.setScreen);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Which async teamsheet action is in flight. Both write the sheet, so two
  // overlapping calls can race each other's result.
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!sunday) return [];
    return sunday.squad
      .map(m => ({ member: m, player: players[m.playerId] }))
      .filter((r): r is Row => !!r.player);
  }, [sunday, players]);

  const xiRows = useMemo(
    () => (sunday ? sunday.teamsheet.map(id => rows.find(r => r.player.id === id)).filter((r): r is Row => !!r) : []),
    [sunday, rows],
  );
  const benchRows = useMemo(
    () => (sunday ? sunday.bench.map(id => rows.find(r => r.player.id === id)).filter((r): r is Row => !!r) : []),
    [sunday, rows],
  );

  // Stable identity so four memoized tactic cards are not re-rendered every
  // time a token on the board below is tapped. Above the early return, like
  // every other hook on this screen.
  const pickTactic = useCallback((id: SundayTacticId) => { void setTactic(id); }, [setTactic]);

  if (!sunday) return null;

  const namedIds = new Set([...sunday.teamsheet, ...sunday.bench]);
  // Selectable, not strictly available — a doubt is pickable, which is why
  // this list is longer than the hub's green count by exactly the doubts.
  const availableRows = rows.filter(r => isSundaySelectable(r.member) && !namedIds.has(r.player.id));
  const outRows = rows.filter(r => r.member.availability.status === 'out');
  const tactic = getSundayTactic(sunday.tactic);
  // The coach is applied by `buildMatchdayTeam` on the morning and by the
  // half-time switcher; leaving him out here showed a club that had PAID for
  // ‘tactical-fit’ a lower number than the one the match uses.
  const fit = sundayTacticFit(sunday.tactic, xiRows.map(r => r.player), upgradeLevel(sunday, 'coach'));
  // The shape the match will use: `buildMatchdayTeam` and `sundayOpponentXI`
  // both switch to `shortFormation` below eleven, so the screen must too or it
  // draws a side that is never fielded.
  const shortHanded = xiRows.length < SUNDAY_FULL_XI;

  const callsLeft = Math.max(0, SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK - sunday.ringRoundsThisWeek);

  // Once the morning has happened the side is fixed — the store refuses the
  // edit, so the screen has to say why rather than swallow the tap. The SAME
  // predicate the store uses, so the two cannot drift apart again.
  const sheetLocked = sundaySideIsSettled(sunday, season, week);

  const apply = (xi: string[], bench: string[]) => setTeamsheet(xi, bench);
  const giveArmband = (playerId: string) => { void setCaptain(playerId); };

  const addToXI = (id: string) => {
    if (sheetLocked) return;
    if (sunday.teamsheet.length >= SUNDAY_FULL_XI) {
      if (sunday.bench.length >= SUNDAY_MAX_BENCH) return;
      void apply(sunday.teamsheet, [...sunday.bench, id]);
      return;
    }
    void apply([...sunday.teamsheet, id], sunday.bench);
  };
  const removeFromXI = (id: string) => {
    if (sheetLocked) return;
    void apply(sunday.teamsheet.filter(x => x !== id), sunday.bench.filter(x => x !== id));
  };

  // Warnings, and only warnings that mean something. Each is a real risk the
  // manager can act on before kick-off.
  const warnings: string[] = [];
  if (sheetLocked) warnings.push(t('sunday.sheet.arrivalLocked'));
  if (sunday.teamsheet.length < SUNDAY_MIN_START) {
    warnings.push(t('sunday.sheet.warnShort', { n: sunday.teamsheet.length, min: SUNDAY_MIN_START }));
  }
  if (xiRows.length > 0 && !xiRows.some(r => r.player.position === 'GK')) {
    warnings.push(t('sunday.sheet.warnNoKeeper'));
  }
  // Out of position: named XI against the tactic's formation slots, in order.
  // A short side is compared against the short formation, which is why the
  // warning does not fire simply because nine men do not fill an eleven-man
  // shape.
  const slots = FORMATION_POSITIONS[shortHanded ? tactic.shortFormation : tactic.formation] ?? [];
  const outOfPosition = xiRows.reduce((n, r, i) => {
    const slot = slots[i];
    return slot && !canPlayPosition(r.player, slot.pos) ? n + 1 : n;
  }, 0);
  if (outOfPosition > 0) warnings.push(t('sunday.sheet.warnOutOfPosition', { n: outOfPosition }));
  // A promised start that the named XI does not honour is a warning, not a
  // surprise after the match — the promise system only works if the manager
  // can see the promise at the moment it can still be kept.
  for (const m of sunday.squad) {
    if (!m.promise || m.availability.status === 'out') continue;
    if (!sunday.teamsheet.includes(m.playerId)) {
      const p = players[m.playerId];
      if (p) warnings.push(t('sunday.sheet.warnPromise', { name: p.firstName }));
    }
  }
  const knocks = xiRows.filter(r => r.player.fitness < 65 || r.player.injured).length;
  if (knocks > 0) warnings.push(t('sunday.sheet.warnTired', { n: knocks }));
  if (sunday.bench.length === 0 && sunday.teamsheet.length >= SUNDAY_MIN_START) {
    warnings.push(t('sunday.sheet.warnNoBench'));
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SectionHeader
        title={t('sunday.sheet.title')}
        accessory={
          <span className={cn('text-caption font-semibold tabular-nums', sunday.teamsheet.length >= SUNDAY_MIN_START ? 'text-emerald-300' : 'text-amber-300')}>
            {t('sunday.sheet.count', { n: sunday.teamsheet.length, max: SUNDAY_FULL_XI })}
          </span>
        }
      />
      {/* The count chip reads "n of 11", so the constraint that actually
          decides whether the game happens at all was invisible. */}
      <p className="text-micro text-muted-foreground leading-relaxed -mt-1">
        {t('sunday.sheet.minHint', { min: SUNDAY_MIN_START })}
      </p>

      {/* Tactic. The four descriptions are drawings now — see
          `SundayTacticDiagram` — and the fit's missing context is the tick at
          50 on the meter rather than a sentence under it. */}
      <GlassPanel className="p-4 space-y-3">
        <SectionHeader level="section" title={t('sunday.sheet.tactic')} icon={TacticsIcon} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('sunday.sheet.tactic')}>
          {SUNDAY_TACTICS.map(tac => (
            <SundayTacticCard
              key={tac.id}
              id={tac.id}
              name={tac.name}
              tagline={tac.tagline}
              // The shape the board below is actually drawing, so a re-slot on
              // the eleventh man is explained rather than mysterious.
              formation={shortHanded ? tac.shortFormation : tac.formation}
              selected={tac.id === sunday.tactic}
              disabled={sheetLocked}
              onSelect={pickTactic}
            />
          ))}
        </div>
        <SundayFitMeter
          label={t('sunday.sheet.tacticFit')}
          value={fit}
          lowLabel={t('sunday.sheet.fitLow')}
          highLabel={t('sunday.sheet.fitHigh')}
        />
      </GlassPanel>

      {/* Warnings */}
      {warnings.length > 0 && (
        <GlassPanel className="p-3" tone="danger">
          <ul className="space-y-1.5">
            {warnings.map(w => (
              <li key={w} className="flex items-start gap-2 text-caption text-amber-200">
                <WarningIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* Named XI */}
      <GlassPanel className="p-4">
        <SectionHeader
          level="section"
          title={t('sunday.sheet.starting')}
          icon={StartingIcon}
          accessory={
            <LiquidButton
              className="px-3 py-1.5"
              disabled={sheetLocked}
              busy={busy === 'auto'}
              onClick={() => {
                if (busy) return;
                setBusy('auto');
                void autoPick()
                  .then(r => toast.success(t('sunday.sheet.count', { n: r.picked, max: SUNDAY_FULL_XI })))
                  .finally(() => setBusy(null));
              }}
            >
              <span className="inline-flex items-center gap-1 text-micro"><AutoPickIcon className="w-3.5 h-3.5" aria-hidden /> {t('sunday.sheet.autoPick')}</span>
            </LiquidButton>
          }
        />
        {xiRows.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.sheet.tapToAdd', { min: SUNDAY_MIN_START })}</p>
        ) : (
          <div className="divide-y divide-border/30 mt-1">
            {xiRows.map(row => (
              <PlayerRow
                key={row.player.id}
                row={row}
                captain={sunday.captainId === row.player.id}
                onClick={() => removeFromXI(row.player.id)}
                right={
                  <>
                    <AvailabilityPill availability={row.member.availability} />
                    <CaptainButton playerId={row.player.id} isCaptain={sunday.captainId === row.player.id} onPress={giveArmband} />
                  </>
                }
              />
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Bench */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.sheet.bench')} icon={BenchIcon} />
        {benchRows.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.sheet.warnNoBench')}</p>
        ) : (
          <div className="divide-y divide-border/30 mt-1">
            {benchRows.map(row => (
              <PlayerRow
                key={row.player.id}
                row={row}
                captain={sunday.captainId === row.player.id}
                onClick={() => removeFromXI(row.player.id)}
                right={<CaptainButton playerId={row.player.id} isCaptain={sunday.captainId === row.player.id} onPress={giveArmband} />}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Available, unpicked */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.avail.available')} />
        <div className="divide-y divide-border/30 mt-1">
          {availableRows.map(row => (
            <PlayerRow
              key={row.player.id}
              row={row}
              captain={sunday.captainId === row.player.id}
              onClick={() => addToXI(row.player.id)}
              right={
                <>
                  <AvailabilityPill availability={row.member.availability} />
                  <CaptainButton playerId={row.player.id} isCaptain={sunday.captainId === row.player.id} onPress={giveArmband} />
                </>
              }
            />
          ))}
        </div>
      </GlassPanel>

      {/* Unavailable */}
      {outRows.length > 0 && (
        <GlassPanel className="p-4">
          <SectionHeader level="section" title={t('sunday.sheet.unavailable')} />
          <div className="divide-y divide-border/30 mt-1">
            {outRows.map(row => (
              <div key={row.player.id}>
                <PlayerRow
                  row={row}
                  dim
                  captain={sunday.captainId === row.player.id}
                  onClick={() => setExpanded(expanded === row.player.id ? null : row.player.id)}
                  right={<AvailabilityPill availability={row.member.availability} />}
                />
                {expanded === row.player.id && (
                  <div className="pb-2 pl-9 space-y-2">
                    <p className="text-micro text-muted-foreground">
                      {row.member.availability.warned
                        ? row.member.availability.note
                        : t('sunday.avail.noWord')}
                    </p>
                    <LiquidButton
                      className="px-3 py-1.5"
                      disabled={callsLeft <= 0}
                      onClick={() => { void ringRound(row.player.id).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); }); }}
                    >
                      <span className="inline-flex items-center gap-1 text-micro">
                        <RingRoundIcon className="w-3.5 h-3.5" aria-hidden /> {t('sunday.avail.ringRound')}
                      </span>
                    </LiquidButton>
                    <p className="text-micro text-muted-foreground">
                      {callsLeft > 0
                        ? t('sunday.avail.ringRoundHint', {
                            n: sundayRingRoundCost(sunday.ringRoundsThisWeek),
                            left: callsLeft,
                            max: SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK,
                          })
                        : t('sunday.avail.ringRoundSpent')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      <LiquidButton
        tone="primary"
        className="w-full py-3"
        disabled={sunday.teamsheet.length < SUNDAY_MIN_START}
        busy={busy === 'confirm'}
        onClick={() => {
          if (busy) return;
          setBusy('confirm');
          void apply(sunday.teamsheet, sunday.bench)
            .then(r => {
              if (r.ok) { toast.success(r.message); setScreen('sunday-match'); }
              else toast.info(r.message);
            })
            .finally(() => setBusy(null));
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <ConfirmIcon className="w-4 h-4" aria-hidden /> {t('sunday.sheet.confirm')}
        </span>
      </LiquidButton>
    </div>
  );
};

export default SundayTeamsheet;
