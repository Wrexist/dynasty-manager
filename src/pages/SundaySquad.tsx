/**
 * Squad — the people, not the ratings.
 *
 * A Sunday squad list has to answer "who is this bloke and can I rely on him",
 * so the row leads with the archetype and the job and only then shows numbers.
 * The expanded panel is where the Sunday attributes live; the football ones sit
 * beside them because both matter and separating them would imply otherwise.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Flame, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { SectionHeader } from '@/components/game/SectionHeader';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { AvailabilityPill, Meter } from '@/components/game/sunday/SundayBits';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  getSundayArchetype, SUNDAY_FORM_COLD, SUNDAY_FORM_HOT, SUNDAY_MEMORY_LEGENDARY_WEIGHT,
} from '@/config/sundayLeague';
import {
  sundayFriendNames, sundayMentor, sundayPositionRival, sundayRivalNames,
} from '@/utils/sunday/relationships';
import type { Player, SundaySquadMember } from '@/types/game';

type SortKey = 'availability' | 'overall' | 'commitment' | 'mood';

/** "Kev", "Kev and Baz", "Kev, Baz and Dave" — the way a person says it. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * His place in the room, as one line.
 *
 * Mates and feuds are stored; being stuck behind somebody and being mentored
 * are DERIVED right here from position, streaks and age, which is why neither
 * can go stale. Deliberately not a graph, not chips and not a screen: the same
 * register as the biography above it, and nothing at all when he has no links
 * — an empty state would be noise on fifteen rows out of fifteen in season one.
 */
function relationshipParts(
  member: SundaySquadMember,
  squad: readonly SundaySquadMember[],
  players: Record<string, Player>,
  captainId: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  const parts: string[] = [];
  const friends = sundayFriendNames(member, players);
  if (friends.length) parts.push(t('sunday.bio.friends', { names: joinNames(friends) }));
  const rivals = sundayRivalNames(member, players);
  if (rivals.length) parts.push(t('sunday.bio.rivals', { names: joinNames(rivals) }));

  // A prospect being brought on outranks a prospect being kept out: both can be
  // true at once and only one of them is the story.
  const mentorId = sundayMentor(member, squad, players, captainId);
  const aheadId = mentorId ? null : sundayPositionRival(member, squad, players);
  if (mentorId && players[mentorId]) {
    parts.push(t('sunday.bio.mentor', { name: players[mentorId].firstName }));
  } else if (aheadId && players[aheadId]) {
    parts.push(t('sunday.bio.stuckBehind', { name: players[aheadId].firstName }));
  }

  if (member.formerTeammates.length) {
    parts.push(t('sunday.bio.formerTeammates', {
      names: joinNames(member.formerTeammates.map(f => f.name.split(' ')[0])),
    }));
  }
  return parts;
}

const SundaySquad = () => {
  const { t } = useTranslation();
  const { sunday, players } = useGameStore(useShallow(s => ({ sunday: s.sunday, players: s.players })));
  const release = useGameStore(s => s.releaseSundayPlayer);
  const setCaptain = useGameStore(s => s.setSundayCaptain);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('availability');
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!sunday) return [];
    const list = sunday.squad
      .map(m => ({ member: m, player: players[m.playerId] }))
      .filter((r): r is { member: SundaySquadMember; player: Player } => !!r.player);
    const availRank = (m: SundaySquadMember) =>
      m.availability.status === 'available' ? 0 : m.availability.status === 'doubt' ? 1 : 2;
    return list.sort((a, b) => {
      if (sortKey === 'overall') return b.player.overall - a.player.overall;
      if (sortKey === 'commitment') return b.member.commitment - a.member.commitment;
      if (sortKey === 'mood') return b.member.happiness - a.member.happiness;
      return availRank(a.member) - availRank(b.member) || b.player.overall - a.player.overall;
    });
  }, [sunday, players, sortKey]);

  if (!sunday) return null;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'availability', label: t('sunday.avail.available') },
    { key: 'overall', label: 'OVR' },
    { key: 'commitment', label: t('sunday.squad.commitment') },
    { key: 'mood', label: t('sunday.squad.happiness') },
  ];

  const confirmTarget = confirmRelease ? players[confirmRelease] : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-4 space-y-3">
      <SectionHeader
        title={t('sunday.squad.title')}
        accessory={<span className="text-caption text-muted-foreground">{sunday.squad.length}</span>}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('sunday.squad.sortBy')}>
        {sortOptions.map(o => (
          <button
            key={o.key}
            type="button"
            aria-pressed={sortKey === o.key}
            onClick={() => setSortKey(o.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full border text-micro font-semibold min-h-[36px]',
              sortKey === o.key
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'bg-white/[0.04] border-white/10 text-muted-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-body text-muted-foreground">{t('sunday.squad.empty')}</p>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-2">
          <div className="divide-y divide-border/30">
            {rows.map(({ member, player }) => {
              const arch = getSundayArchetype(member.archetype);
              const open = expanded === player.id;
              const links = open
                ? relationshipParts(member, sunday.squad, players, sunday.captainId, t)
                : [];
              return (
                <div key={player.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : player.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-2 px-2 py-2.5 min-h-[44px] text-left rounded-lg hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                  >
                    <span className="w-9 text-micro font-semibold text-muted-foreground shrink-0">{player.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-body font-medium text-foreground truncate">
                          {player.firstName} {player.lastName}
                        </span>
                        {sunday.captainId === player.id && (
                          <span className="text-micro font-bold text-primary shrink-0" aria-label={t('sunday.sheet.captain')}>C</span>
                        )}
                        {member.unsettled && (
                          <span className="text-micro text-amber-300 shrink-0">{t('sunday.squad.unsettled')}</span>
                        )}
                        {player.form >= SUNDAY_FORM_HOT && (
                          <span className="inline-flex items-center gap-0.5 text-micro font-semibold text-emerald-300 shrink-0">
                            <Flame className="w-3 h-3" aria-hidden /> {t('sunday.bio.onFire')}
                          </span>
                        )}
                        {player.form <= SUNDAY_FORM_COLD && (
                          <span className="text-micro font-semibold text-sky-300/80 shrink-0">{t('sunday.bio.struggling')}</span>
                        )}
                        {member.promise && (
                          <span className="text-micro font-semibold text-primary shrink-0">{t('sunday.bio.promised')}</span>
                        )}
                      </span>
                      <span className="block text-micro text-muted-foreground truncate">
                        {arch.name} · {member.job}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-caption font-semibold text-foreground tabular-nums">{player.overall}</span>
                      <AvailabilityPill availability={member.availability} />
                      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
                    </span>
                  </button>

                  {open && (
                    <div className="px-3 pb-3 space-y-3">
                      <p className="text-micro text-muted-foreground leading-relaxed">{arch.blurb}</p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <Meter label={t('sunday.squad.happiness')} value={member.happiness} />
                        <Meter label={t('sunday.squad.commitment')} value={member.commitment * 5} />
                        <Meter label={t('sunday.squad.reliability')} value={member.punctuality * 5} />
                        <Meter label={t('sunday.squad.condition')} value={member.condition * 5} />
                        <Meter label={t('sunday.squad.temper')} value={member.temper * 5} />
                        <Meter label={t('sunday.squad.ego')} value={member.ego * 5} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                          <p className="text-micro text-muted-foreground">{t('sunday.squad.apps')}</p>
                          <p className="text-body font-semibold text-foreground tabular-nums">{member.clubApps}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                          <p className="text-micro text-muted-foreground">{t('sunday.squad.goals')}</p>
                          <p className="text-body font-semibold text-foreground tabular-nums">{member.clubGoals}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                          <p className="text-micro text-muted-foreground">{t('sunday.squad.owed')}</p>
                          <p className={cn('text-body font-semibold tabular-nums', member.subsOwed > 0 ? 'text-amber-300' : 'text-foreground')}>
                            £{member.subsOwed}
                          </p>
                        </div>
                      </div>

                      {member.availability.warned && member.availability.note && (
                        <p className="text-micro text-muted-foreground">{member.availability.note}</p>
                      )}

                      {/* His story here — the memories the club keeps about him,
                          heaviest first. This list IS the reason he stops being
                          a stat block: it is written by the simulation and only
                          by the simulation. */}
                      <div>
                        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('sunday.bio.story')}
                        </p>
                        {member.memories.length === 0 ? (
                          <p className="text-micro text-muted-foreground mt-1">{t('sunday.bio.noStory')}</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {[...member.memories]
                              .sort((a, b) => b.weight - a.weight || b.season - a.season || b.week - a.week)
                              .slice(0, 5)
                              .map((mem, i) => (
                                <li key={`${mem.season}-${mem.week}-${i}`} className="flex items-baseline gap-2">
                                  <span className="text-micro text-muted-foreground/70 tabular-nums shrink-0 w-14">
                                    {t('sunday.bio.seasonWeek', { season: mem.season, week: mem.week })}
                                  </span>
                                  <span className="text-micro text-foreground/85 leading-relaxed">
                                    {mem.text}
                                    {/* The handful of afternoons a club actually
                                        retells. Presentation only — the weight
                                        is written by the simulation. */}
                                    {mem.weight >= SUNDAY_MEMORY_LEGENDARY_WEIGHT && (
                                      <span className="ml-1 text-micro font-semibold text-primary whitespace-nowrap">
                                        · {t('sunday.story.legendary')}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>

                      {links.length > 0 && (
                        <p className="text-micro text-muted-foreground leading-relaxed">
                          {links.join(' · ')}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <LiquidButton className="flex-1 py-2" onClick={() => { void setCaptain(player.id); }}>
                          <span className="text-micro">{t('sunday.sheet.makeCaptain')}</span>
                        </LiquidButton>
                        <LiquidButton tone="destructive" className="flex-1 py-2" onClick={() => setConfirmRelease(player.id)}>
                          <span className="inline-flex items-center gap-1 text-micro">
                            <UserMinus className="w-3.5 h-3.5" aria-hidden /> {t('sunday.squad.release')}
                          </span>
                        </LiquidButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <ConfirmDialog
        open={!!confirmRelease}
        onOpenChange={open => { if (!open) setConfirmRelease(null); }}
        title={t('sunday.squad.releaseConfirm', { name: confirmTarget ? `${confirmTarget.firstName} ${confirmTarget.lastName}` : '' })}
        description={t('sunday.squad.releaseBody')}
        confirmLabel={t('sunday.squad.release')}
        variant="destructive"
        onConfirm={() => {
          if (!confirmRelease) return;
          void release(confirmRelease).then(r => { if (r.ok) toast.success(r.message); else toast.info(r.message); });
          setConfirmRelease(null);
          setExpanded(null);
        }}
      />
    </div>
  );
};

export default SundaySquad;
