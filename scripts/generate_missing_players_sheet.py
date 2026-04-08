#!/usr/bin/env python3
"""Generate planning spreadsheets for missing real players per club.

Outputs:
- docs/missing_real_players_template.csv (row-per-missing-slot import-planning sheet)
- docs/missing_real_players_summary.csv (team-level gap summary)

This script does NOT integrate players into game data.
"""

from __future__ import annotations

import argparse
import csv
import glob
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LEAGUE_GLOB = os.path.join(ROOT, 'src/data/leagues/*.ts')
SQUAD_GLOB = os.path.join(ROOT, 'src/data/squads/*.ts')
OUT_DETAIL_PATH = os.path.join(ROOT, 'docs/missing_real_players_template.csv')
OUT_SUMMARY_PATH = os.path.join(ROOT, 'docs/missing_real_players_summary.csv')

# Squad template id aliases -> league club ids
CLUB_ID_ALIASES = {
    'milan': 'ac-milan',
}

# Mirrors src/config/playerGeneration.ts SQUAD_TEMPLATE (25 players)
SQUAD_TEMPLATE = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'CB', 'CB',
    'LB', 'LB', 'RB', 'RB',
    'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
    'CAM',
    'LW', 'LW', 'RW', 'RW',
    'ST', 'ST', 'ST',
]

# FIFA-like display attributes (extended planning columns)
OUTFIELD_FIFA_BASE = {
    'CB': dict(pace=62, shooting=40, passing=60, dribbling=58, defending=74, physical=76),
    'LB': dict(pace=75, shooting=52, passing=68, dribbling=72, defending=70, physical=71),
    'RB': dict(pace=75, shooting=52, passing=68, dribbling=72, defending=70, physical=71),
    'CDM': dict(pace=67, shooting=58, passing=72, dribbling=70, defending=74, physical=75),
    'CM': dict(pace=69, shooting=66, passing=74, dribbling=75, defending=68, physical=70),
    'CAM': dict(pace=73, shooting=72, passing=78, dribbling=80, defending=52, physical=62),
    'LW': dict(pace=83, shooting=72, passing=70, dribbling=81, defending=45, physical=60),
    'RW': dict(pace=83, shooting=72, passing=70, dribbling=81, defending=45, physical=60),
    'ST': dict(pace=78, shooting=78, passing=63, dribbling=76, defending=40, physical=72),
}
GK_FIFA_BASE = dict(diving=72, handling=70, kicking=68, reflexes=73, speed=45, positioning=71)

# Core game attributes (src/types/game.ts -> PlayerAttributes)
GAME_ATTR_BASE = {
    'GK': dict(pace=45, shooting=30, passing=55, defending=35, physical=60, mental=68),
    'CB': dict(pace=62, shooting=40, passing=60, defending=74, physical=76, mental=70),
    'LB': dict(pace=75, shooting=52, passing=68, defending=70, physical=71, mental=67),
    'RB': dict(pace=75, shooting=52, passing=68, defending=70, physical=71, mental=67),
    'CDM': dict(pace=67, shooting=58, passing=72, defending=74, physical=75, mental=71),
    'CM': dict(pace=69, shooting=66, passing=74, defending=68, physical=70, mental=70),
    'CAM': dict(pace=73, shooting=72, passing=78, defending=52, physical=62, mental=68),
    'LW': dict(pace=83, shooting=72, passing=70, defending=45, physical=60, mental=64),
    'RW': dict(pace=83, shooting=72, passing=70, defending=45, physical=60, mental=64),
    'ST': dict(pace=78, shooting=78, passing=63, defending=40, physical=72, mental=66),
}

PERSONALITY_BASE = dict(
    professionalism=12,
    ambition=12,
    temperament=12,
    loyalty=12,
    leadership=10,
)


@dataclass(frozen=True)
class ClubMeta:
    id: str
    name: str
    division_id: str
    squad_quality: int
    country: str


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def parse_clubs() -> dict[str, ClubMeta]:
    clubs: dict[str, ClubMeta] = {}
    for path in glob.glob(LEAGUE_GLOB):
        text = open(path, encoding='utf-8').read()
        country_match = re.search(r"country:\s*'([^']+)'", text)
        country = country_match.group(1) if country_match else ''
        clubs_block_match = re.search(r"export const CLUBS:\s*ClubData\[\]\s*=\s*\[(.*?)\n\];", text, flags=re.S)
        if not clubs_block_match:
            continue
        clubs_block = clubs_block_match.group(1)

        for block in re.finditer(
            r"\{\s*[\s\S]*?id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?"
            r"squadQuality:\s*(\d+)[\s\S]*?divisionId:\s*'([^']+)'[\s\S]*?\},?",
            clubs_block,
        ):
            club_id, name, squad_quality, division_id = block.groups()
            clubs[club_id] = ClubMeta(
                id=club_id,
                name=name,
                division_id=division_id,
                squad_quality=int(squad_quality),
                country=country,
            )
    return clubs


def parse_squad_templates() -> dict[str, list[str]]:
    positions: dict[str, list[str]] = defaultdict(list)
    for path in glob.glob(SQUAD_GLOB):
        text = open(path, encoding='utf-8').read()
        for team in re.finditer(r"'([^']+)':\s*\[(.*?)\],", text, flags=re.S):
            club_id, block = team.groups()
            club_id = CLUB_ID_ALIASES.get(club_id, club_id)
            positions[club_id].extend(re.findall(r"pos:\s*'([^']+)'", block))
    return positions


def missing_positions_for_club(template_positions: Iterable[str]) -> list[str]:
    have = Counter(template_positions)
    tmp = Counter(have)
    missing: list[str] = []
    for pos in SQUAD_TEMPLATE:
        if tmp[pos] > 0:
            tmp[pos] -= 1
        else:
            missing.append(pos)
    return missing


def estimate_ratings(position: str, squad_quality: int) -> dict[str, int | str]:
    base_ovr = clamp(round(squad_quality - 3), 45, 89)
    role_adj = {
        'GK': 0, 'CB': 0, 'LB': 1, 'RB': 1, 'CDM': 1, 'CM': 2, 'CAM': 2, 'LW': 2, 'RW': 2, 'ST': 2,
    }.get(position, 0)
    ovr = clamp(base_ovr + role_adj, 40, 92)
    pot = max(ovr, min(94, ovr + (8 if ovr < 75 else 5)))

    game_attrs = {
        k: clamp(v + (ovr - 70), 35, 95)
        for k, v in GAME_ATTR_BASE[position].items()
    }

    fifa_attrs: dict[str, int | str] = {
        'fifa_pace': '', 'fifa_shooting': '', 'fifa_passing': '', 'fifa_dribbling': '', 'fifa_defending': '', 'fifa_physical': '',
        'fifa_diving': '', 'fifa_handling': '', 'fifa_kicking': '', 'fifa_reflexes': '', 'fifa_speed': '', 'fifa_positioning': '',
    }

    if position == 'GK':
        for k, v in GK_FIFA_BASE.items():
            fifa_attrs[f'fifa_{k}'] = clamp(v + (ovr - 70), 35, 95)
    else:
        for k, v in OUTFIELD_FIFA_BASE[position].items():
            fifa_attrs[f'fifa_{k}'] = clamp(v + (ovr - 70), 35, 95)

    personality = {
        k: clamp(v + ((ovr - 70) // 3), 1, 20)
        for k, v in PERSONALITY_BASE.items()
    }

    return {
        'target_overall': ovr,
        'target_potential': pot,
        'target_value_eur': max(100_000, (ovr - 35) * 400_000),
        'target_weekly_wage_eur': max(2_000, (ovr - 30) * 900),
        'target_contract_years': 3,
        **game_attrs,
        **personality,
        **fifa_attrs,
    }


def build_rows(clubs: dict[str, ClubMeta], club_positions: dict[str, list[str]]) -> tuple[list[dict[str, object]], list[dict[str, object]], list[str]]:
    detail_rows: list[dict[str, object]] = []
    summary_rows: list[dict[str, object]] = []
    warnings: list[str] = []

    unknown_squad_team_ids = sorted(set(club_positions.keys()) - set(clubs.keys()))
    if unknown_squad_team_ids:
        warnings.append(f"Found {len(unknown_squad_team_ids)} squad-template team ids missing from league data")

    for club in sorted(clubs.values(), key=lambda c: c.name.lower()):
        template_positions = club_positions.get(club.id, [])
        missing_positions = missing_positions_for_club(template_positions)

        # If there are extra template players beyond 25, warn for cleanup.
        extra_players = max(0, len(template_positions) - len(SQUAD_TEMPLATE))
        if extra_players > 0:
            warnings.append(f"{club.id}: {extra_players} template players above 25-slot template")

        summary_rows.append({
            'league_id': club.division_id,
            'country': club.country,
            'team_id': club.id,
            'team_name': club.name,
            'current_template_players': len(template_positions),
            'target_squad_size': len(SQUAD_TEMPLATE),
            'missing_players_for_team': len(missing_positions),
            'extra_template_players': extra_players,
            'status': 'ready' if len(missing_positions) == 0 else 'needs_real_players',
        })

        for idx, position in enumerate(missing_positions, start=1):
            detail_row = {
                'league_id': club.division_id,
                'country': club.country,
                'team_id': club.id,
                'team_name': club.name,
                'missing_slot_index': idx,
                'position': position,

                # Identity/import placeholders (must be real player data later)
                'required_real_player_name': 'TBD',
                'age': 'TBD',
                'nationality': 'TBD',
                'preferred_foot': 'TBD',

                # Optional implementation-ready placeholders
                'real_world_club': club.name,
                'source_season': '2025/26',
                'source_verified': 'no',
                'notes': '',

                'current_template_players': len(template_positions),
                'target_squad_size': len(SQUAD_TEMPLATE),
                'missing_players_for_team': len(missing_positions),
            }
            detail_row.update(estimate_ratings(position, club.squad_quality))
            detail_rows.append(detail_row)

    return detail_rows, summary_rows, warnings


def write_csv(path: str, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate missing real-player planning spreadsheets')
    parser.add_argument('--detail-out', default=OUT_DETAIL_PATH, help='Output CSV path for row-level missing-slot sheet')
    parser.add_argument('--summary-out', default=OUT_SUMMARY_PATH, help='Output CSV path for team-level summary sheet')
    args = parser.parse_args()

    clubs = parse_clubs()
    club_positions = parse_squad_templates()
    detail_rows, summary_rows, warnings = build_rows(clubs, club_positions)

    detail_fields = [
        'league_id', 'country', 'team_id', 'team_name',
        'missing_slot_index', 'position',
        'required_real_player_name', 'age', 'nationality', 'preferred_foot',
        'real_world_club', 'source_season', 'source_verified', 'notes',
        'current_template_players', 'target_squad_size', 'missing_players_for_team',
        'target_overall', 'target_potential', 'target_value_eur', 'target_weekly_wage_eur', 'target_contract_years',
        'pace', 'shooting', 'passing', 'defending', 'physical', 'mental',
        'professionalism', 'ambition', 'temperament', 'loyalty', 'leadership',
        'fifa_pace', 'fifa_shooting', 'fifa_passing', 'fifa_dribbling', 'fifa_defending', 'fifa_physical',
        'fifa_diving', 'fifa_handling', 'fifa_kicking', 'fifa_reflexes', 'fifa_speed', 'fifa_positioning',
    ]

    summary_fields = [
        'league_id', 'country', 'team_id', 'team_name',
        'current_template_players', 'target_squad_size', 'missing_players_for_team', 'extra_template_players', 'status',
    ]

    write_csv(args.detail_out, detail_rows, detail_fields)
    write_csv(args.summary_out, summary_rows, summary_fields)

    missing_team_count = sum(1 for r in summary_rows if int(r['missing_players_for_team']) > 0)
    print(f"Wrote {len(detail_rows)} missing-slot rows -> {args.detail_out}")
    print(f"Wrote {len(summary_rows)} team summary rows -> {args.summary_out}")
    print(f"Teams needing real-player fill: {missing_team_count}/{len(summary_rows)}")
    if warnings:
        print('Warnings:')
        for w in warnings:
            print(f"- {w}")


if __name__ == '__main__':
    main()
