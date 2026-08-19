/**
 * Teamsheet — pick who plays out of whoever is actually available.
 *
 * The screen's job is to make the constraint legible: three lists (named,
 * available, unavailable), a live count against the legal minimum, and a set of
 * warnings that only fire when they mean something. The warnings are the part
 * that matters — "your only keeper is a doubt" is the difference between a
 * squad screen and a management decision.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Armchair, Check, Phone, Shirt, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { AvailabilityPill, PlayerFlags } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  SUNDAY_FULL_XI, SUNDAY_MAX_BENCH, SUNDAY_MIN_START,
  SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK, sundayRingRoundCost,
  SUNDAY_TACTICS, getSundayTactic,
} from '@/config/sundayLeague';
import { sundayTacticFit } from '@/utils/sunday/match';
import { canPlayPosition, FORMATION_POSITIONS } from '@/types/game';
import type { Player, SundaySquadMember, SundayTacticId } from '@/types/game';

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
          <PlayerFlags member={member} player={player} captain={captain} />
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

  if (!sunday) return null;

  const namedIds = new Set([...sunday.teamsheet, ...sunday.bench]);
  const availableRows = rows.filter(r => r.member.availability.status !== 'out' && !namedIds.has(r.player.id));
  const outRows = rows.filter(r => r.member.availability.status === 'out');
  const tactic = getSundayTactic(sunday.tactic);
  const fit = sundayTacticFit(sunday.tactic, xiRows.map(r => r.player));

  // Once the guests have been booked and paid for, the side is fixed — the
  // store refuses the edit, so the screen has to say why rather than swallow
  // the tap. See `arrivalGuard` in the Sunday actions.
  const callsLeft = Math.max(0, SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK - sunday.ringRoundsThisWeek);

  const sheetLocked = !!sunday.arrival
    && sunday.arrival.week === week
    && sunday.arrival.season === season
    && sunday.arrival.ringersHired !== null;

  const apply = (xi: string[], bench: string[]) => setTeamsheet(xi, bench);

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
  const slots = FORMATION_POSITIONS[xiRows.length >= SUNDAY_FULL_XI ? tactic.formation : tactic.shortFormation] ?? [];
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

      {/* Tactic */}
      <GlassPanel className="p-4 space-y-2">
        <SectionHeader
          level="section"
          title={t('sunday.sheet.tactic')}
          accessory={
            <span className="text-caption text-muted-foreground">
              {t('sunday.sheet.tacticFit')}: {Math.round(fit * 100)}%
            </span>
          }
        />
        {/* The fit percentage is a shape metric, not a quality score, and a
            player reading "48%" with no context assumes his squad is bad. */}
        <p className="text-micro text-muted-foreground leading-relaxed">{t('sunday.sheet.tacticFitHint')}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('sunday.sheet.tactic')}>
          {SUNDAY_TACTICS.map(tac => (
            <button
              key={tac.id}
              type="button"
              role="radio"
              aria-checked={tac.id === sunday.tactic}
              onClick={() => { void setTactic(tac.id as SundayTacticId); }}
              className={cn(
                'rounded-xl border px-3 py-2 text-left min-h-[44px] transition-colors',
                tac.id === sunday.tactic
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20',
              )}
            >
              <span className={cn('block text-caption font-bold', tac.id === sunday.tactic ? 'text-primary' : 'text-foreground')}>
                {tac.name}
              </span>
              <span className="block text-micro text-muted-foreground truncate">{tac.tagline}</span>
            </button>
          ))}
        </div>
        <p className="text-micro text-muted-foreground leading-relaxed">{tactic.description}</p>
      </GlassPanel>

      {/* Warnings */}
      {warnings.length > 0 && (
        <GlassPanel className="p-3" tone="danger">
          <ul className="space-y-1.5">
            {warnings.map(w => (
              <li key={w} className="flex items-start gap-2 text-caption text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
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
          icon={Shirt}
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
              <span className="inline-flex items-center gap-1 text-micro"><Wand2 className="w-3.5 h-3.5" aria-hidden /> {t('sunday.sheet.autoPick')}</span>
            </LiquidButton>
          }
        />
        {xiRows.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.sheet.tapToAdd')}</p>
        ) : (
          <div className="divide-y divide-border/30 mt-1">
            {xiRows.map(row => (
              <PlayerRow
                key={row.player.id}
                row={row}
                captain={sunday.captainId === row.player.id}
                onClick={() => removeFromXI(row.player.id)}
                right={<AvailabilityPill availability={row.member.availability} />}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Bench */}
      <GlassPanel className="p-4">
        <SectionHeader level="section" title={t('sunday.sheet.bench')} icon={Armchair} />
        {benchRows.length === 0 ? (
          <p className="text-caption text-muted-foreground mt-2">{t('sunday.sheet.warnNoBench')}</p>
        ) : (
          <div className="divide-y divide-border/30 mt-1">
            {benchRows.map(row => (
              <PlayerRow key={row.player.id} row={row} captain={sunday.captainId === row.player.id} onClick={() => removeFromXI(row.player.id)} />
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
                  <button
                    type="button"
                    onClick={() => { void setCaptain(row.player.id); }}
                    aria-label={t('sunday.sheet.makeCaptain')}
                    aria-pressed={sunday.captainId === row.player.id}
                    className={cn(
                      'text-micro font-semibold rounded-lg min-w-[44px] min-h-[44px] inline-flex items-center justify-center',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                      sunday.captainId === row.player.id ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                    )}
                  >
                    C
                  </button>
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
                        <Phone className="w-3.5 h-3.5" aria-hidden /> {t('sunday.avail.ringRound')}
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
          <Check className="w-4 h-4" aria-hidden /> {t('sunday.sheet.confirm')}
        </span>
      </LiquidButton>
    </div>
  );
};

export default SundayTeamsheet;
