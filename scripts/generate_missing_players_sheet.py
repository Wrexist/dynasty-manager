#!/usr/bin/env python3
"""Generate a planning CSV of missing real players per club.

This does NOT integrate players into game data. It only creates a spreadsheet
for manual completion.
"""

from __future__ import annotations

import csv
import glob
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LEAGUE_GLOB = os.path.join(ROOT, 'src/data/leagues/*.ts')
SQUAD_GLOB = os.path.join(ROOT, 'src/data/squads/*.ts')
OUT_PATH = os.path.join(ROOT, 'docs/missing_real_players_template.csv')

SQUAD_TEMPLATE = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'CB', 'CB',
    'LB', 'LB', 'RB', 'RB',
    'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
    'CAM',
    'LW', 'LW', 'RW', 'RW',
    'ST', 'ST', 'ST',
]

OUTFIELD_BASE = {
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
GK_BASE = dict(diving=72, handling=70, kicking=68, reflexes=73, speed=45, positioning=71)


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def parse_clubs() -> dict[str, tuple[str, str, int, str]]:
    clubs: dict[str, tuple[str, str, int, str]] = {}
    for path in glob.glob(LEAGUE_GLOB):
        text = open(path, encoding='utf-8').read()
        country_match = re.search(r"country:\s*'([^']+)'", text)
        country = country_match.group(1) if country_match else ''

        for block in re.finditer(
            r"\{\s*\n\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?"
            r"squadQuality:\s*(\d+)[\s\S]*?divisionId:\s*'([^']+)'[\s\S]*?\},",
            text,
        ):
            club_id, name, squad_quality, division_id = block.groups()
            clubs[club_id] = (name, division_id, int(squad_quality), country)
    return clubs


def parse_squad_templates() -> dict[str, list[str]]:
    positions: dict[str, list[str]] = defaultdict(list)
    for path in glob.glob(SQUAD_GLOB):
        text = open(path, encoding='utf-8').read()
        for team in re.finditer(r"'([^']+)':\s*\[(.*?)\],", text, flags=re.S):
            club_id, block = team.groups()
            positions[club_id].extend(re.findall(r"pos:\s*'([^']+)'", block))
    return positions


def main() -> None:
    club_meta = parse_clubs()
    club_positions = parse_squad_templates()
    rows = []

    for club_id, (name, division_id, squad_quality, country) in sorted(club_meta.items(), key=lambda i: i[1][0]):
        have = Counter(club_positions.get(club_id, []))
        temp = Counter(have)
        missing_positions: list[str] = []

        for pos in SQUAD_TEMPLATE:
            if temp[pos] > 0:
                temp[pos] -= 1
            else:
                missing_positions.append(pos)

        for slot_idx, pos in enumerate(missing_positions, start=1):
            base_ovr = clamp(round(squad_quality - 3), 45, 89)
            role_adj = {'GK': 0, 'CB': 0, 'LB': 1, 'RB': 1, 'CDM': 1, 'CM': 2, 'CAM': 2, 'LW': 2, 'RW': 2, 'ST': 2}.get(pos, 0)
            ovr = clamp(base_ovr + role_adj, 40, 92)
            pot = max(ovr, min(94, ovr + (8 if ovr < 75 else 5)))

            row = {
                'league_id': division_id,
                'country': country,
                'team_id': club_id,
                'team_name': name,
                'missing_slot_index': slot_idx,
                'position': pos,
                'required_real_player_name': 'TBD',
                'age': 'TBD',
                'nationality': 'TBD',
                'preferred_foot': 'TBD',
                'current_template_players': len(club_positions.get(club_id, [])),
                'target_squad_size': 25,
                'missing_players_for_team': len(missing_positions),
                'target_overall': ovr,
                'target_potential': pot,
            }

            if pos == 'GK':
                for k, v in GK_BASE.items():
                    row[k] = clamp(v + (ovr - 70), 35, 95)
                for k in ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']:
                    row[k] = ''
            else:
                for k, v in OUTFIELD_BASE[pos].items():
                    row[k] = clamp(v + (ovr - 70), 35, 95)
                for k in ['diving', 'handling', 'kicking', 'reflexes', 'speed', 'positioning']:
                    row[k] = ''

            rows.append(row)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    fieldnames = [
        'league_id', 'country', 'team_id', 'team_name',
        'missing_slot_index', 'position',
        'required_real_player_name', 'age', 'nationality', 'preferred_foot',
        'current_template_players', 'target_squad_size', 'missing_players_for_team',
        'target_overall', 'target_potential',
        'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
        'diving', 'handling', 'kicking', 'reflexes', 'speed', 'positioning',
    ]

    with open(OUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    teams_missing = len({r['team_id'] for r in rows})
    print(f'Wrote {len(rows)} rows for {teams_missing} teams -> {OUT_PATH}')


if __name__ == '__main__':
    main()
