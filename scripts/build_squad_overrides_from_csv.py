#!/usr/bin/env python3
"""Build TS squad overrides from docs/missing_real_players_template.csv.

Only rows with verified, real player data are exported:
- required_real_player_name != TBD
- age is numeric
- nationality set
- source_verified == yes

Output file is safe to import directly in game data.
"""

from __future__ import annotations

import csv
import os
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CSV_PATH = os.path.join(ROOT, 'docs/missing_real_players_template.csv')
OUT_TS = os.path.join(ROOT, 'src/data/squads/overrides.ts')


def split_name(full_name: str) -> tuple[str, str] | None:
    full_name = (full_name or '').strip()
    if not full_name or full_name.upper() == 'TBD':
        return None
    parts = full_name.split()
    if len(parts) < 2:
        return None
    return parts[0], ' '.join(parts[1:])


def parse_int(value: str) -> int | None:
    try:
        return int(str(value).strip())
    except Exception:
        return None


def main() -> None:
    if not os.path.exists(CSV_PATH):
        raise SystemExit(f'Missing CSV: {CSV_PATH}')

    by_team: dict[str, list[dict[str, object]]] = defaultdict(list)
    total_rows = 0
    exported_rows = 0

    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1
            if (row.get('source_verified') or '').strip().lower() != 'yes':
                continue

            name = split_name(row.get('required_real_player_name') or '')
            if not name:
                continue

            age = parse_int(row.get('age') or '')
            if age is None:
                continue

            nationality = (row.get('nationality') or '').strip()
            if not nationality or nationality.upper() == 'TBD':
                continue

            position = (row.get('position') or '').strip()
            ovr = parse_int(row.get('target_overall') or '')
            if not position or ovr is None:
                continue

            pot = parse_int(row.get('target_potential') or '')
            fn, ln = name
            template: dict[str, object] = {
                'fn': fn,
                'ln': ln,
                'pos': position,
                'age': age,
                'nat': nationality,
                'ovr': ovr,
            }
            if pot is not None and pot > ovr:
                template['pot'] = pot

            team_id = (row.get('team_id') or '').strip()
            if not team_id:
                continue
            by_team[team_id].append(template)
            exported_rows += 1

    lines: list[str] = []
    lines.append("import type { PlayerTemplate } from '@/data/playerTemplates';")
    lines.append('')
    lines.append('/**')
    lines.append(' * AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.')
    lines.append(' * Source: docs/missing_real_players_template.csv (verified rows only)')
    lines.append(' */')
    lines.append('export const SQUAD_OVERRIDES: Record<string, PlayerTemplate[]> = {')

    def esc(s: object) -> str:
        """Escape single quotes for safe embedding in TS string literals."""
        return str(s).replace("'", "\\'")

    for team_id in sorted(by_team.keys()):
        lines.append(f"  '{esc(team_id)}': [")
        for p in by_team[team_id]:
            pot_text = f", pot: {p['pot']}" if 'pot' in p else ''
            lines.append(
                f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', pos: '{esc(p['pos'])}', age: {p['age']}, nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot_text} }},"
            )
        lines.append('  ],')
    lines.append('};')
    lines.append('')

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, 'w', encoding='utf-8') as out:
        out.write('\n'.join(lines))

    print(f'Processed {total_rows} rows. Exported {exported_rows} verified rows -> {OUT_TS}')


if __name__ == '__main__':
    main()
