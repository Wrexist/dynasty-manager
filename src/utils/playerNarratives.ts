import { Player } from '@/types/game';

export type NarrativeTag = 'Club Legend' | 'One-Club Man' | 'Homegrown Hero' | 'Captain Fantastic' | 'Fan Favourite' | 'Rising Star' | 'Veteran Leader' | 'Record Breaker';

export interface PlayerNarrative {
  tag: NarrativeTag;
  description: string;
  color: string; // tailwind color class
}

/** Compute narrative tags for a player based on tenure, origin, performance */
export function getPlayerNarratives(
  player: Player,
  season: number,
  joinedSeason?: number,
  isFromYouthAcademy?: boolean,
): PlayerNarrative[] {
  const tags: PlayerNarrative[] = [];
  const seasonsAtClub = joinedSeason ? season - joinedSeason : 0;

  // Club Legend: 5+ seasons, 50+ appearances
  if (seasonsAtClub >= 5 && player.appearances >= 50) {
    tags.push({ tag: 'Club Legend', description: `${seasonsAtClub} seasons of loyal service`, color: 'text-primary' });
  }
  // One-Club Man: been here since start (season 1) with 3+ seasons
  else if (joinedSeason === 1 && seasonsAtClub >= 3) {
    tags.push({ tag: 'One-Club Man', description: 'With the club since day one', color: 'text-amber-400' });
  }

  // Homegrown Hero: from youth academy
  if (isFromYouthAcademy && player.overall >= 70) {
    tags.push({ tag: 'Homegrown Hero', description: 'Academy product turned star', color: 'text-emerald-400' });
  }

  // Rising Star: young and high-rated
  if (player.age <= 21 && player.overall >= 70) {
    tags.push({ tag: 'Rising Star', description: 'One for the future', color: 'text-sky-400' });
  }

  // Veteran Leader: 30+, high leadership
  if (player.age >= 30 && (player.personality?.leadership ?? 10) >= 15 && player.overall >= 68) {
    tags.push({ tag: 'Veteran Leader', description: 'Experience and wisdom', color: 'text-purple-400' });
  }

  // Fan Favourite: high appearances with good form
  if (player.appearances >= 30 && player.form >= 70) {
    tags.push({ tag: 'Fan Favourite', description: 'Beloved by the supporters', color: 'text-rose-400' });
  }

  // Record Breaker: 20+ goals in a season
  if (player.goals >= 20) {
    tags.push({ tag: 'Record Breaker', description: `${player.goals} goals this season`, color: 'text-primary' });
  }

  return tags;
}

/** Gameplay bonuses from narrative tags — makes tags meaningful beyond cosmetics */
export interface NarrativeBonus {
  /** Extra team strength when this player is in the lineup */
  strengthBonus: number;
  /** Extra development chance for this player */
  developmentBonus: number;
  /** Morale loss reduction for the squad after defeats when this player is in lineup */
  moraleLossReduction: number;
  /** Morale boost to teammates when this player is in the lineup */
  teamMoraleBoost: number;
}

export function getNarrativeBonus(tags: NarrativeTag[]): NarrativeBonus {
  const bonus: NarrativeBonus = { strengthBonus: 0, developmentBonus: 0, moraleLossReduction: 0, teamMoraleBoost: 0 };
  for (const tag of tags) {
    switch (tag) {
      case 'Club Legend':
      case 'Fan Favourite':
        bonus.teamMoraleBoost += 3;
        break;
      case 'Rising Star':
        bonus.developmentBonus += 0.02;
        break;
      case 'Veteran Leader':
        bonus.moraleLossReduction += 2;
        break;
      case 'Captain Fantastic':
        bonus.strengthBonus += 0.02;
        break;
      case 'Homegrown Hero':
        bonus.teamMoraleBoost += 2;
        bonus.developmentBonus += 0.01;
        break;
      case 'Record Breaker':
        bonus.strengthBonus += 0.01;
        break;
    }
  }
  return bonus;
}

/** Generate farewell summary when a long-serving player leaves */
export function getFarewellSummary(
  player: Player,
  season: number,
  joinedSeason?: number,
): { shouldShow: boolean; seasonsServed: number; stats: { label: string; value: string }[] } {
  const seasonsServed = joinedSeason ? season - joinedSeason : 0;
  const shouldShow = seasonsServed >= 2 || player.appearances >= 20;

  return {
    shouldShow,
    seasonsServed,
    stats: [
      { label: 'Seasons', value: `${seasonsServed}` },
      { label: 'Appearances', value: `${player.appearances}` },
      { label: 'Goals', value: `${player.goals}` },
      { label: 'Assists', value: `${player.assists}` },
    ],
  };
}
