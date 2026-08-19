/**
 * Sunday League — the relationships layer.
 *
 * The substrate half-existed for two waves: `friends` and `rivals` were typed,
 * drawn once at founding, and read by nothing at all. These tests are the
 * contract that says they are LIVE — that links come out of history rather than
 * out of a dice, that every door out of the club scrubs the man who went, and
 * that each of the four effects is measurable rather than decorative.
 *
 * Structured deliberately as pure-function tests where the rule is the subject
 * (formation, chemistry, the cascade cap, the mentor multiplier) and as store
 * tests where the WIRING is the subject (every departure path, the voucher, the
 * legend, reload determinism). A rule that only holds when driven through eight
 * weeks of simulation is a rule nobody can debug.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertSundayState, validateSundayState } from '@/utils/sunday/invariants';
import {
  applySundayDeparture, bumpSundayAppsWith, formSundayLinks, pickSundayCascadeQuits,
  pickSundayVoucher, sundayChemistry, sundayMentor, sundayPositionRival,
} from '@/utils/sunday/relationships';
import { buildMatchdayTeam } from '@/utils/sunday/match';
import { developSundayPlayer } from '@/utils/sunday/season';
import { createSundayRng } from '@/utils/sunday/rng';
import type { SundayRng } from '@/utils/sunday/rng';
import {
  SUNDAY_CASCADE_QUIT_MAX, SUNDAY_CHEMISTRY_FRIEND, SUNDAY_CHEMISTRY_RIVAL,
  SUNDAY_FRIENDSHIP_APPS, SUNDAY_LINKS_PER_WEEK, SUNDAY_MENTOR_GROWTH_MULT,
  SUNDAY_POSITION_RIVAL_STREAK,
} from '@/config/sundayLeague';
import type { Player, SundaySquadMember } from '@/types/game';

const SEED = 20250;

/** A rig where every draw goes the same way, so a formation rule can be tested
 *  as a rule rather than as a probability. */
function fixedRng(outcome: boolean): SundayRng {
  return {
    next: () => (outcome ? 0 : 0.999),
    int: (min: number) => min,
    float: (min: number) => min,
    chance: () => outcome,
    pick: <T,>(arr: readonly T[]) => arr[0],
    weighted: <T,>(arr: readonly T[]) => arr[0],
    shuffle: <T,>(arr: readonly T[]) => [...arr],
    sample: <T,>(arr: readonly T[], n: number) => [...arr].slice(0, Math.max(0, n)),
    around: (mean: number) => mean,
  };
}

function check() {
  const s = useGameStore.getState();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

/** Every friend/rival id in the squad names somebody who is still in it. */
function noDanglingLinks(): void {
  const s = useGameStore.getState().sunday!;
  const ids = new Set(s.squad.map(m => m.playerId));
  for (const m of s.squad) {
    for (const id of [...m.friends, ...m.rivals]) {
      expect(ids.has(id), `${m.playerId} still lists ${id}`).toBe(true);
    }
    for (const id of Object.keys(m.appsWith)) {
      expect(ids.has(id), `${m.playerId} still counts appearances with ${id}`).toBe(true);
    }
  }
}

async function clearPendingEvent() {
  const s = useGameStore.getState();
  if (s.sunday?.pendingEvent) await s.resolveSundayEvent(s.sunday.pendingEvent.choices[0].id);
}

/** Wipe every drawn link so a test starts from a room with no history. */
function blankLinks(squad: readonly SundaySquadMember[]): SundaySquadMember[] {
  return squad.map(m => ({ ...m, friends: [], rivals: [], appsWith: {}, formerTeammates: [] }));
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

// ── Formation ───────────────────────────────────────────────────────────────

describe('friendships come out of shared history', () => {
  it('forms when two men have played the threshold together, and not before', () => {
    const players = useGameStore.getState().players;
    const base = blankLinks(useGameStore.getState().sunday!.squad).slice(0, 6);
    const [a, b] = base;

    const short = base.map(m => (m.playerId === a.playerId
      ? { ...m, appsWith: { [b.playerId]: SUNDAY_FRIENDSHIP_APPS - 1 } }
      : m.playerId === b.playerId ? { ...m, appsWith: { [a.playerId]: SUNDAY_FRIENDSHIP_APPS - 1 } } : m));
    const notYet = formSundayLinks({ rng: fixedRng(true), squad: short, players, season: 1, week: 8 });
    expect(notYet.squad.every(m => m.friends.length === 0)).toBe(true);

    const enough = base.map(m => (m.playerId === a.playerId
      ? { ...m, appsWith: { [b.playerId]: SUNDAY_FRIENDSHIP_APPS } }
      : m.playerId === b.playerId ? { ...m, appsWith: { [a.playerId]: SUNDAY_FRIENDSHIP_APPS } } : m));
    const formed = formSundayLinks({ rng: fixedRng(true), squad: enough, players, season: 1, week: 8 });
    expect(formed.squad.find(m => m.playerId === a.playerId)!.friends).toContain(b.playerId);
    expect(formed.squad.find(m => m.playerId === b.playerId)!.friends).toContain(a.playerId);
    // One factual line, in the game's voice, naming both of them.
    expect(formed.lines).toHaveLength(1);
    expect(formed.lines[0]).toContain(players[a.playerId].firstName);
    expect(formed.lines[0]).toContain(players[b.playerId].firstName);
  });

  it('never forms more than one link in a week, however many pairs qualify', () => {
    const players = useGameStore.getState().players;
    const base = blankLinks(useGameStore.getState().sunday!.squad).slice(0, 8);
    // Everybody has played everybody, many times over.
    const everyone = base.map(m => ({
      ...m,
      appsWith: Object.fromEntries(base.filter(o => o.playerId !== m.playerId)
        .map(o => [o.playerId, SUNDAY_FRIENDSHIP_APPS + 10])),
    }));
    const out = formSundayLinks({ rng: fixedRng(true), squad: everyone, players, season: 1, week: 8 });
    const newLinks = out.squad.reduce((n, m) => n + m.friends.length, 0) / 2;
    expect(newLinks).toBe(SUNDAY_LINKS_PER_WEEK);
    expect(out.lines).toHaveLength(1);
  });

  it('a bad week forms nothing at all', () => {
    const players = useGameStore.getState().players;
    const base = blankLinks(useGameStore.getState().sunday!.squad).slice(0, 6);
    const pumped = base.map(m => ({
      ...m,
      appsWith: Object.fromEntries(base.filter(o => o.playerId !== m.playerId)
        .map(o => [o.playerId, SUNDAY_FRIENDSHIP_APPS + 5])),
    }));
    const out = formSundayLinks({ rng: fixedRng(false), squad: pumped, players, season: 1, week: 8 });
    expect(out.squad.every(m => m.friends.length === 0)).toBe(true);
    expect(out.lines).toHaveLength(0);
  });

  it('a month stuck behind the same man turns into a one-way feud', () => {
    const players = useGameStore.getState().players;
    const squad0 = blankLinks(useGameStore.getState().sunday!.squad);
    // Two men in the same position: one plays every week, one never does.
    const position = players[squad0[0].playerId].position;
    const samePosition = squad0.filter(m => players[m.playerId].position === position).slice(0, 2);
    expect(samePosition.length).toBeGreaterThanOrEqual(2);
    const [starter, understudy] = samePosition;
    const squad = squad0.map(m => {
      if (m.playerId === starter.playerId) return { ...m, startedStreak: SUNDAY_POSITION_RIVAL_STREAK + 2, benchedStreak: 0 };
      if (m.playerId === understudy.playerId) return { ...m, benchedStreak: SUNDAY_POSITION_RIVAL_STREAK + 2, startedStreak: 0 };
      return { ...m, startedStreak: 0, benchedStreak: 0 };
    });

    expect(sundayPositionRival(
      squad.find(m => m.playerId === understudy.playerId)!, squad, players,
    )).toBe(starter.playerId);

    const out = formSundayLinks({ rng: fixedRng(true), squad, players, season: 1, week: 9 });
    const after = out.squad.find(m => m.playerId === understudy.playerId)!;
    expect(after.rivals).toContain(starter.playerId);
    // One-directional: the man with the shirt has not noticed a thing.
    expect(out.squad.find(m => m.playerId === starter.playerId)!.rivals).not.toContain(understudy.playerId);
    expect(out.lines[0]).toContain('training');
  });

  it('counts a shared afternoon for everyone who took the field', () => {
    const took = new Set(['a', 'b', 'c']);
    expect(bumpSundayAppsWith({ b: 4 }, took, 'a')).toEqual({ b: 5, c: 1 });
    // Nobody plays with himself.
    expect(bumpSundayAppsWith(undefined, took, 'a')).toEqual({ b: 1, c: 1 });
  });
});

// ── Departures ──────────────────────────────────────────────────────────────

describe('every door out of the club scrubs the man who went', () => {
  it('release: the ids go, the name stays, and his mates feel it', async () => {
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad;
    // Make two men mates, explicitly, then release one of them.
    const [a, b] = squad;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: squad.map(m => {
          if (m.playerId === a.playerId) return { ...m, friends: [b.playerId], rivals: [] };
          if (m.playerId === b.playerId) return { ...m, friends: [a.playerId], rivals: [], happiness: 60 };
          return m;
        }),
      },
    });
    const leaverName = `${s0.players[a.playerId].firstName} ${s0.players[a.playerId].lastName}`;

    const result = await useGameStore.getState().releaseSundayPlayer(a.playerId);
    expect(result.ok).toBe(true);

    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === b.playerId)!;
    expect(after.friends).not.toContain(a.playerId);
    expect(after.formerTeammates.map(f => f.name)).toContain(leaverName);
    expect(after.happiness).toBeLessThan(60);
    noDanglingLinks();
    check();
  });

  it('release: the man who could not stand him is quietly pleased', async () => {
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad;
    const [a, b] = squad;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: squad.map(m => {
          if (m.playerId === b.playerId) return { ...m, friends: [], rivals: [a.playerId], happiness: 50 };
          if (m.playerId === a.playerId) return { ...m, friends: [], rivals: [] };
          return m;
        }),
      },
    });
    await useGameStore.getState().releaseSundayPlayer(a.playerId);
    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === b.playerId)!;
    expect(after.rivals).not.toContain(a.playerId);
    expect(after.happiness).toBeGreaterThan(50);
    // No former-teammate entry: you do not keep a photograph of him.
    expect(after.formerTeammates).toHaveLength(0);
    noDanglingLinks();
    check();
  });

  it('an event departure takes his id out of the room with him', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    const victim = sunday.squad.find(m => m.availability.status === 'available')!;
    const mate = sunday.squad.find(m => m.playerId !== victim.playerId)!;
    useGameStore.setState({
      sunday: {
        ...sunday,
        squad: sunday.squad.map(m => {
          if (m.playerId === victim.playerId) return { ...m, friends: [mate.playerId], rivals: [] };
          if (m.playerId === mate.playerId) return { ...m, friends: [victim.playerId], rivals: [] };
          return m;
        }),
        chains: [{
          id: 'veteran-farewell', step: 2, subjectId: victim.playerId,
          startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 4, data: {},
        }],
        pendingEvent: {
          defId: 'veteran-decision', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [
            { id: 'testimonial', label: 'a', hint: '' },
            { id: 'again', label: 'b', hint: '' },
            { id: 'quiet', label: 'c', hint: '' },
          ],
          category: 'player',
        },
      },
    });

    await useGameStore.getState().resolveSundayEvent('quiet');
    const after = useGameStore.getState();
    expect(after.sunday!.squad.some(m => m.playerId === victim.playerId)).toBe(false);
    expect(after.sunday!.squad.find(m => m.playerId === mate.playerId)!.friends).not.toContain(victim.playerId);
    noDanglingLinks();
    check();
  });

  it('a defection to the rival is a departure like any other', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    const victim = sunday.squad.find(m => m.availability.status === 'available')!;
    const mate = sunday.squad.find(m => m.playerId !== victim.playerId)!;
    useGameStore.setState({
      sunday: {
        ...sunday,
        squad: sunday.squad.map(m => {
          if (m.playerId === victim.playerId) return { ...m, friends: [mate.playerId] };
          if (m.playerId === mate.playerId) return { ...m, friends: [victim.playerId] };
          return m;
        }),
        chains: [{
          id: 'rival-defection', step: 2, subjectId: victim.playerId,
          startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 4, data: {},
        }],
        pendingEvent: {
          defId: 'rival-bid', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [
            { id: 'fight', label: 'f', hint: '' },
            { id: 'promise', label: 'p', hint: '' },
            { id: 'release', label: 'r', hint: '' },
          ],
          category: 'rivalry',
        },
      },
    });
    await useGameStore.getState().resolveSundayEvent('release');
    const after = useGameStore.getState();
    expect(after.sunday!.squad.find(m => m.playerId === mate.playerId)!.friends).not.toContain(victim.playerId);
    noDanglingLinks();
    check();
  });

  it('a quit — and anybody who follows him — leaves nothing behind', async () => {
    // Everybody is miserable and disloyal, so the weekly roll has plenty to
    // work with; the assertion is about the STATE afterwards, never about who
    // happened to walk.
    const s0 = useGameStore.getState();
    const ids = s0.sunday!.squad.map(m => m.playerId);
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map((m, i) => ({
          ...m,
          happiness: 2,
          loyalty: 1,
          unsettled: true,
          // A fully-connected room: whoever goes, somebody loses a mate.
          friends: ids.filter(id => id !== m.playerId).slice(i % 3, (i % 3) + 2),
          rivals: [],
        })),
      },
    });
    const before = useGameStore.getState().sunday!.squad.length;
    await clearPendingEvent();
    await useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().sunday!;
    expect(after.squad.length).toBeLessThan(before);
    noDanglingLinks();
    check();
  });

  it('retirement at the rollover is a departure too', async () => {
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad;
    // Four men well past forty and one young mate of all of them. The retiring
    // roll caps at 0.85 each, so at least one of the four goes essentially
    // always; the young one is who we check the fallout on.
    const olds = squad.slice(0, 4).map(m => m.playerId);
    const young = squad[4].playerId;
    const players = { ...s0.players };
    for (const id of olds) players[id] = { ...players[id], age: 46 };
    players[young] = { ...players[young], age: 24 };
    useGameStore.setState({
      players,
      week: s0.totalWeeks,
      sunday: {
        ...s0.sunday!,
        seasonComplete: true,
        squad: squad.map(m => {
          if (olds.includes(m.playerId)) return { ...m, commitment: 1, friends: [young], rivals: [] };
          if (m.playerId === young) return { ...m, friends: olds.slice(0, 3), rivals: [] };
          return { ...m, friends: [], rivals: [] };
        }),
      },
    });

    await useGameStore.getState().endSundaySeason();
    const after = useGameStore.getState().sunday!;
    const gone = olds.filter(id => !after.squad.some(m => m.playerId === id));
    expect(gone.length).toBeGreaterThan(0);
    const survivor = after.squad.find(m => m.playerId === young);
    if (survivor) {
      expect(survivor.friends.every(id => after.squad.some(m => m.playerId === id))).toBe(true);
      expect(survivor.formerTeammates.length).toBeGreaterThan(0);
    }
    noDanglingLinks();
    check();
  });
});

describe('the departure cascade is bounded', () => {
  it('takes at most one man out of the door behind his mate', () => {
    const squad = useGameStore.getState().sunday!.squad
      .slice(0, 6)
      .map(m => ({ ...m, happiness: 1, loyalty: 1 }));
    const out = pickSundayCascadeQuits({
      rng: fixedRng(true),
      squad,
      bereavedIds: squad.map(m => m.playerId),
      quitThreshold: 14,
      chanceFor: () => 1,
    });
    expect(out).toHaveLength(SUNDAY_CASCADE_QUIT_MAX);
    // And it is the most upset man, not an arbitrary one.
    const chosen = squad.find(m => m.playerId === out[0])!;
    expect(Math.min(...squad.map(m => m.happiness))).toBe(chosen.happiness);
  });

  it('nobody follows a man out if the room is content', () => {
    const squad = useGameStore.getState().sunday!.squad.map(m => ({ ...m, happiness: 70 }));
    const out = pickSundayCascadeQuits({
      rng: fixedRng(true),
      squad,
      bereavedIds: squad.map(m => m.playerId),
      quitThreshold: 14,
      chanceFor: () => 1,
    });
    expect(out).toHaveLength(0);
  });

  it('scrubs a stale id even when nobody left this week', () => {
    const squad = useGameStore.getState().sunday!.squad.slice(0, 3);
    const haunted = squad.map((m, i) => (i === 0
      ? { ...m, friends: ['sun-p-a-ghost'], rivals: [], appsWith: { 'sun-p-a-ghost': 40 } }
      : m));
    const out = applySundayDeparture({
      squad: haunted, players: useGameStore.getState().players, departed: [], season: 3,
    });
    expect(out.squad[0].friends).toHaveLength(0);
    expect(out.squad[0].appsWith).toEqual({});
    expect(out.lines).toHaveLength(0);
  });
});

// ── Effects ─────────────────────────────────────────────────────────────────

describe('chemistry reaches the pitch, labelled', () => {
  it('lifts a man playing beside a mate and drags one playing beside an enemy', () => {
    const s = useGameStore.getState();
    const squad0 = blankLinks(s.sunday!.squad);
    const xi = squad0.slice(0, 6).map(m => s.players[m.playerId]).filter((p): p is Player => !!p);
    const [a, b, c, d] = xi;

    const squad = squad0.map(m => {
      if (m.playerId === a.id) return { ...m, friends: [b.id] };
      if (m.playerId === b.id) return { ...m, friends: [a.id] };
      if (m.playerId === c.id) return { ...m, rivals: [d.id] };
      return m;
    });

    const input = {
      xi, tacticId: 'proper-football' as const, pitchQuality: 50,
      ballsLevel: 0, glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: true,
    };
    const plain = buildMatchdayTeam({ ...input, squad: squad0 });
    const linked = buildMatchdayTeam({ ...input, squad });

    const mental = (team: typeof plain, id: string) => team.players.find(p => p.id === id)!.attributes.mental;
    expect(mental(linked, a.id) - mental(plain, a.id)).toBe(SUNDAY_CHEMISTRY_FRIEND);
    expect(mental(linked, b.id) - mental(plain, b.id)).toBe(SUNDAY_CHEMISTRY_FRIEND);
    expect(mental(linked, c.id) - mental(plain, c.id)).toBe(SUNDAY_CHEMISTRY_RIVAL);
    // The man who has not noticed the feud is unaffected — it is one-way.
    expect(mental(linked, d.id)).toBe(mental(plain, d.id));

    const labels = linked.adjustments.map(x => x.label).join(' | ');
    expect(labels).toContain(`${a.firstName} and ${b.firstName}`);
    expect(labels).toContain(`${c.firstName} and ${d.firstName}`);
    const friendRow = linked.adjustments.find(x => x.label.includes('side by side'))!;
    expect(friendRow.delta).toBe(SUNDAY_CHEMISTRY_FRIEND);
    const rivalRow = linked.adjustments.find(x => x.label.includes('not speaking'))!;
    expect(rivalRow.delta).toBe(SUNDAY_CHEMISTRY_RIVAL);
  });

  it('gives the opposition nothing, because they have no dressing room here', () => {
    const s = useGameStore.getState();
    const xi = s.sunday!.squad.slice(0, 6).map(m => s.players[m.playerId]).filter((p): p is Player => !!p);
    const chem = sundayChemistry(xi, []);
    expect(chem.byPlayer.size).toBe(0);
    expect(chem.rows).toHaveLength(0);
  });

  it('does not compound: three mates on the pitch is still +2', () => {
    const s = useGameStore.getState();
    const squad0 = blankLinks(s.sunday!.squad);
    const xi = squad0.slice(0, 4).map(m => s.players[m.playerId]).filter((p): p is Player => !!p);
    const squad = squad0.map(m => (m.playerId === xi[0].id
      ? { ...m, friends: [xi[1].id, xi[2].id, xi[3].id] }
      : m));
    expect(sundayChemistry(xi, squad).byPlayer.get(xi[0].id)).toBe(SUNDAY_CHEMISTRY_FRIEND);
  });
});

describe('a mentor is worth something to a young player', () => {
  it('finds the old head in his position group and nobody else', () => {
    const s = useGameStore.getState();
    const squad = s.sunday!.squad;
    const prospect = squad[0];
    const veteran = squad.find(m => s.players[m.playerId].position === s.players[prospect.playerId].position
      && m.playerId !== prospect.playerId)!;
    const players = {
      ...s.players,
      [prospect.playerId]: { ...s.players[prospect.playerId], age: 19 },
      [veteran.playerId]: { ...s.players[veteran.playerId], age: 36 },
    };
    const withCommitment = squad.map(m => (m.playerId === veteran.playerId ? { ...m, commitment: 18 } : m));
    expect(sundayMentor(withCommitment[0], withCommitment, players, null)).toBe(veteran.playerId);

    // Too young to be an old head, and the pair evaporates.
    const noVets = { ...players, [veteran.playerId]: { ...players[veteran.playerId], age: 27 } };
    expect(sundayMentor(withCommitment[0], withCommitment, noVets, null)).toBeNull();
  });

  it('measurably grows him faster over a season', () => {
    const s = useGameStore.getState();
    const member = { ...s.sunday!.squad[0], commitment: 16 };
    const player: Player = {
      ...s.players[member.playerId],
      age: 19,
      minutesPlayed: 900,
    };
    const total = (p: Player) => Object.values(p.attributes).reduce((n, v) => n + v, 0);
    const alone = developSundayPlayer(createSundayRng(4242, 0), player, member, 0, 1);
    const mentored = developSundayPlayer(
      createSundayRng(4242, 0), player, member, 0, SUNDAY_MENTOR_GROWTH_MULT,
    );
    expect(total(mentored.player)).toBeGreaterThan(total(alone.player));
    // Growth only. A thirty-eight-year-old is not talked back into pace.
    const old = { ...player, age: 38 };
    expect(total(developSundayPlayer(createSundayRng(1, 0), old, member, 0, SUNDAY_MENTOR_GROWTH_MULT).player))
      .toBe(total(developSundayPlayer(createSundayRng(1, 0), old, member, 0, 1).player));
  });
});

describe('the lad who vouched for him is a real person', () => {
  it('is weighted toward the men the room listens to', () => {
    const s = useGameStore.getState();
    const squad = s.sunday!.squad.map((m, i) => ({
      ...m,
      influence: i === 3 ? 20 : 1,
      commitment: i === 3 ? 20 : 1,
    }));
    // A weighted draw is still a draw, so this is a distribution claim: over
    // many cursors the loud man is named far more often than anybody else.
    let loud = 0;
    for (let cursor = 0; cursor < 200; cursor++) {
      const pick = pickSundayVoucher(createSundayRng(99, cursor), squad, s.players);
      if (pick?.id === squad[3].playerId) loud++;
    }
    expect(loud).toBeGreaterThan(100);
  });

  it('signs the new man to his mate on the spot', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    const voucher = sunday.squad[2];
    // Take a recruit the mode generated and point it at a known voucher.
    const rng = createSundayRng(7, 0);
    const { generateSundayRecruit } = await import('@/utils/sunday/generation');
    const recruit = generateSundayRecruit({
      rng, season: s0.season, week: s0.week, reputation: sunday.reputation,
      personality: sunday.identity.personality, needs: [], clubhouseLevel: 0,
      rivalName: null, vouchName: s0.players[voucher.playerId].firstName,
      voucherId: voucher.playerId, town: sunday.identity.town, index: 0,
    });
    useGameStore.setState({
      sunday: {
        ...sunday,
        balance: 500,
        recruits: [recruit],
        squad: sunday.squad.map(m => (m.playerId === voucher.playerId ? { ...m, friends: [], rivals: [] } : m)),
      },
    });

    const result = await useGameStore.getState().signSundayRecruit(recruit.id);
    expect(result.ok).toBe(true);
    const after = useGameStore.getState().sunday!;
    const signed = after.squad.find(m => m.playerId === recruit.player.id)!;
    expect(signed.friends).toContain(voucher.playerId);
    expect(after.squad.find(m => m.playerId === voucher.playerId)!.friends).toContain(recruit.player.id);
    expect(after.weekLog.join(' ')).toContain(s0.players[voucher.playerId].firstName);
    check();
  });
});

// ── Legends ─────────────────────────────────────────────────────────────────

describe('a legend does not have to retire', () => {
  it('mints the defector with a citation that reads like a defection', async () => {
    const s0 = useGameStore.getState();
    const sunday = s0.sunday!;
    const victim = sunday.squad.find(m => m.availability.status === 'available')!;
    const victimName = `${s0.players[victim.playerId].firstName} ${s0.players[victim.playerId].lastName}`;
    useGameStore.setState({
      sunday: {
        ...sunday,
        squad: sunday.squad.map(m => (m.playerId === victim.playerId
          ? { ...m, clubApps: 400, clubGoals: 90, joinedSeason: 1 }
          : m)),
        chains: [{
          id: 'rival-defection', step: 2, subjectId: victim.playerId,
          startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 4, data: {},
        }],
        pendingEvent: {
          defId: 'rival-bid', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [
            { id: 'fight', label: 'f', hint: '' },
            { id: 'promise', label: 'p', hint: '' },
            { id: 'release', label: 'r', hint: '' },
          ],
          category: 'rivalry',
        },
      },
    });
    await useGameStore.getState().resolveSundayEvent('release');
    const legend = useGameStore.getState().sunday!.legends.find(l => l.playerId === victim.playerId);
    expect(legend, 'a 400-game servant who crossed the road is still a club legend').toBeTruthy();
    expect(legend!.name).toBe(victimName);
    expect(legend!.reason).toContain('crossed the road');
    expect(legend!.apps).toBe(400);
    check();
  });

  it('mints the released long-server, and leaves the short-server alone', async () => {
    const s0 = useGameStore.getState();
    const [servant, passer] = s0.sunday!.squad;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => (m.playerId === servant.playerId
          ? { ...m, clubApps: 120, clubGoals: 8 }
          : m.playerId === passer.playerId ? { ...m, clubApps: 3, clubGoals: 0 } : m)),
      },
    });
    await useGameStore.getState().releaseSundayPlayer(servant.playerId);
    await useGameStore.getState().releaseSundayPlayer(passer.playerId);
    const legends = useGameStore.getState().sunday!.legends;
    expect(legends.some(l => l.playerId === servant.playerId)).toBe(true);
    expect(legends.find(l => l.playerId === servant.playerId)!.reason).toContain('not needed');
    expect(legends.some(l => l.playerId === passer.playerId)).toBe(false);
    check();
  });
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('relationships survive a reload', () => {
  it('forms the same friendship on a replayed week', async () => {
    const s0 = useGameStore.getState();
    const squad = s0.sunday!.squad;
    // Exactly one pair with any history, far enough ahead that the afternoon
    // about to be played cannot change who the best-qualified pair is.
    const [a, b] = squad;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: blankLinks(squad).map(m => {
          if (m.playerId === a.playerId) return { ...m, appsWith: { [b.playerId]: 60 } };
          if (m.playerId === b.playerId) return { ...m, appsWith: { [a.playerId]: 60 } };
          return m;
        }),
      },
    });
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();

    const runWeek = async () => {
      await clearPendingEvent();
      await useGameStore.getState().advanceWeek();
      const after = useGameStore.getState().sunday!;
      return after.squad.map(m => `${m.playerId}:${m.friends.join(',')}:${m.rivals.join(',')}`).join('|');
    };

    const pathA = await runWeek();
    useGameStore.getState().loadGame(1);
    const pathB = await runWeek();
    expect(pathB).toBe(pathA);
    check();
  });

  it('a save round trip keeps the whole layer intact', async () => {
    const s0 = useGameStore.getState();
    const [a, b] = s0.sunday!.squad;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        squad: s0.sunday!.squad.map(m => {
          if (m.playerId === a.playerId) {
            return {
              ...m, friends: [b.playerId], rivals: [],
              appsWith: { [b.playerId]: 31 },
              formerTeammates: [{ name: 'Dave Riley', season: 2 }],
            };
          }
          if (m.playerId === b.playerId) return { ...m, friends: [a.playerId], rivals: [], appsWith: { [a.playerId]: 31 } };
          return m;
        }),
      },
    });
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();
    useGameStore.getState().resetGame(2);
    expect(useGameStore.getState().loadGame(1)).toBe(true);

    const after = useGameStore.getState().sunday!.squad.find(m => m.playerId === a.playerId)!;
    expect(after.friends).toEqual([b.playerId]);
    expect(after.appsWith[b.playerId]).toBe(31);
    expect(after.formerTeammates).toEqual([{ name: 'Dave Riley', season: 2 }]);
    const v = validateSundayState({
      sunday: useGameStore.getState().sunday!,
      players: useGameStore.getState().players,
      clubs: useGameStore.getState().clubs,
      playerClubId: useGameStore.getState().playerClubId,
      fixtures: useGameStore.getState().fixtures,
      week: useGameStore.getState().week,
    });
    expect(v.problems).toEqual([]);
  });
});
