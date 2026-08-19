/**
 * Sunday League hub — the screen the mode lives on.
 *
 * Answers, in order, the four questions a Sunday manager actually has on a
 * Wednesday night: who is available, who are we playing, have we got any money,
 * and what happened last week. Everything else is a tap away.
 *
 * The primary action changes with the state of the week — name a team, play the
 * match, move on — so there is always exactly one obvious next thing to do.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { AvailabilityPill, Meter, StatChip, SundayCrest } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { getSundayDivision, getSundayTactic, SUNDAY_MIN_START } from '@/config/sundayLeague';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { summariseAvailability } from '@/utils/sunday/availability';
import { sundayCupRoundName, sundaySeasonWeeks } from '@/utils/sunday/season';
import { findSundayFixture, sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { sundayResultVerdict } from '@/utils/sunday/match';
import { sundayPrimaryAction } from '@/utils/sunday/primaryAction';

const ForwardIcon = SUNDAY_ICON.forward;
const SubsIcon = SUNDAY_ICON.subs;
const FundraiserIcon = SUNDAY_ICON.fundraiser;
const RecruitIcon = SUNDAY_ICON.recruit;
const RivalIcon = SUNDAY_ICON.rival;
const DerbyHeatIcon = SUNDAY_ICON.derbyHeat;
const CupIcon = SUNDAY_ICON.cup;

const SundayHub = () => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const { sunday, players, clubs, fixtures, week, season, playerClubId } = useGameStore(useShallow(s => ({
    sunday: s.sunday,
    players: s.players,
    clubs: s.clubs,
    fixtures: s.fixtures,
    week: s.week,
    season: s.season,
    playerClubId: s.playerClubId,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const runFundraiser = useGameStore(s => s.runSundayFundraiser);
  const chaseSubs = useGameStore(s => s.chaseSundaySubs);
  const [busy, setBusy] = useState<string | null>(null);

  const fixture = useMemo(
    () => (sunday ? findSundayFixture(sunday, fixtures, week, playerClubId) : null),
    [sunday, fixtures, week, playerClubId],
  );

  if (!sunday) return null;

  const div = getSundayDivision(sunday.divisionId);
  const avail = summariseAvailability(sunday.squad);
  const subsOwed = sunday.squad.reduce((n, m) => n + m.subsOwed, 0);
  const totalWeeks = sundaySeasonWeeks(sunday.divisionId);
  const pitch = sundayPitchQuality(sunday, week);
  const tactic = getSundayTactic(sunday.tactic);

  const opponentId = fixture
    ? fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId)
    : null;
  const opponent = opponentId ? clubs[opponentId] : null;
  const isHome = fixture
    ? (fixture.kind === 'cup' ? fixture.tie.homeClubId : fixture.match.homeClubId) === playerClubId
    : false;

  const namedCount = sunday.teamsheet.length;
  const teamReady = namedCount >= SUNDAY_MIN_START;

  // The same helper the shell's week bar reads, so the two can never disagree
  // about what this week's one obvious action is.
  const primary = sundayPrimaryAction(sunday, !!fixture, week);

  // Which club-business action is mid-flight, if any. The store actions are
  // async (the mode is a lazy chunk), so without this a second tap in the same
  // frame runs the fundraiser twice.
  const quick = (id: string, fn: () => Promise<{ ok: boolean; message: string }>) => () => {
    if (busy) return;
    setBusy(id);
    void fn()
      .then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); })
      .finally(() => setBusy(null));
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* Club header */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-3">
          <SundayCrest shortName={sunday.identity.shortName} color={sunday.identity.color} secondaryColor={sunday.identity.secondaryColor} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-title font-display font-bold text-foreground truncate">{sunday.identity.name}</p>
            <p className="text-caption text-muted-foreground truncate">
              {div.name} · {t('sunday.hub.week', { week })} / {totalWeeks} · {t('sunday.hub.season', { season })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatChip
            label={t('sunday.hub.balance')}
            value={formatMoney(sunday.balance)}
            tone={sunday.balance < 0 ? 'bad' : sunday.balance < 100 ? 'warn' : 'good'}
          />
          <StatChip label={t('sunday.hub.squadLabel')} value={t('sunday.hub.squadSize', { n: sunday.squad.length })} />
          <StatChip label={t('sunday.hub.pitch')} value={`${Math.round(pitch)}/100`} tone={pitch < 25 ? 'warn' : 'default'} />
        </div>
        {/* Onboarding: every number on this card was readable and none of them
            said what it does. One caption per group, not a tooltip each. */}
        <p className="text-micro text-muted-foreground leading-relaxed mt-2">{t('sunday.hub.pitchHint')}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Meter label={t('sunday.hub.morale')} value={sunday.teamMorale} />
          <Meter label={t('sunday.hub.reputation')} value={sunday.reputation} />
        </div>
        <p className="text-micro text-muted-foreground leading-relaxed mt-2">{t('sunday.hub.metersHint')}</p>
      </GlassPanel>

      {/* Availability */}
      <GlassPanel className="p-4 space-y-2.5">
        <SectionHeader
          level="section"
          title={t('sunday.hub.availability')}
          accessory={
            <button
              type="button"
              onClick={() => setScreen('sunday-teamsheet')}
              className="text-caption font-semibold text-primary inline-flex items-center gap-1 min-h-[44px] px-1"
            >
              {teamReady ? t('sunday.hub.teamNamed', { n: namedCount }) : t('sunday.hub.teamNotNamed')}
              <ForwardIcon className="w-3.5 h-3.5" aria-hidden />
            </button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-micro font-semibold text-emerald-300">
            {t('sunday.hub.available', { n: avail.available })}
          </span>
          {avail.doubts > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-micro font-semibold text-amber-200">
              {t('sunday.hub.doubts', { n: avail.doubts })}
            </span>
          )}
          {avail.out > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-micro font-semibold text-destructive">
              {t('sunday.hub.out', { n: avail.out })}
            </span>
          )}
        </div>
        {/* Everyone who has cried off, with the reason where the manager has
            been told one. An unwarned absence stays a blank until the match. */}
        <ul className="space-y-1">
          {sunday.squad
            .filter(m => m.availability.status !== 'available' && m.availability.warned)
            .slice(0, 4)
            .map(m => (
              <li key={m.playerId} className="flex items-center gap-2 text-caption text-muted-foreground">
                <AvailabilityPill availability={m.availability} />
                <span className="truncate">{m.availability.note ?? players[m.playerId]?.firstName}</span>
              </li>
            ))}
        </ul>
      </GlassPanel>

      {/* Fixture */}
      <GlassPanel className="p-4 space-y-3">
        <SectionHeader level="section" title={t('sunday.hub.nextFixture')} />
        {sunday.seasonComplete ? (
          <div>
            <p className="text-body font-semibold text-foreground">{t('sunday.hub.seasonOver')}</p>
            <p className="text-caption text-muted-foreground mt-1">{t('sunday.hub.seasonOverBody')}</p>
          </div>
        ) : fixture && opponent ? (
          <div className="flex items-center gap-3">
            <SundayCrest shortName={opponent.shortName} color={opponent.color} secondaryColor={opponent.secondaryColor} size={38} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-foreground truncate">
                {isHome ? t('sunday.hub.homeTo', { club: opponent.name }) : t('sunday.hub.awayAt', { club: opponent.name })}
              </p>
              <p className="text-caption text-muted-foreground truncate">
                {fixture.kind === 'cup'
                  ? t('sunday.hub.cupTie', { round: sundayCupRoundName(fixture.tie.round), club: sunday.cup?.name ?? '' })
                  : `${tactic.name} · ${div.shortName}`}
              </p>
            </div>
            {sunday.rivalry?.clubId === opponent.id && (
              <span className="inline-flex items-center gap-1 text-micro font-semibold text-orange-300 shrink-0">
                <DerbyHeatIcon className="w-3.5 h-3.5" aria-hidden /> {sunday.rivalry.name}
              </span>
            )}
          </div>
        ) : (
          <div>
            <p className="text-body font-semibold text-foreground">{t('sunday.hub.freeWeek')}</p>
            <p className="text-caption text-muted-foreground mt-1">{t('sunday.hub.freeWeekBody')}</p>
          </div>
        )}

        <LiquidButton
          tone="primary"
          className="w-full py-3"
          onClick={() => { if (primary.screen) setScreen(primary.screen); else void advanceWeek(); }}
        >
          {t(primary.labelKey)}
        </LiquidButton>
      </GlassPanel>

      {/* Last result */}
      {sunday.lastMatch && (
        <GlassPanel className="p-4">
          <SectionHeader level="section" title={t('sunday.hub.lastResult')} />
          <div className="flex items-center gap-3 mt-2">
            <span className={cn(
              'text-h3 font-display font-bold tabular-nums',
              sunday.lastMatch.goalsFor > sunday.lastMatch.goalsAgainst ? 'text-emerald-300'
                : sunday.lastMatch.goalsFor === sunday.lastMatch.goalsAgainst ? 'text-amber-300' : 'text-destructive',
            )}>
              {sunday.lastMatch.goalsFor}-{sunday.lastMatch.goalsAgainst}
            </span>
            <div className="min-w-0">
              <p className="text-caption text-foreground truncate">{sunday.lastMatch.opponentName}</p>
              <p className="text-micro text-muted-foreground truncate">{sundayResultVerdict(sunday.lastMatch)}</p>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Week log */}
      {sunday.weekLog.length > 0 && (
        <GlassPanel className="p-4">
          <SectionHeader level="section" title={t('sunday.hub.weekLog')} />
          <ul className="mt-2 space-y-1.5">
            {sunday.weekLog.map((line, i) => (
              <motion.li
                key={`${line}-${i}`}
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.04, 0.3), duration: 0.22 }}
                className="text-caption text-muted-foreground leading-relaxed"
              >
                {line}
              </motion.li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* Club business */}
      <GlassPanel className="p-4 space-y-2">
        <SectionHeader level="section" title={t('sunday.hub.quickActions')} />
        <div className="grid grid-cols-2 gap-2">
          <LiquidButton className="py-2.5" busy={busy === 'fundraiser'} onClick={quick('fundraiser', () => runFundraiser())}>
            <span className="inline-flex items-center gap-1.5 text-caption"><FundraiserIcon className="w-4 h-4" aria-hidden /> {t('sunday.hub.fundraiser')}</span>
          </LiquidButton>
          <LiquidButton className="py-2.5" busy={busy === 'subs'} onClick={quick('subs', () => chaseSubs())}>
            <span className="inline-flex items-center gap-1.5 text-caption">
              <SubsIcon className="w-4 h-4" aria-hidden />
              {subsOwed > 0 ? t('sunday.hub.subsOwed', { n: subsOwed }) : t('sunday.hub.chaseSubs')}
            </span>
          </LiquidButton>
          {/* Recruitment stays here — alone among the old grid's destinations
              it carries a number the manager has to react to. League, Clubhouse
              and History became tabs / sub-nav entries, so a button that only
              navigates is now a second, worse copy of the nav. */}
          <LiquidButton className="py-2.5 col-span-2" onClick={() => setScreen('sunday-recruit')}>
            <span className="inline-flex items-center gap-1.5 text-caption">
              <RecruitIcon className="w-4 h-4" aria-hidden />
              {sunday.recruits.length > 0 ? t('sunday.hub.recruitsWaiting', { n: sunday.recruits.length }) : t('sunday.hub.recruits')}
            </span>
          </LiquidButton>
        </div>
        {subsOwed > 0 && (
          <p className="text-micro text-muted-foreground leading-relaxed">{t('sunday.hub.subsHint')}</p>
        )}
      </GlassPanel>

      {/* Rivalry */}
      {sunday.rivalry && clubs[sunday.rivalry.clubId] && (
        <GlassPanel className="p-4">
          <SectionHeader
            level="section"
            title={t('sunday.hub.rival')}
            accessory={
              <span className="text-caption text-muted-foreground">
                {t('sunday.hub.rivalRecord', { w: sunday.rivalry.wins, d: sunday.rivalry.draws, l: sunday.rivalry.losses })}
              </span>
            }
          />
          <div className="flex items-center gap-2 mt-2">
            <RivalIcon className="w-4 h-4 text-orange-300 shrink-0" aria-hidden />
            <p className="text-caption text-foreground truncate">
              {sunday.rivalry.name} · {clubs[sunday.rivalry.clubId].name}
            </p>
          </div>
          <p className="text-micro text-muted-foreground mt-1 leading-relaxed">
            {t('sunday.rival.manager')}: {sunday.rivalry.managerName}. {sunday.rivalry.managerStyle}
          </p>
          {sunday.rivalry.defector && (
            <p className="text-micro text-orange-300/90 mt-1">
              {t('sunday.rival.defector', { name: sunday.rivalry.defector.name })}
            </p>
          )}
          {sunday.rivalry.lastTaunt && (
            <p className="text-caption text-muted-foreground mt-2 leading-relaxed">{sunday.rivalry.lastTaunt}</p>
          )}
          {sunday.rivalry.story.length > 0 && (
            <div className="mt-2 border-t border-border/30 pt-2">
              <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sunday.rival.storyTitle')}
              </p>
              <ul className="mt-1 space-y-1">
                {sunday.rivalry.story.slice(-3).map((line, i) => (
                  <li key={`${i}-${line.slice(0, 10)}`} className="text-micro text-foreground/80 leading-relaxed">{line}</li>
                ))}
              </ul>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Cup progress */}
      {sunday.cup && (
        <GlassPanel className="p-3">
          <button
            type="button"
            onClick={() => setScreen('sunday-table')}
            className="w-full flex items-center gap-2 min-h-[44px] text-left"
          >
            <CupIcon className="w-4 h-4 text-primary shrink-0" aria-hidden />
            <span className="text-caption text-foreground flex-1 truncate">{sunday.cup.name}</span>
            <span className="text-micro text-muted-foreground">
              {sunday.cup.winnerClubId === playerClubId
                ? t('sunday.table.cupWon')
                : sunday.cup.eliminated ? t('sunday.table.cupOut') : ''}
            </span>
            <ForwardIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          </button>
        </GlassPanel>
      )}
    </div>
  );
};

export default SundayHub;
