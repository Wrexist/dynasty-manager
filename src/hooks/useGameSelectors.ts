/**
 * Reusable selector hooks for common game state patterns.
 * Eliminates duplicated derived-data logic across pages.
 */

import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { MORALE_BASELINE } from '@/config/matchEngine';
import type { Club, Match, CupState, LeagueCupState, ContinentalTournamentState, SuperCupMatch } from '@/types/game';

/** Get the player's club object. */
export function usePlayerClub(): Club {
  return useGameStore(s => s.clubs[s.playerClubId]);
}

/** Get league position for a club (defaults to player's club). Returns 1-based index. */
export function useLeaguePosition(clubId?: string): number {
  return useGameStore(s => {
    const id = clubId ?? s.playerClubId;
    // Single pass — find returns the entry whose index *is* the position-1.
    // The previous .find().indexOf() pair walked the array twice on every
    // store change for every page that used this selector.
    for (let i = 0; i < s.leagueTable.length; i++) {
      if (s.leagueTable[i].clubId === id) return i + 1;
    }
    return s.leagueTable.length;
  });
}

/** Find any tournament match for the player this week (cup, league cup, continental, super cup). */
export function findTournamentMatch(s: { week: number; playerClubId: string; cup: CupState; leagueCup: LeagueCupState | null; championsCup: ContinentalTournamentState | null; shieldCup: ContinentalTournamentState | null; conferenceCup?: ContinentalTournamentState | null; domesticSuperCup: SuperCupMatch | null; continentalSuperCup: SuperCupMatch | null }): { homeClubId: string; awayClubId: string; competition: string } | null {
  const w = s.week;
  const pid = s.playerClubId;
  // Dynasty Cup
  const cupTie = s.cup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (cupTie) return { homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, competition: 'Dynasty Cup' };
  // League Cup
  const lcTie = s.leagueCup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (lcTie) return { homeClubId: lcTie.homeClubId, awayClubId: lcTie.awayClubId, competition: 'League Cup' };
  // Continental group + knockout
  for (const [tourney, name] of [[s.championsCup, 'Champions Cup'], [s.shieldCup, 'Shield Cup'], [s.conferenceCup || null, 'Conference Cup']] as const) {
    if (!tourney) continue;
    for (const group of tourney.groups || []) {
      for (const m of group.matches || []) {
        if (m.played || m.week !== w) continue;
        if (m.homeClubId === pid || m.awayClubId === pid) return { homeClubId: m.homeClubId, awayClubId: m.awayClubId, competition: name as string };
      }
    }
    for (const tie of tourney.knockoutTies || []) {
      if (tie.homeClubId !== pid && tie.awayClubId !== pid) continue;
      if (!tie.leg1Played && tie.week1 === w) return { homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, competition: name as string };
      if (tie.leg1Played && !tie.leg2Played && tie.week2 === w && tie.round !== 'F') return { homeClubId: tie.awayClubId, awayClubId: tie.homeClubId, competition: name as string };
    }
  }
  // Super cups
  const dsc = s.domesticSuperCup;
  if (dsc && !dsc.played && dsc.week === w && (dsc.homeClubId === pid || dsc.awayClubId === pid)) return { homeClubId: dsc.homeClubId, awayClubId: dsc.awayClubId, competition: 'Super Cup' };
  const csc = s.continentalSuperCup;
  if (csc && !csc.played && csc.week === w && (csc.homeClubId === pid || csc.awayClubId === pid)) return { homeClubId: csc.homeClubId, awayClubId: csc.awayClubId, competition: 'Continental Super Cup' };
  return null;
}

/** Get the current week's match for the player's club + derived info. */
export function useCurrentMatch(): { match: Match | undefined; isHome: boolean; opponent: Club | undefined; competition?: string } {
  const {
    week, playerClubId, fixtures, friendlies, clubs, cup, leagueCup,
    championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup, virtualClubs,
  } = useGameStore(useShallow(s => ({
    week: s.week, playerClubId: s.playerClubId, fixtures: s.fixtures, friendlies: s.friendlies, clubs: s.clubs,
    cup: s.cup, leagueCup: s.leagueCup, championsCup: s.championsCup, shieldCup: s.shieldCup,
    conferenceCup: s.conferenceCup,
    domesticSuperCup: s.domesticSuperCup, continentalSuperCup: s.continentalSuperCup,
    virtualClubs: s.virtualClubs,
  })));

  return useMemo(() => {
    // Check friendlies first (pre-season weeks 1-3)
    const friendlyMatch = friendlies?.find(
      m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    );
    if (friendlyMatch) {
      const isHome = friendlyMatch.homeClubId === playerClubId;
      const opponent = clubs[isHome ? friendlyMatch.awayClubId : friendlyMatch.homeClubId];
      return { match: friendlyMatch, isHome, opponent, competition: 'Pre-Season Friendly' };
    }

    const leagueMatch = fixtures.find(
      m => m.week === week && !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    );

    if (leagueMatch) {
      const isHome = leagueMatch.homeClubId === playerClubId;
      const opponent = clubs[isHome ? leagueMatch.awayClubId : leagueMatch.homeClubId];
      return { match: leagueMatch, isHome, opponent };
    }

    const tourneyMatch = findTournamentMatch({
      week,
      playerClubId,
      cup,
      leagueCup,
      championsCup,
      shieldCup,
      conferenceCup,
      domesticSuperCup,
      continentalSuperCup,
    });

    if (tourneyMatch) {
      const syntheticMatch = {
        id: `tournament-${week}-${tourneyMatch.homeClubId}-${tourneyMatch.awayClubId}-${tourneyMatch.competition}`,
        week,
        homeClubId: tourneyMatch.homeClubId,
        awayClubId: tourneyMatch.awayClubId,
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        events: [],
      } as Match;
      const isHome = tourneyMatch.homeClubId === playerClubId;
      const oppId = isHome ? tourneyMatch.awayClubId : tourneyMatch.homeClubId;
      const opponent = clubs[oppId] || (virtualClubs?.[oppId]
        ? {
            id: oppId,
            name: virtualClubs[oppId].name,
            shortName: virtualClubs[oppId].shortName,
            color: virtualClubs[oppId].color,
            secondaryColor: virtualClubs[oppId].secondaryColor,
            stadiumName: '',
          } as Club
        : undefined);
      return { match: syntheticMatch, isHome, opponent, competition: tourneyMatch.competition };
    }

    return { match: undefined, isHome: false, opponent: undefined };
  }, [friendlies, fixtures, week, playerClubId, clubs, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup, virtualClubs]);
}

/** Returns true when navigation should be locked (match screen active and match not reset). */
export function useMatchLocked(): boolean {
  return useGameStore(s => s.currentScreen === 'match' && s.matchPhase !== 'none');
}

/** Returns true when the manager is unemployed (not retired) in career mode. */
export function useCareerUnemployed(): boolean {
  return useGameStore(s =>
    s.gameMode === 'career' && !!s.careerManager && !s.careerManager.contract &&
    !s.careerManager.careerHistory?.some(e => e.reason === 'retired')
  );
}

/** Get count of unread messages. */
export function useUnreadCount(): number {
  return useGameStore(s => s.messages.filter(m => !m.read).length);
}

/** Squad-wide average morale for a club (defaults to the player's club).
 *  Uses MORALE_BASELINE (50) as the per-player fallback when a morale value is
 *  missing — keeps it in lockstep with the default generated morale in
 *  `src/utils/playerGen.ts` and the performance baseline in matchEngine.
 *  Returns MORALE_BASELINE when the squad is empty (no players = neutral). */
export function useSquadAverageMorale(clubId?: string): number {
  return useGameStore(s => {
    const id = clubId ?? s.playerClubId;
    const club = s.clubs[id];
    if (!club) return MORALE_BASELINE;
    const ids = club.playerIds;
    if (ids.length === 0) return MORALE_BASELINE;
    let sum = 0;
    for (const pid of ids) sum += s.players[pid]?.morale ?? MORALE_BASELINE;
    return Math.round(sum / ids.length);
  });
}

/** One-pass squad summary for a club (defaults to the player's club).
 *  Computes size, avgAge, avgOvr, avgMorale, and injured count in a single
 *  iteration over playerIds — avoids the four separate reductions that
 *  ClubPage was doing inline. Empty-squad returns sensible neutrals. */
export interface SquadSummary {
  size: number;
  avgAge: number;
  avgOvr: number;
  avgMorale: number;
  injured: number;
}

export function useSquadSummary(clubId?: string): SquadSummary {
  // useShallow: the selector returns a fresh object each call, so we need
  // shallow equality on the 5 numeric fields or every store update would
  // trigger a re-render even when squad stats haven't changed.
  return useGameStore(useShallow(s => {
    const id = clubId ?? s.playerClubId;
    const club = s.clubs[id];
    const empty: SquadSummary = { size: 0, avgAge: 0, avgOvr: 0, avgMorale: MORALE_BASELINE, injured: 0 };
    if (!club) return empty;
    const ids = club.playerIds;
    if (ids.length === 0) return empty;
    let ageSum = 0, ovrSum = 0, moraleSum = 0, injured = 0, counted = 0;
    for (const pid of ids) {
      const p = s.players[pid];
      if (!p) continue;
      ageSum += p.age;
      ovrSum += p.overall;
      moraleSum += p.morale ?? MORALE_BASELINE;
      if (p.injured) injured++;
      counted++;
    }
    if (counted === 0) return empty;
    return {
      size: counted,
      avgAge: Math.round((ageSum / counted) * 10) / 10,
      avgOvr: Math.round(ovrSum / counted),
      avgMorale: Math.round(moraleSum / counted),
      injured,
    };
  }));
}
