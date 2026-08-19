/**
 * Sunday League hub — the screen the mode lives on.
 *
 * FOUR QUESTIONS, ANSWERED WITHOUT READING A PARAGRAPH, in this order:
 *
 *   who we are      → the shell's TopBar (crest, club, division, week) and our
 *                     own crest on the fixture card
 *   what is happening → the fixture hero, which is deliberately the heaviest
 *                       thing on the screen
 *   what is next    → the one primary action, inside that hero and above the
 *                     fold on a 375px phone (it used to sit in panel three of
 *                     eight, below it)
 *   what needs attention → availability with faces on it, then the club's
 *                          numbers as meters
 *
 * WHAT CHANGED AND WHY. This was eight `GlassPanel`s of identical weight and
 * identical padding, three of which explained themselves in a paragraph
 * underneath. Availability was stated three separate ways, the rivalry was five
 * stacked `<p>`, and the cup got a whole panel for one line. There are now five
 * panels (six when the club has a rival), they are not the same weight, and the
 * explanatory copy is two short lines in `SectionHeader`'s subtitle slot instead
 * of 535 characters of prose beneath the things it described.
 *
 * NOTHING IS DERIVED HERE. Every number comes out of `sundayClubSummary`, the
 * opposition out of `sundayOppositionCard`, the feed out of `sundayNewsFeed`,
 * the stakes out of `deriveSundayStakes` and the button out of
 * `sundayPrimaryAction`. That is what stops this screen contradicting the
 * teamsheet about how many men are available, which it used to do.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import {
  AvailabilityCount, AvailabilityPill, Meter, StatChip, SundayCrest,
} from '@/components/game/sunday/SundayBits';
import { SundayFace } from '@/components/game/sunday/SundayFace';
import { SundayFixtureHero } from '@/components/game/sunday/SundayFixtureHero';
import { SundayNewsList } from '@/components/game/sunday/SundayNewsList';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { getSundayDivision } from '@/config/sundayLeague';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { buildSundayTable, sundayCupRoundName, sundaySeasonWeeks } from '@/utils/sunday/season';
import { findSundayFixture, sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { sundayResultVerdict } from '@/utils/sunday/match';
import { sundayPrimaryAction } from '@/utils/sunday/primaryAction';
import { deriveSundayStakes } from '@/utils/sunday/tier';
import { sundayFaceSpec, sundayKitSpec } from '@/utils/sunday/visuals';
import {
  sundayClubSummary, sundayNewsFeed, sundayOppositionCard, sundaySquadView,
} from '@/utils/sunday/view';

const ForwardIcon = SUNDAY_ICON.forward;
const SubsIcon = SUNDAY_ICON.subs;
const FundraiserIcon = SUNDAY_ICON.fundraiser;
const RecruitIcon = SUNDAY_ICON.recruit;
const RivalIcon = SUNDAY_ICON.rival;
const CupIcon = SUNDAY_ICON.cup;
const PitchIcon = SUNDAY_ICON.pitch;
const MoraleIcon = SUNDAY_ICON.morale;
const ReputationIcon = SUNDAY_ICON.reputation;

/** Absentees shown with a face before the list gives up and counts the rest. */
const ABSENT_SHOWN = 4;
/** How deep the merged feed goes. `SundayNewsList` shows five and hides the
 *  rest behind one tap. */
const NEWS_DEPTH = 14;

const SundayHub = () => {
  const { t } = useTranslation();
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

  const opponentId = fixture
    ? fixture.kind === 'cup'
      ? (fixture.tie.homeClubId === playerClubId ? fixture.tie.awayClubId : fixture.tie.homeClubId)
      : (fixture.match.homeClubId === playerClubId ? fixture.match.awayClubId : fixture.match.homeClubId)
    : null;

  const summary = useMemo(
    () => (sunday ? sundayClubSummary(sunday, week) : null),
    [sunday, week],
  );

  const opposition = useMemo(
    () => (sunday && opponentId ? sundayOppositionCard(opponentId, sunday, clubs, fixtures) : null),
    [sunday, opponentId, clubs, fixtures],
  );

  // What the afternoon settles. Arithmetic, never atmosphere — the same call
  // match day makes, from the same table, so the two screens cannot promise
  // different things about one fixture.
  const stakes = useMemo(() => {
    if (!sunday || !fixture || !opponentId) return null;
    return deriveSundayStakes({
      divisionId: sunday.divisionId,
      clubId: playerClubId,
      opponentClubId: opponentId,
      fixtures,
      divisionClubIds: sunday.divisionClubIds,
      table: buildSundayTable(fixtures, sunday.divisionClubIds),
      rivalClubId: sunday.rivalry?.clubId ?? null,
      cupRound: fixture.kind === 'cup' ? fixture.tie.round : null,
    });
  }, [sunday, fixture, opponentId, fixtures, playerClubId]);

  const news = useMemo(() => (sunday ? sundayNewsFeed(sunday, NEWS_DEPTH) : []), [sunday]);

  /**
   * Everyone the manager has been TOLD about.
   *
   * An unwarned absence deliberately stays a blank until the match — the count
   * above knows about him, the list does not, because the manager does not
   * either. That fiction predates this redesign and is kept exactly.
   */
  const absent = useMemo(() => {
    if (!sunday) return [];
    return sundaySquadView(sunday, players)
      .filter(r => r.member.availability.status !== 'available' && r.member.availability.warned);
  }, [sunday, players]);

  const kit = useMemo(
    () => (sunday ? sundayKitSpec(sunday.identity.color, sunday.identity.secondaryColor, playerClubId) : null),
    [sunday, playerClubId],
  );

  if (!sunday || !summary || !kit) return null;

  const div = getSundayDivision(sunday.divisionId);
  const subsOwed = sunday.squad.reduce((n, m) => n + m.subsOwed, 0);
  const totalWeeks = sundaySeasonWeeks(sunday.divisionId);
  const namedCount = sunday.teamsheet.length;

  // The same helper the shell's week bar reads, so the two can never disagree
  // about what this week's one obvious action is.
  const primary = sundayPrimaryAction(sunday, !!fixture, week);

  const weekLabel = `${t('sunday.hub.week', { week })}/${totalWeeks}`;
  // A cup week names the round and the competition and has no room for the
  // rest; every other week carries the division, the week and the season.
  const contextLabel = fixture?.kind === 'cup'
    ? t('sunday.hub.cupTie', { round: sundayCupRoundName(fixture.tie.round), club: sunday.cup?.name ?? '' })
    : `${div.shortName} · ${weekLabel} · ${t('sunday.hub.season', { season })}`;

  const heroMode = sunday.seasonComplete ? 'seasonOver' : fixture && opposition?.club ? 'fixture' : 'free';
  const isHome = fixture
    ? (fixture.kind === 'cup' ? fixture.tie.homeClubId : fixture.match.homeClubId) === playerClubId
    : false;

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

  const last = sunday.lastMatch;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      {/* WHO WE ARE is the shell's job, not this screen's: `TopBar` already
          draws the crest, the club's name and `Div 4 · Week 3` on every Sunday
          tab. The old club header repeated all three a thumb below it. What is
          left of it here is the season, which the hero's eyebrow carries.

          WHAT IS HAPPENING, AND WHAT IS NEXT. */}
      <SundayFixtureHero
        identity={sunday.identity}
        mode={heroMode}
        opposition={opposition}
        isHome={isHome}
        tableSize={sunday.divisionClubIds.length}
        tier={stakes?.tier ?? 'routine'}
        stakesLine={stakes?.line ?? null}
        derbyName={sunday.rivalry?.clubId === opponentId ? sunday.rivalry.name : null}
        contextLabel={contextLabel}
        pitch={sundayPitchQuality(sunday, week)}
        ctaLabel={t(primary.labelKey)}
        onCta={() => { if (primary.screen) setScreen(primary.screen); else void advanceWeek(); }}
      />

      {/* WHAT NEEDS ATTENTION. Counts exactly as `sundayClubSummary` reports
          them — `available` is the strict reading and the doubts are counted
          separately, which is what stops this panel promising nine men beside
          a teamsheet that will name eleven. */}
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
              {namedCount > 0 ? t('sunday.hub.teamNamed', { n: namedCount }) : t('sunday.hub.teamNotNamed')}
              <ForwardIcon className="w-3.5 h-3.5" aria-hidden />
            </button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <AvailabilityCount status="available" label={t('sunday.hub.available', { n: summary.available })} />
          {summary.doubts > 0 && (
            <AvailabilityCount status="doubt" label={t('sunday.hub.doubts', { n: summary.doubts })} />
          )}
          {summary.out > 0 && (
            <AvailabilityCount status="out" label={t('sunday.hub.out', { n: summary.out })} />
          )}
        </div>
        {absent.length > 0 && (
          <ul className="space-y-1.5">
            {absent.slice(0, ABSENT_SHOWN).map(({ member, player }) => (
              <li key={member.playerId} className="flex items-start gap-2">
                <SundayFace
                  {...sundayFaceSpec(player)}
                  shirtColor={kit.body}
                  shirtTrim={kit.trim}
                  size={32}
                />
                {/* Name and status on one line, the reason he gave on its own
                    line beneath: "Unavailable" is a wide word, and sitting it
                    beside the note squeezed the note to four syllables and an
                    ellipsis. The note is the authored half of this row. */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-caption text-foreground truncate min-w-0">
                      {player.firstName} {player.lastName}
                    </p>
                    <AvailabilityPill availability={member.availability} className="shrink-0" />
                  </div>
                  {member.availability.note && (
                    <p className="text-micro text-muted-foreground leading-snug">{member.availability.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* THE CLUB, IN NUMBERS. The three hint paragraphs that used to sit under
          these became one line in the header — the meters carry the rest. */}
      <GlassPanel className="p-4 space-y-3">
        <SectionHeader
          level="section"
          title={t('sunday.hub.club')}
          subtitle={t('sunday.hub.clubHint')}
        />
        <div className="grid grid-cols-2 gap-2">
          <StatChip
            label={t('sunday.hub.balance')}
            value={formatMoney(summary.balance)}
            tone={summary.balance < 0 ? 'bad' : summary.balance < 100 ? 'warn' : 'good'}
          />
          <StatChip
            label={t('sunday.hub.squadLabel')}
            value={t('sunday.hub.squadSize', { n: summary.squadSize })}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Meter label={t('sunday.hub.pitch')} value={summary.pitch} icon={PitchIcon} />
          <Meter label={t('sunday.hub.morale')} value={summary.morale} icon={MoraleIcon} />
          <Meter label={t('sunday.hub.reputation')} value={summary.reputation} icon={ReputationIcon} />
        </div>
        {/* The cup used to be a panel of its own for this one line. */}
        {sunday.cup && (
          <button
            type="button"
            onClick={() => setScreen('sunday-table')}
            className="w-full flex items-center gap-2 min-h-[44px] text-left border-t border-border/30 pt-2"
          >
            <CupIcon className="w-4 h-4 text-primary shrink-0" aria-hidden />
            <span className="text-caption text-foreground flex-1 truncate">{sunday.cup.name}</span>
            <span className="text-micro text-muted-foreground shrink-0">
              {sunday.cup.winnerClubId === playerClubId
                ? t('sunday.table.cupWon')
                : sunday.cup.eliminated ? t('sunday.table.cupOut') : ''}
            </span>
            <ForwardIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
          </button>
        )}
      </GlassPanel>

      {/* WHAT HAPPENED. The score first, then the merged feed. */}
      {(last || news.length > 0) && (
        <GlassPanel className="p-4 space-y-2.5">
          <SectionHeader level="section" title={t('sunday.hub.weekLog')} />
          {last && (
            <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
              <span className={cn(
                'text-h3 font-display font-bold tabular-nums shrink-0',
                last.goalsFor > last.goalsAgainst ? 'text-emerald-300'
                  : last.goalsFor === last.goalsAgainst ? 'text-amber-300' : 'text-destructive',
              )}>
                {last.goalsFor}-{last.goalsAgainst}
              </span>
              <div className="min-w-0">
                <p className="text-caption text-foreground truncate">{last.opponentName}</p>
                <p className="text-micro text-muted-foreground truncate">{sundayResultVerdict(last)}</p>
              </div>
            </div>
          )}
          <SundayNewsList
            entries={news}
            nameOf={id => {
              const p = players[id];
              return p ? `${p.firstName} ${p.lastName}` : null;
            }}
          />
        </GlassPanel>
      )}

      {/* CLUB BUSINESS. Secondary to the hero by size and by tone — these are
          the two ★-only actions the mode has, so they stay reachable in one
          tap, but they are not what the week is about. */}
      <GlassPanel className="p-4 space-y-2">
        <SectionHeader
          level="section"
          title={t('sunday.hub.quickActions')}
          subtitle={subsOwed > 0 ? t('sunday.hub.businessHint') : undefined}
        />
        <div className="grid grid-cols-2 gap-2">
          <LiquidButton busy={busy === 'fundraiser'} onClick={quick('fundraiser', () => runFundraiser())}>
            <span className="inline-flex items-center gap-1.5 text-caption">
              <FundraiserIcon className="w-4 h-4" aria-hidden /> {t('sunday.hub.fundraiser')}
            </span>
          </LiquidButton>
          <LiquidButton busy={busy === 'subs'} onClick={quick('subs', () => chaseSubs())}>
            <span className="inline-flex items-center gap-1.5 text-caption">
              <SubsIcon className="w-4 h-4" aria-hidden />
              {subsOwed > 0 ? t('sunday.hub.subsOwed', { n: subsOwed }) : t('sunday.hub.chaseSubs')}
            </span>
          </LiquidButton>
          {/* Recruitment stays here — alone among the old grid's destinations
              it carries a number the manager has to react to. */}
          <LiquidButton className="col-span-2" onClick={() => setScreen('sunday-recruit')}>
            <span className="inline-flex items-center gap-1.5 text-caption">
              <RecruitIcon className="w-4 h-4" aria-hidden />
              {sunday.recruits.length > 0 ? t('sunday.hub.recruitsWaiting', { n: sunday.recruits.length }) : t('sunday.hub.recruits')}
            </span>
          </LiquidButton>
        </div>
      </GlassPanel>

      {/* THE RIVAL. Was five stacked paragraphs; the diary of what has passed
          between the clubs now runs in the feed above, so what is left here is
          who they are and what he last said. */}
      {sunday.rivalry && clubs[sunday.rivalry.clubId] && (
        <GlassPanel className="p-4 space-y-2">
          <SectionHeader
            level="section"
            icon={RivalIcon}
            title={t('sunday.hub.rival')}
            accessory={
              <span className="text-caption text-muted-foreground tabular-nums">
                {t('sunday.hub.rivalRecord', { w: sunday.rivalry.wins, d: sunday.rivalry.draws, l: sunday.rivalry.losses })}
              </span>
            }
          />
          <div className="flex items-center gap-2">
            <SundayCrest
              shortName={clubs[sunday.rivalry.clubId].shortName}
              color={clubs[sunday.rivalry.clubId].color}
              secondaryColor={clubs[sunday.rivalry.clubId].secondaryColor}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold text-foreground truncate">{sunday.rivalry.name}</p>
              <p className="text-micro text-muted-foreground truncate">{clubs[sunday.rivalry.clubId].name}</p>
            </div>
          </div>
          <p className="text-micro text-muted-foreground leading-relaxed">
            {t('sunday.rival.manager')}: {sunday.rivalry.managerName}. {sunday.rivalry.managerStyle}
          </p>
          {sunday.rivalry.defector && (
            <p className="text-micro text-orange-300/90">
              {t('sunday.rival.defector', { name: sunday.rivalry.defector.name })}
            </p>
          )}
          {sunday.rivalry.lastTaunt && (
            <p className="text-caption text-foreground/85 leading-relaxed">{sunday.rivalry.lastTaunt}</p>
          )}
        </GlassPanel>
      )}
    </div>
  );
};

export default SundayHub;
