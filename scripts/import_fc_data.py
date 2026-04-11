#!/usr/bin/env python3
"""Import real player data from EA FC 25 CSV dataset into TypeScript squad files.

This is the SIMPLEST way to populate all 455 clubs with real player data.
No API keys, no rate limits, no cost — just a free CSV download.

Setup (one time):
  1. Go to https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-25-complete-player-dataset
     (or search Kaggle for "EA FC 25 complete player dataset")
  2. Download the dataset (free — just needs a Kaggle account)
  3. Extract and place the main players CSV at:
       data/fc25_players.csv
     (or pass a custom path with --csv)

Usage:
  python scripts/import_fc_data.py                    # uses data/fc25_players.csv
  python scripts/import_fc_data.py --csv path/to.csv  # custom CSV path
  python scripts/import_fc_data.py --dry-run           # preview without writing files

The CSV typically has columns like:
  short_name, long_name, player_positions, overall, potential,
  age, nationality_name, club_name, value_eur, wage_eur, ...

The script will:
  1. Read the CSV and group players by club
  2. Fuzzy-match CSV club names to our 455 club IDs
  3. Pick the best 25 players per club (by overall rating)
  4. Map positions to our format (GK/CB/LB/RB/CDM/CM/CAM/LW/RW/ST)
  5. Generate .ts squad files in src/data/squads/
  6. Update src/data/squads/index.ts with all imports

Requires Python 3.10+. No external dependencies — uses only stdlib.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAGUES_DIR = ROOT / 'src' / 'data' / 'leagues'
SQUADS_DIR = ROOT / 'src' / 'data' / 'squads'
DEFAULT_CSV = ROOT / 'data' / 'fc25_players.csv'

# ── Position mapping: EA FC positions → our positions ──────────────────────

POS_MAP: dict[str, str] = {
    'GK': 'GK',
    'CB': 'CB', 'RCB': 'CB', 'LCB': 'CB',
    'LB': 'LB', 'LWB': 'LB',
    'RB': 'RB', 'RWB': 'RB',
    'CDM': 'CDM', 'RDM': 'CDM', 'LDM': 'CDM',
    'CM': 'CM', 'RCM': 'CM', 'LCM': 'CM',
    'CAM': 'CAM', 'RAM': 'CAM', 'LAM': 'CAM',
    'LM': 'LW', 'LW': 'LW', 'LF': 'LW',
    'RM': 'RW', 'RW': 'RW', 'RF': 'RW',
    'ST': 'ST', 'RS': 'ST', 'LS': 'ST', 'CF': 'ST',
}

# ── Parse our league data ──────────────────────────────────────────────────


def parse_our_clubs() -> dict[str, dict]:
    """Read all clubs from src/data/leagues/*.ts.
    Returns {club_id: {name, league_id, squad_quality, country}}.
    """
    clubs: dict[str, dict] = {}
    for path in sorted(LEAGUES_DIR.glob('*.ts')):
        if path.name == 'index.ts':
            continue
        text = path.read_text(encoding='utf-8')
        country_m = re.search(r"country:\s*'([^']+)'", text)
        country = country_m.group(1) if country_m else ''
        league_m = re.search(r"id:\s*'([^']+)'", text)
        league_id = league_m.group(1) if league_m else path.stem

        block_m = re.search(
            r'export const CLUBS:\s*ClubData\[\]\s*=\s*\[(.*?)\n\];',
            text, flags=re.S,
        )
        if not block_m:
            continue
        for obj in re.finditer(r'\{([^{}]+)\}', block_m.group(1), flags=re.S):
            t = obj.group(1)
            id_m = re.search(r"id:\s*'([^']+)'", t)
            name_m = re.search(r'''name:\s*(?:'([^']*)'|"([^"]*)")''', t)
            sq_m = re.search(r'squadQuality:\s*(\d+)', t)
            if not (id_m and name_m and sq_m):
                continue
            name = name_m.group(1) if name_m.group(1) is not None else name_m.group(2)
            clubs[id_m.group(1)] = {
                'name': name, 'league_id': league_id,
                'squad_quality': int(sq_m.group(1)), 'country': country,
            }
    return clubs


# ── Fuzzy club matching ────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    n = re.sub(r'[^a-z0-9 ]', '', name.lower())
    for sfx in ['fc', 'sc', 'cf', 'afc', 'fk', 'sk', 'bk', 'if', 'bsc',
                 'vfl', 'sv', 'ssc', 'us', 'as', 'og', 'ac', 'de']:
        n = re.sub(r'\b' + sfx + r'\b', '', n)
    return ' '.join(n.split())


def build_club_lookup(our_clubs: dict[str, dict]) -> dict[str, str]:
    """Build {normalized_name: club_id} for fast exact-match lookups."""
    lookup: dict[str, str] = {}
    for cid, info in our_clubs.items():
        lookup[_normalize(info['name'])] = cid
        # Also add the ID itself as a lookup (e.g., "arsenal" matches "Arsenal")
        lookup[_normalize(cid.replace('-', ' '))] = cid
    return lookup


def match_csv_club(csv_club_name: str, our_clubs: dict[str, dict],
                   lookup: dict[str, str]) -> str | None:
    """Match a CSV club name to one of our club IDs."""
    norm = _normalize(csv_club_name)

    # Exact match first
    if norm in lookup:
        return lookup[norm]

    # Fuzzy match
    best_score = 0.0
    best_id = None
    for cid, info in our_clubs.items():
        score = SequenceMatcher(None, norm, _normalize(info['name'])).ratio()
        if score > best_score:
            best_score = score
            best_id = cid

    return best_id if best_score >= 0.55 else None


# ── CSV reading ────────────────────────────────────────────────────────────

def detect_columns(fieldnames: list[str]) -> dict[str, str]:
    """Auto-detect which CSV columns map to what we need.
    Different FC datasets use slightly different column names.
    """
    mapping: dict[str, str] = {}
    candidates = {
        'name': ['short_name', 'known_as', 'Name', 'name', 'player_name'],
        'long_name': ['long_name', 'LongName', 'full_name', 'player_full_name'],
        'positions': ['player_positions', 'Position', 'positions', 'player_position', 'Best Position'],
        'overall': ['overall', 'Overall', 'OVA', 'rating'],
        'potential': ['potential', 'Potential', 'POT'],
        'age': ['age', 'Age'],
        'nationality': ['nationality_name', 'Nationality', 'nationality', 'Nation'],
        'club': ['club_name', 'Club', 'club', 'club_team_name', 'Team'],
        'value': ['value_eur', 'Value', 'value'],
        'wage': ['wage_eur', 'Wage', 'wage'],
    }
    fn_set = set(fieldnames)
    for key, options in candidates.items():
        for opt in options:
            if opt in fn_set:
                mapping[key] = opt
                break
    return mapping


def read_csv_players(csv_path: Path) -> dict[str, list[dict]]:
    """Read CSV, return {csv_club_name: [player_dicts]} sorted by overall desc."""
    clubs: dict[str, list[dict]] = defaultdict(list)

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print('ERROR: CSV has no headers')
            sys.exit(1)

        col = detect_columns(list(reader.fieldnames))
        required = ['name', 'positions', 'overall', 'age', 'club']
        missing = [k for k in required if k not in col]
        if missing:
            print(f'ERROR: Cannot find CSV columns for: {missing}')
            print(f'Available columns: {reader.fieldnames[:20]}...')
            sys.exit(1)

        print(f'Column mapping: {col}')

        for row in reader:
            club_name = (row.get(col['club']) or '').strip()
            if not club_name:
                continue

            # Parse overall
            try:
                ovr = int(row[col['overall']])
            except (ValueError, KeyError):
                continue

            # Parse age
            try:
                age = int(row[col['age']])
            except (ValueError, KeyError):
                age = 25

            # Parse positions — take the first (primary) position
            raw_pos = (row.get(col['positions']) or '').strip()
            primary_pos = raw_pos.split(',')[0].strip()
            pos = POS_MAP.get(primary_pos, '')
            if not pos:
                continue  # Unknown position, skip

            # Parse name
            long_name_col = col.get('long_name')
            name_col = col['name']
            full_name = (row.get(long_name_col) or row.get(name_col) or '').strip()
            short_name = (row.get(name_col) or '').strip()

            # Split into first/last
            parts = full_name.split()
            if len(parts) >= 2:
                fn, ln = parts[0], ' '.join(parts[1:])
            elif short_name and ' ' in short_name:
                p = short_name.split()
                fn, ln = p[0], ' '.join(p[1:])
            else:
                fn, ln = '', full_name or short_name

            # Potential
            pot = None
            if 'potential' in col:
                try:
                    pot_val = int(row[col['potential']])
                    if pot_val > ovr:
                        pot = pot_val
                except (ValueError, KeyError):
                    pass

            # Nationality
            nat = ''
            if 'nationality' in col:
                nat = (row.get(col['nationality']) or '').strip()

            clubs[club_name].append({
                'fn': fn, 'ln': ln, 'pos': pos,
                'age': age, 'nat': nat, 'ovr': ovr, 'pot': pot,
            })

    # Sort each club's players by overall (best first)
    for club_name in clubs:
        clubs[club_name].sort(key=lambda p: -p['ovr'])

    return dict(clubs)


# ── Squad selection ────────────────────────────────────────────────────────

SQUAD_TEMPLATE_COUNTS = {
    'GK': 2, 'CB': 5, 'LB': 2, 'RB': 2,
    'CDM': 1, 'CM': 5, 'CAM': 1,
    'LW': 2, 'RW': 2, 'ST': 3,
}


def select_squad(players: list[dict], max_size: int = 25) -> list[dict]:
    """Pick the best 25 players respecting position distribution."""
    selected: list[dict] = []
    remaining = list(players)
    counts: dict[str, int] = defaultdict(int)

    # First pass: fill each position up to template count
    for pos, target in SQUAD_TEMPLATE_COUNTS.items():
        pos_players = [p for p in remaining if p['pos'] == pos]
        for p in pos_players[:target]:
            selected.append(p)
            remaining.remove(p)
            counts[pos] += 1

    # Second pass: fill remaining slots with best available
    while len(selected) < max_size and remaining:
        selected.append(remaining.pop(0))

    return selected[:max_size]


# ── TypeScript generation ──────────────────────────────────────────────────

def esc(s: str) -> str:
    return s.replace("'", "\\'")


def write_squad_file(league_id: str, country: str,
                     squads: dict[str, list[dict]], path: Path) -> None:
    lines = [
        "import type { PlayerTemplate } from '@/data/playerTemplates';",
        '', f'// {country} — auto-generated from EA FC 25 dataset',
        'export const SQUADS: Record<string, PlayerTemplate[]> = {',
    ]
    for cid in sorted(squads.keys()):
        lines.append(f"  '{esc(cid)}': [")
        for p in squads[cid]:
            pot = f", pot: {p['pot']}" if p.get('pot') else ''
            lines.append(
                f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', "
                f"pos: '{p['pos']}', age: {p['age']}, "
                f"nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot} }},"
            )
        lines.append('  ],')
    lines.append('};')
    lines.append('')
    path.write_text('\n'.join(lines), encoding='utf-8')


def write_index_ts() -> None:
    """Rewrite squads/index.ts to import all squad files."""
    squad_files = sorted(
        p.stem for p in SQUADS_DIR.glob('*.ts')
        if p.name not in ('index.ts', 'overrides.ts')
    )
    lines = ["import type { PlayerTemplate } from '@/data/playerTemplates';", '']
    for stem in squad_files:
        var = stem.upper().replace('-', '_') + '_SQUADS'
        lines.append(f"import {{ SQUADS as {var} }} from './{stem}';")

    if (SQUADS_DIR / 'overrides.ts').exists():
        lines.append("import { SQUAD_OVERRIDES } from './overrides';")

    lines.extend([
        '', '/** All club squad templates, keyed by club ID */',
        'export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {',
    ])
    for stem in squad_files:
        var = stem.upper().replace('-', '_') + '_SQUADS'
        lines.append(f'  ...{var},')
    lines.append('};')

    if (SQUADS_DIR / 'overrides.ts').exists():
        lines.extend([
            '', '/**',
            ' * Merge verified overrides from CSV planning sheet into squad templates.',
            ' * NOTE: This mutates ALL_SQUAD_TEMPLATES at module init time by appending',
            ' * override entries. Callers see the merged result via the normal export.',
            ' */',
            'for (const [clubId, additions] of Object.entries(SQUAD_OVERRIDES)) {',
            '  ALL_SQUAD_TEMPLATES[clubId] = [...(ALL_SQUAD_TEMPLATES[clubId] || []), ...additions];',
            '}',
        ])
    lines.append('')
    (SQUADS_DIR / 'index.ts').write_text('\n'.join(lines), encoding='utf-8')


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Import EA FC 25 player data into TypeScript squad files.',
        epilog='See script header for full setup instructions.',
    )
    parser.add_argument('--csv', type=Path, default=DEFAULT_CSV,
                        help=f'Path to EA FC 25 players CSV (default: {DEFAULT_CSV.relative_to(ROOT)})')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview matching without writing files')
    parser.add_argument('--min-match', type=float, default=0.55,
                        help='Minimum fuzzy match score (0-1, default: 0.55)')
    args = parser.parse_args()

    if not args.csv.exists():
        print(f'CSV not found: {args.csv}')
        print()
        print('To get the data:')
        print('  1. Go to kaggle.com and search for "EA FC 25 complete player dataset"')
        print('  2. Download the CSV (free with Kaggle account)')
        print(f'  3. Place it at: {DEFAULT_CSV.relative_to(ROOT)}')
        print(f'     Or pass a custom path: python {Path(__file__).name} --csv /path/to/file.csv')
        sys.exit(1)

    # Step 1: Parse our clubs
    print('Reading our league data...')
    our_clubs = parse_our_clubs()
    print(f'  {len(our_clubs)} clubs across {len(set(c["league_id"] for c in our_clubs.values()))} leagues')
    lookup = build_club_lookup(our_clubs)

    # Step 2: Read CSV
    print(f'\nReading CSV: {args.csv}...')
    csv_clubs = read_csv_players(args.csv)
    total_players = sum(len(p) for p in csv_clubs.values())
    print(f'  {total_players} players across {len(csv_clubs)} clubs')

    # Step 3: Match clubs
    print('\nMatching clubs...')
    matched: dict[str, tuple[str, list[dict]]] = {}  # our_id -> (csv_name, players)
    unmatched_csv: list[str] = []
    matched_count = 0

    for csv_name, players in csv_clubs.items():
        our_id = match_csv_club(csv_name, our_clubs, lookup)
        if our_id and our_id not in matched:
            matched[our_id] = (csv_name, players)
            matched_count += 1
        else:
            unmatched_csv.append(csv_name)

    unmatched_ours = [cid for cid in our_clubs if cid not in matched]
    print(f'  Matched: {matched_count}/{len(our_clubs)} clubs')
    if unmatched_ours:
        print(f'  Our clubs without CSV match: {len(unmatched_ours)}')
        for cid in unmatched_ours[:15]:
            print(f'    - {cid} ({our_clubs[cid]["name"]})')
        if len(unmatched_ours) > 15:
            print(f'    ... and {len(unmatched_ours) - 15} more')

    if args.dry_run:
        print('\n[DRY RUN] Would generate files for:')
        by_league: dict[str, int] = defaultdict(int)
        for cid in matched:
            by_league[our_clubs[cid]['league_id']] += 1
        for lid, count in sorted(by_league.items()):
            print(f'  {lid}: {count} clubs')
        return

    # Step 4: Generate .ts files
    print('\nGenerating squad files...')
    leagues: dict[str, dict[str, list[dict]]] = defaultdict(dict)
    total_generated = 0

    for our_id, (csv_name, players) in matched.items():
        info = our_clubs[our_id]
        squad = select_squad(players)
        leagues[info['league_id']][our_id] = squad
        total_generated += len(squad)

    # Country name per league for file naming
    league_country: dict[str, str] = {}
    for info in our_clubs.values():
        league_country[info['league_id']] = info['country']

    for league_id, squads in sorted(leagues.items()):
        country = league_country.get(league_id, league_id)
        stem = country.lower().replace(' ', '-')
        path = SQUADS_DIR / f'{stem}.ts'

        # If file exists, merge (keep existing clubs, add new ones)
        if path.exists():
            existing_text = path.read_text(encoding='utf-8')
            existing_ids = set(re.findall(r"'([^']+)':\s*\[", existing_text))
            new_squads = {cid: sq for cid, sq in squads.items()
                          if cid not in existing_ids}
            if new_squads:
                # Append new clubs to existing file
                text = existing_text.rstrip()
                if text.endswith('};'):
                    text = text[:-2]
                for cid in sorted(new_squads.keys()):
                    text += f"\n  '{esc(cid)}': [\n"
                    for p in new_squads[cid]:
                        pot = f", pot: {p['pot']}" if p.get('pot') else ''
                        text += (
                            f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', "
                            f"pos: '{p['pos']}', age: {p['age']}, "
                            f"nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot} }},\n"
                        )
                    text += '  ],\n'
                text += '};\n'
                path.write_text(text, encoding='utf-8')
                print(f'  Updated {stem}.ts: added {len(new_squads)} clubs '
                      f'(kept {len(existing_ids)} existing)')
            else:
                print(f'  {stem}.ts: all {len(squads)} clubs already exist, skipped')
        else:
            write_squad_file(league_id, country, squads, path)
            print(f'  Created {stem}.ts: {len(squads)} clubs')

    # Step 5: Update index.ts
    print('\nUpdating index.ts...')
    write_index_ts()

    print(f'\nDone! Generated {total_generated} player templates '
          f'for {len(matched)} clubs across {len(leagues)} leagues.')
    print(f'\nNext steps:')
    print(f'  1. Run: npm run preflight')
    print(f'  2. Review the generated files in src/data/squads/')
    print(f'  3. Commit when satisfied')


if __name__ == '__main__':
    main()
