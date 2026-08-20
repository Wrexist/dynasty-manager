/**
 * Teamsheet — a tactics board, not four lists of names.
 *
 * WHAT THIS SCREEN IS FOR. Picking a Sunday side is a spatial decision made
 * under a supply constraint: you have nine men, two of them are doubts, one is
 * a keeper who has never played outfield, and seven is the number below which
 * the game is forfeited. The screen used to be four flat name-lists — named,
 * benched, available, unavailable — plus a count chip and a paragraph. It chose
 * a FORMATION and never drew one.
 *
 * SO: a pitch, with the current tactic's shape on it, the men you have in the
 * shirts they will actually wear, and the gaps drawn as missing men. Everything
 * about how that is painted lives in `components/game/sunday/SundayPitch.tsx`;
 * everything about who ends up where lives in `utils/sunday/teamsheet.ts`. What
 * is left here is what a page should be: the store subscription, the joins, the
 * selection state, and the warnings.
 *
 * THE SELECTION MODEL, AND WHY IT IS TAP-FIRST. This is a phone. Drag is a
 * second way to do a thing that tap already does, it fights the scroll the page
 * needs, and it is unreachable by keyboard and by switch control. So: tap a man
 * to pick him up, tap a slot to put him down. Tap him again to put him back.
 * The one asymmetry is forced by the save format — see the header of
 * `utils/sunday/teamsheet.ts` — a man already in the XI can only SWAP with
 * another starter, because `SundayState.teamsheet` is compact and cannot hold
 * the hole he would leave behind. The board draws that: when a starter is
 * selected the empty shirts go inert, and when an unpicked man is selected
 * exactly one of them lights up as where he will land.
 *
 * WHAT IS ONLY REACHABLE HERE. `autoPickSundayTeamsheet`, `setSundayTactic`
 * before kick-off, `setSundayTeamsheet` (add / remove / confirm) and
 * `ringRoundSunday`, which is deliberately double-gated behind an expanded row
 * of the unavailable list: it costs money and a morale point, and it should
 * take a decision to reach, not a mis-tap.
 */
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { AvailabilityPill, PlayerFlags } from '@/components/game/sunday/SundayBits';
import { SundayFitMeter, SundayTacticCard } from '@/components/game/sunday/SundayTacticCard';
import { SundayPitch, SundayPitchToken, SundayXiCount } from '@/components/game/sunday/SundayPitch';
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
import { sundayFaceSpec, sundayKitSpec } from '@/utils/sunday/visuals';
import { sundaySquadView } from '@/utils/sunday/view';
import { positionFit } from '@/utils/positionFit';
import {
  addToSide, benchPlayer, dropFromSide, firstEmptySlot, placeInXI, sundaySeatOf,
} from '@/utils/sunday/teamsheet';
import { formatMoney } from '@/utils/helpers';
import { FORMATION_POSITIONS, type Position } from '@/types/game';
import type { Player, SundaySquadMember, SundayTacticId } from '@/types/game';

const WarningIcon = SUNDAY_ICON.warning;
const StartingIcon = SUNDAY_ICON.starting;
const BenchIcon = SUNDAY_ICON.bench;
const AutoPickIcon = SUNDAY_ICON.autoPick;
const ConfirmIcon = SUNDAY_ICON.confirm;
const RingRoundIcon = SUNDAY_ICON.ringRound;
const TacticsIcon = SUNDAY_ICON.tactics;
const CaptainIcon = SUNDAY_ICON.captain;
const DropIcon = SUNDAY_ICON.out;
const KeeperIcon = SUNDAY_ICON.available;
const TiredIcon = SUNDAY_ICON.injury;
const PromiseIcon = SUNDAY_ICON.morale;

interface Row {
  member: SundaySquadMember;
  player: Player;
}

/** Surname, or the only name he has. Two words will not fit under a 38px head. */
function shortNameOf(player: Player): string {
  return player.lastName || player.firstName;
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
function PlayerRow({ row, right, onClick, dim, captain, selected, label }: {
  row: Row;
  right?: React.ReactNode;
  onClick?: () => void;
  dim?: boolean;
  captain?: boolean;
  /** He is the man currently picked up. */
  selected?: boolean;
  label?: string;
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
    <div className={cn('flex items-center gap-1.5 rounded-lg', dim && 'opacity-55', selected && 'bg-primary/10 ring-1 ring-inset ring-primary/50')}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          aria-label={label}
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

/** One warning, as a glyph and a count rather than a bullet. `onFocusRow`
 *  points the board at the men it is about, which is the difference between a
 *  warning and an instruction. */
interface Warning {
  key: string;
  text: string;
  icon: React.ElementType;
  /** Player ids the board should ring. Empty when the warning is about the
   *  side as a whole. */
  targets: string[];
}

const SundayTeamsheet = () => {
  const { t } = useTranslation();
  const { sunday, players, week, season, playerClubId } = useGameStore(useShallow(s => ({
    sunday: s.sunday, players: s.players, week: s.week, season: s.season, playerClubId: s.playerClubId,
  })));
  const setTeamsheet = useGameStore(s => s.setSundayTeamsheet);
  const autoPick = useGameStore(s => s.autoPickSundayTeamsheet);
  const setTactic = useGameStore(s => s.setSundayTactic);
  const setCaptain = useGameStore(s => s.setSundayCaptain);
  const ringRound = useGameStore(s => s.ringRoundSunday);
  const setScreen = useGameStore(s => s.setScreen);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** The man currently picked up, if any. Local: nothing is written to the
   *  save until he is put down somewhere. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Men a tapped warning is pointing at. Cleared by the next selection. */
  const [flagged, setFlagged] = useState<readonly string[]>([]);
  // Which async teamsheet action is in flight. Both write the sheet, so two
  // overlapping calls can race each other's result.
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () => (sunday ? sundaySquadView(sunday, players) : []),
    [sunday, players],
  );
  const byId = useMemo(() => new Map(rows.map(r => [r.player.id, r])), [rows]);

  const xiRows = useMemo(
    () => (sunday ? sunday.teamsheet.map(id => byId.get(id)).filter((r): r is Row => !!r) : []),
    [sunday, byId],
  );
  const benchRows = useMemo(
    () => (sunday ? sunday.bench.map(id => byId.get(id)).filter((r): r is Row => !!r) : []),
    [sunday, byId],
  );
  // One shirt for the whole side — the tokens' shoulders are the club's.
  const kit = useMemo(
    () => (sunday ? sundayKitSpec(sunday.identity.color, sunday.identity.secondaryColor, playerClubId) : null),
    [sunday, playerClubId],
  );

  // Stable identities so the memoized tactic cards and pitch tokens are not
  // re-rendered every time something unrelated on the page moves. Above the
  // early return, like every other hook here.
  const pickTactic = useCallback((id: SundayTacticId) => { void setTactic(id); }, [setTactic]);
  const select = useCallback((id: string | null) => { setFlagged([]); setSelectedId(id); }, []);

  if (!sunday || !kit) return null;

  const namedIds = new Set([...sunday.teamsheet, ...sunday.bench]);
  // Selectable, not strictly available — a doubt is pickable, which is why
  // this list is longer than the hub's green count by exactly the doubts.
  const availableRows = rows.filter(r => isSundaySelectable(r.member) && !namedIds.has(r.player.id));
  const outRows = rows.filter(r => r.member.availability.status === 'out');
  const tactic = getSundayTactic(sunday.tactic);
  // The coach is applied by `buildMatchdayTeam` on the morning and by the
  // half-time switcher; leaving him out here showed a club that had PAID for
  // 'tactical-fit' a lower number than the one the match uses.
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

  const side = { xi: sunday.teamsheet, bench: sunday.bench };
  const apply = (xi: string[], bench: string[]) => setTeamsheet(xi, bench);
  const giveArmband = (playerId: string) => { void setCaptain(playerId); };

  /** Write a move, and put the man down. Refused moves leave the selection
   *  alone so a mis-tap does not silently lose who you were holding. */
  const commit = (next: { xi: string[]; bench: string[] }, keepHolding?: boolean) => {
    if (sheetLocked) return;
    if (next.xi === side.xi && next.bench === side.bench) return;
    void apply(next.xi, next.bench);
    if (!keepHolding) select(null);
  };

  const slots = FORMATION_POSITIONS[shortHanded ? tactic.shortFormation : tactic.formation] ?? [];
  const occupants = slots.map((_, i) => sunday.teamsheet[i] ?? null);
  const selectedSeat = selectedId ? sundaySeatOf(side, selectedId) : null;
  // Exactly one shirt a picked-up man can land in, and only when he is not
  // already wearing one. See `utils/sunday/teamsheet.ts`.
  const targetSlot = selectedId && selectedSeat !== 'xi' && !sheetLocked ? firstEmptySlot(sunday.teamsheet) : null;

  const fitOf = (player: Player, i: number): ReturnType<typeof positionFit> =>
    positionFit(player, (slots[i]?.pos ?? player.position) as Position);

  // ── Warnings, and only warnings that mean something ───────────────────────
  // Each is a real risk the manager can act on before kick-off, and each that
  // can name the men it is about does, so tapping it rings them on the board.
  const warnings: Warning[] = [];
  if (sunday.teamsheet.length < SUNDAY_MIN_START) {
    warnings.push({
      key: 'short', icon: WarningIcon, targets: [],
      text: t('sunday.sheet.warnShort', { n: sunday.teamsheet.length, min: SUNDAY_MIN_START }),
    });
  }
  if (xiRows.length > 0 && !xiRows.some(r => r.player.position === 'GK')) {
    warnings.push({ key: 'keeper', icon: KeeperIcon, targets: [], text: t('sunday.sheet.warnNoKeeper') });
  }
  const misplaced = xiRows.filter((r, i) => fitOf(r.player, i) === 'wrong').map(r => r.player.id);
  if (misplaced.length > 0) {
    warnings.push({
      key: 'position', icon: StartingIcon, targets: misplaced,
      text: t('sunday.sheet.warnOutOfPosition', { n: misplaced.length }),
    });
  }
  // A promised start that the named XI does not honour is a warning, not a
  // surprise after the match — the promise system only works if the manager
  // can see the promise at the moment it can still be kept.
  for (const m of sunday.squad) {
    if (!m.promise || m.availability.status === 'out') continue;
    if (!sunday.teamsheet.includes(m.playerId)) {
      const p = players[m.playerId];
      if (p) {
        warnings.push({
          key: `promise-${m.playerId}`, icon: PromiseIcon, targets: [m.playerId],
          text: t('sunday.sheet.warnPromise', { name: p.firstName }),
        });
      }
    }
  }
  const knocks = xiRows.filter(r => r.player.fitness < 65 || r.player.injured);
  if (knocks.length > 0) {
    warnings.push({
      key: 'tired', icon: TiredIcon, targets: knocks.map(r => r.player.id),
      text: t('sunday.sheet.warnTired', { n: knocks.length }),
    });
  }
  if (sunday.bench.length === 0 && sunday.teamsheet.length >= SUNDAY_MIN_START) {
    warnings.push({ key: 'nobench', icon: BenchIcon, targets: [], text: t('sunday.sheet.warnNoBench') });
  }

  const selectedRow = selectedId ? byId.get(selectedId) : null;

  /** Pick him up, put him down, or — when he is already held — name him
   *  wherever there is room. The board is for placing a man somewhere specific;
   *  this is the one-tap "just get him on the sheet" the list always offered. */
  const tapRow = (id: string) => {
    if (sheetLocked) return;
    if (selectedId === id) {
      commit(addToSide(side, id));
      return;
    }
    select(id);
  };

  const tapSlot = ({ index, occupantId }: { index: number; occupantId: string | null }) => {
    if (!selectedId) {
      // Nothing held: lift whoever is standing here. An empty shirt has nobody
      // to lift, so the tap is honestly inert.
      if (occupantId) select(occupantId);
      return;
    }
    if (occupantId === selectedId) { select(null); return; }
    commit(placeInXI(side, selectedId, index));
  };

  const ringRoundLabel = callsLeft > 0
    ? t('sunday.avail.ringRoundHint', {
        n: sundayRingRoundCost(sunday.ringRoundsThisWeek), left: callsLeft,
        max: SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK,
      })
    : t('sunday.avail.ringRoundSpent');

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SectionHeader
        title={t('sunday.sheet.title')}
        accessory={
          sheetLocked
            ? (
              <span className="inline-flex items-center gap-1 text-micro font-semibold text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <ConfirmIcon className="w-3 h-3" aria-hidden /> {t('sunday.sheet.settled')}
              </span>
            )
            : undefined
        }
      />

      {/* The board. */}
      <GlassPanel className="p-4 space-y-3">
        <SundayXiCount
          named={sunday.teamsheet.length}
          label={t('sunday.sheet.starting')}
          countLabel={t('sunday.sheet.count', { n: sunday.teamsheet.length, max: SUNDAY_FULL_XI })}
          minLabel={t('sunday.sheet.minToPlay', { min: SUNDAY_MIN_START })}
          ariaLabel={t('sunday.sheet.xiStatus', {
            n: sunday.teamsheet.length, max: SUNDAY_FULL_XI, min: SUNDAY_MIN_START,
          })}
        />

        <SundayPitch
          slots={slots}
          occupants={occupants}
          selectedId={selectedId}
          targetSlot={targetSlot}
          locked={sheetLocked}
          ariaLabel={t('sunday.sheet.boardLabel', { formation: shortHanded ? tactic.shortFormation : tactic.formation })}
          onSlotTap={tapSlot}
          slotLabel={({ index, slot, occupantId }) => {
            const r = occupantId ? byId.get(occupantId) : null;
            if (r) return `${r.player.firstName} ${r.player.lastName}, ${slot.pos}`;
            return index === targetSlot
              ? t('sunday.sheet.slotTarget', { pos: slot.pos })
              : t('sunday.sheet.slotEmpty', { pos: slot.pos });
          }}
          emptyPos={({ index }) => ({
            active: index === targetSlot,
            required: index < SUNDAY_MIN_START,
          })}
          renderToken={({ occupantId, index }) => {
            const r = byId.get(occupantId);
            if (!r) return null;
            return (
              <SundayPitchToken
                {...sundayFaceSpec(r.player)}
                shortName={shortNameOf(r.player)}
                shirtNumber={r.member.shirtNumber}
                overall={r.player.overall}
                fit={fitOf(r.player, index)}
                slotPos={slots[index]?.pos ?? ''}
                kitBody={kit.body}
                kitTrim={kit.trim}
                availStatus={r.member.availability.status}
                captain={sunday.captainId === occupantId}
                selected={selectedId === occupantId}
                faded={!!selectedId && selectedSeat !== 'xi' && selectedId !== occupantId}
                flagged={flagged.includes(occupantId)}
              />
            );
          }}
        />

        {/* Who you are holding, and the three things you can do with him that
            are not "put him in a shirt". Icon-only: the glyphs are the mode's
            own and each carries its sentence as an accessible name, which is
            the alternative to three more labels on a 375px screen. */}
        {selectedRow && !sheetLocked && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/40 px-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block text-caption font-semibold text-foreground truncate">
                {selectedRow.player.firstName} {selectedRow.player.lastName}
              </span>
              <span className="block text-micro text-muted-foreground truncate">
                {selectedRow.player.position} · {selectedRow.player.overall} OVR · {selectedRow.member.shirtNumber}
              </span>
            </span>
            <button
              type="button"
              aria-label={t('sunday.sheet.makeCaptain')}
              aria-pressed={sunday.captainId === selectedRow.player.id}
              onClick={() => giveArmband(selectedRow.player.id)}
              className={cn(
                'min-w-[44px] min-h-[44px] rounded-lg inline-flex items-center justify-center shrink-0',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                sunday.captainId === selectedRow.player.id ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <CaptainIcon className="w-4 h-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t('sunday.sheet.benchHim')}
              disabled={sunday.bench.length >= SUNDAY_MAX_BENCH && selectedSeat !== 'bench'}
              onClick={() => commit(benchPlayer(side, selectedRow.player.id))}
              className="min-w-[44px] min-h-[44px] rounded-lg inline-flex items-center justify-center shrink-0 text-muted-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            >
              <BenchIcon className="w-4 h-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t('sunday.sheet.dropHim')}
              disabled={selectedSeat === null}
              onClick={() => commit(dropFromSide(side, selectedRow.player.id))}
              className="min-w-[44px] min-h-[44px] rounded-lg inline-flex items-center justify-center shrink-0 text-muted-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            >
              <DropIcon className="w-4 h-4" aria-hidden />
            </button>
          </div>
        )}

        <LiquidButton
          className="w-full py-2"
          disabled={sheetLocked}
          busy={busy === 'auto'}
          onClick={() => {
            if (busy) return;
            setBusy('auto');
            select(null);
            void autoPick()
              .then(r => toast.success(t('sunday.sheet.count', { n: r.picked, max: SUNDAY_FULL_XI })))
              .finally(() => setBusy(null));
          }}
        >
          <span className="inline-flex items-center gap-1.5 text-caption">
            <AutoPickIcon className="w-4 h-4" aria-hidden /> {t('sunday.sheet.autoPick')}
          </span>
        </LiquidButton>
      </GlassPanel>

      {/* Warnings. The one part of this screen that was already doing its job —
          kept, and pointed at the men it means. */}
      {warnings.length > 0 && (
        <GlassPanel className="p-2" tone="danger">
          <ul className="space-y-0.5">
            {warnings.map(w => {
              const Icon = w.icon;
              const body = (
                <>
                  <Icon className="w-4 h-4 shrink-0 text-amber-300" aria-hidden />
                  <span className="min-w-0 flex-1 text-caption text-amber-200">{w.text}</span>
                </>
              );
              return (
                <li key={w.key}>
                  {w.targets.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => { setSelectedId(null); setFlagged(w.targets); }}
                      className="w-full min-h-[44px] flex items-center gap-2 text-left rounded-lg px-1 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="min-h-[44px] flex items-center gap-2 px-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      )}

      {/* Bench. Five seats, drawn whether or not anybody is in them — an empty
          bench is a real and dangerous state, and it used to be a sentence. */}
      <GlassPanel className="p-4">
        <SectionHeader
          level="section"
          title={t('sunday.sheet.bench')}
          icon={BenchIcon}
          accessory={
            <span className="text-caption font-semibold tabular-nums text-muted-foreground">
              {t('sunday.sheet.count', { n: sunday.bench.length, max: SUNDAY_MAX_BENCH })}
            </span>
          }
        />
        <div className="grid grid-cols-5 gap-1.5 mt-2">
          {Array.from({ length: SUNDAY_MAX_BENCH }, (_, i) => {
            const r = benchRows[i];
            if (!r) {
              return (
                <div
                  key={`seat-${i}`}
                  aria-hidden
                  className="min-h-[64px] rounded-lg border border-dashed border-white/15 bg-white/[0.02] flex items-center justify-center"
                >
                  <BenchIcon className="w-4 h-4 text-white/20" />
                </div>
              );
            }
            const held = selectedId === r.player.id;
            return (
              <button
                key={r.player.id}
                type="button"
                aria-pressed={held}
                aria-label={`${r.player.firstName} ${r.player.lastName}`}
                onClick={() => tapRow(r.player.id)}
                className={cn(
                  'min-h-[64px] rounded-lg px-0.5 py-1 flex flex-col items-center justify-center gap-0.5',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
                  held ? 'bg-primary/15 ring-1 ring-inset ring-primary/50' : 'bg-white/[0.04]',
                )}
              >
                <span className="text-micro font-semibold text-foreground truncate max-w-full">
                  {shortNameOf(r.player)}
                </span>
                <span className="text-micro tabular-nums text-muted-foreground">
                  {r.player.position} {r.player.overall}
                </span>
                {sunday.captainId === r.player.id && (
                  <CaptainIcon className="w-2.5 h-2.5 text-primary fill-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Available, unpicked */}
      <GlassPanel className="p-4">
        <SectionHeader
          level="section"
          title={t('sunday.avail.available')}
          accessory={
            <span className="text-caption font-semibold tabular-nums text-muted-foreground">
              {availableRows.length}
            </span>
          }
        />
        <div className="divide-y divide-border/30 mt-1">
          {availableRows.map(row => (
            <PlayerRow
              key={row.player.id}
              row={row}
              captain={sunday.captainId === row.player.id}
              selected={selectedId === row.player.id}
              onClick={sheetLocked ? undefined : () => tapRow(row.player.id)}
              right={
                <>
                  <AvailabilityPill availability={row.member.availability} subtle />
                  <CaptainButton playerId={row.player.id} isCaptain={sunday.captainId === row.player.id} onPress={giveArmband} />
                </>
              }
            />
          ))}
        </div>
      </GlassPanel>

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
              // The shape the board above is actually drawing, so a re-slot on
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

      {/* Unavailable. The ring-round is deliberately two taps deep: it costs
          money and a morale point, so it should take a decision to reach. */}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <LiquidButton
                        className="px-3 py-1.5"
                        disabled={callsLeft <= 0}
                        onClick={() => {
                          void ringRound(row.player.id).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); });
                        }}
                      >
                        <span className="inline-flex items-center gap-1 text-micro">
                          <RingRoundIcon className="w-3.5 h-3.5" aria-hidden /> {t('sunday.avail.ringRound')}
                        </span>
                      </LiquidButton>
                      {/* The cost and what is left of the afternoon, as a number
                          and two pips — 166 characters of prose, drawn. The
                          sentence lives on here as the group's accessible name
                          rather than on the button: a DISABLED button is not
                          focusable, so a label explaining why it is inert would
                          never be announced. */}
                      <span className="inline-flex items-center gap-1.5" role="img" aria-label={ringRoundLabel}>
                        <span className={cn('text-micro font-semibold tabular-nums', callsLeft > 0 ? 'text-amber-200' : 'text-muted-foreground')}>
                          {formatMoney(sundayRingRoundCost(sunday.ringRoundsThisWeek))}
                        </span>
                        <span className="inline-flex gap-0.5">
                          {Array.from({ length: SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK }, (_, i) => (
                            <span
                              key={i}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                i < callsLeft ? 'bg-amber-300' : 'bg-white/15',
                              )}
                            />
                          ))}
                        </span>
                      </span>
                    </div>
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
