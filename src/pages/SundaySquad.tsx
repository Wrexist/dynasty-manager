/**
 * Squad — the people, not the ratings.
 *
 * A Sunday squad list has to answer "who is this bloke and can I rely on him",
 * which is a question about a person. So the screen is a stack of cards with a
 * face, a squad number and a name on them, and everything else — the archetype,
 * the weekday job, the three bars, the story behind the chevron — hangs off
 * that identity rather than sitting beside it in a table.
 *
 * WHAT THIS SCREEN DOES AND DOES NOT DO. It joins, it sorts, and it resolves
 * the `t()` strings for a man's relationships. Everything else lives elsewhere:
 * the join is `sundaySquadView`, the memory order is `sundayTopMemories`, the
 * face is `sundayFaceSpec`, the shirt is `sundayKitSpec`, the rating colour is
 * `sundayRatingTier`, and the card itself is `SundayPlayerCard`, which takes
 * values and nothing else.
 *
 * THE TWO ACTIONS THAT EXIST ONLY HERE. `setSundayCaptain` is also on the
 * teamsheet, but `releaseSundayPlayer` is reachable from nowhere else in the
 * mode. Both live in the expanded panel, one tap from the card.
 */
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SectionHeader } from '@/components/game/SectionHeader';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { SundayPlayerCard, SundayPlayerDetail } from '@/components/game/sunday/SundayPlayerCard';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getSundayArchetype } from '@/config/sundayLeague';
import {
  sundayFriendNames, sundayMentor, sundayPositionRival, sundayRivalNames,
} from '@/utils/sunday/relationships';
import { sundayFaceSpec, sundayKitSpec } from '@/utils/sunday/visuals';
import { sundaySquadView, sundayTopMemories } from '@/utils/sunday/view';
import type { Player, SundaySquadMember } from '@/types/game';

type SortKey = 'availability' | 'overall' | 'commitment' | 'mood';

/** How deep a man's story goes on his card. */
const STORY_DEPTH = 5;

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
  const { sunday, players, playerClubId } = useGameStore(useShallow(s => ({
    sunday: s.sunday, players: s.players, playerClubId: s.playerClubId,
  })));
  const release = useGameStore(s => s.releaseSundayPlayer);
  const setCaptain = useGameStore(s => s.setSundayCaptain);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('availability');
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);

  // Stable across renders so twenty memoized cards are not handed a fresh
  // callback every time one of them opens.
  const toggle = useCallback((id: string) => {
    setExpanded(current => (current === id ? null : id));
  }, []);

  const rows = useMemo(() => {
    if (!sunday) return [];
    const list = sundaySquadView(sunday, players);
    const availRank = (m: SundaySquadMember) =>
      m.availability.status === 'available' ? 0 : m.availability.status === 'doubt' ? 1 : 2;
    return [...list].sort((a, b) => {
      if (sortKey === 'overall') return b.player.overall - a.player.overall;
      if (sortKey === 'commitment') return b.member.commitment - a.member.commitment;
      if (sortKey === 'mood') return b.member.happiness - a.member.happiness;
      return availRank(a.member) - availRank(b.member) || b.player.overall - a.player.overall;
    });
  }, [sunday, players, sortKey]);

  // One shirt for the whole squad — every portrait's shoulders and every
  // number badge are painted in the club's two colours.
  const kit = useMemo(
    () => (sunday ? sundayKitSpec(sunday.identity.color, sunday.identity.secondaryColor, playerClubId) : null),
    [sunday, playerClubId],
  );

  if (!sunday || !kit) return null;

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
              'shrink-0 px-3 py-2 rounded-full border text-micro font-semibold min-h-[44px]',
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
        // ONE glass surface for the whole list. The cards are flat tints on top
        // of it: twenty backdrop-filters scrolling under a thumb is the single
        // most expensive thing this mode could do on a phone.
        <GlassPanel className="p-2 space-y-1.5">
          {rows.map(({ member, player }) => {
            const arch = getSundayArchetype(member.archetype);
            const open = expanded === player.id;
            const isCaptain = sunday.captainId === player.id;
            return (
              <SundayPlayerCard
                key={player.id}
                {...sundayFaceSpec(player)}
                playerId={player.id}
                firstName={player.firstName}
                lastName={player.lastName}
                position={player.position}
                shirtNumber={member.shirtNumber}
                overall={player.overall}
                archetypeName={arch.name}
                job={member.job}
                kitBody={kit.body}
                kitTrim={kit.trim}
                availStatus={member.availability.status}
                availWarned={member.availability.warned}
                happiness={member.happiness}
                fitness={player.fitness}
                form={player.form}
                captain={isCaptain}
                unsettled={member.unsettled}
                promised={!!member.promise}
                expanded={open}
                onToggle={toggle}
                detail={open ? (
                  <SundayPlayerDetail
                    blurb={arch.blurb}
                    shirtNumber={member.shirtNumber}
                    note={member.availability.warned ? member.availability.note : null}
                    memories={sundayTopMemories(member, STORY_DEPTH)}
                    relationships={relationshipParts(member, sunday.squad, players, sunday.captainId, t)}
                    clubApps={member.clubApps}
                    clubGoals={member.clubGoals}
                    clubMotm={member.clubMotm}
                    subsOwed={member.subsOwed}
                    happiness={member.happiness}
                    commitment={member.commitment}
                    punctuality={member.punctuality}
                    condition={member.condition}
                    temper={member.temper}
                    ego={member.ego}
                    isCaptain={isCaptain}
                    onMakeCaptain={() => { void setCaptain(player.id); }}
                    onRelease={() => setConfirmRelease(player.id)}
                  />
                ) : undefined}
              />
            );
          })}
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
