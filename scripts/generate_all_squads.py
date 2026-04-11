#!/usr/bin/env python3
"""Generate squad .ts files for ALL clubs using known player data + name pools.

This script:
1. Reads known player data from scripts/known_players/ JSON files
2. Fills remaining squad slots using the name pool from src/config/namePool.ts
3. Generates .ts squad files for leagues that don't have them yet
4. Updates src/data/squads/index.ts

Usage:
  python scripts/generate_all_squads.py
"""

from __future__ import annotations

import json
import os
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAGUES_DIR = ROOT / 'src' / 'data' / 'leagues'
SQUADS_DIR = ROOT / 'src' / 'data' / 'squads'
KNOWN_DIR = ROOT / 'scripts' / 'known_players'
NAMEPOOL_PATH = ROOT / 'src' / 'config' / 'namePool.ts'

random.seed(42)

# ── Squad template (sync with src/config/playerGeneration.ts) ─────────────

SQUAD_TEMPLATE = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'CB', 'CB',
    'LB', 'LB', 'RB', 'RB',
    'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
    'CAM',
    'LW', 'LW', 'RW', 'RW',
    'ST', 'ST', 'ST',
]

# League → primary nationalities for filler players
LEAGUE_NATIONALITIES: dict[str, list[str]] = {
    'aut': ['Austria', 'Germany', 'Croatia', 'Serbia'],
    'bel': ['Belgium', 'France', 'Netherlands', 'Nigeria'],
    'bgr': ['Bulgaria', 'Serbia', 'Romania', 'Nigeria'],
    'che': ['Switzerland', 'France', 'Germany', 'Portugal'],
    'cro': ['Croatia', 'Bosnia', 'Serbia', 'Slovenia'],
    'cyp': ['Cyprus', 'Greece', 'Portugal', 'Nigeria'],
    'cze': ['Czech Republic', 'Slovakia', 'Nigeria', 'Serbia'],
    'den': ['Denmark', 'Sweden', 'Norway', 'Nigeria'],
    'eng': ['England', 'France', 'Brazil', 'Spain'],
    'esp': ['Spain', 'Brazil', 'Argentina', 'France'],
    'fin': ['Finland', 'Sweden', 'Nigeria', 'Ghana'],
    'fra': ['France', 'Senegal', 'Morocco', 'Ivory Coast'],
    'ger': ['Germany', 'France', 'Austria', 'Turkey'],
    'gre': ['Greece', 'Nigeria', 'Senegal', 'Argentina'],
    'hun': ['Hungary', 'Serbia', 'Romania', 'Nigeria'],
    'irl': ['Ireland', 'England', 'Scotland', 'Nigeria'],
    'isl': ['Iceland', 'Denmark', 'Sweden', 'Norway'],
    'isr': ['Israel', 'Nigeria', 'Ghana', 'Argentina'],
    'ita': ['Italy', 'Argentina', 'Brazil', 'France'],
    'ned': ['Netherlands', 'Belgium', 'Nigeria', 'Ghana'],
    'nor': ['Norway', 'Sweden', 'Denmark', 'Iceland'],
    'pol': ['Poland', 'Ukraine', 'Czech Republic', 'Portugal'],
    'por': ['Portugal', 'Brazil', 'Argentina', 'Spain'],
    'rou': ['Romania', 'Serbia', 'Bulgaria', 'Nigeria'],
    'sco': ['Scotland', 'England', 'Ireland', 'USA'],
    'srb': ['Serbia', 'Bosnia', 'Montenegro', 'Croatia'],
    'svk': ['Slovakia', 'Czech Republic', 'Hungary', 'Serbia'],
    'swe': ['Sweden', 'Norway', 'Denmark', 'Iceland'],
    'tur': ['Turkey', 'Nigeria', 'Senegal', 'France'],
    'ukr': ['Ukraine', 'Brazil', 'Nigeria', 'Georgia'],
}


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


# ── Parse name pool ───────────────────────────────────────────────────────

def parse_name_pool() -> dict[str, tuple[list[str], list[str]]]:
    """Read src/config/namePool.ts and return {nationality: (firstNames, lastNames)}."""
    text = NAMEPOOL_PATH.read_text(encoding='utf-8')
    pools: dict[str, tuple[list[str], list[str]]] = {}

    # Match each nationality block
    for m in re.finditer(
        r"'([^']+)':\s*\{\s*firstNames:\s*\[([^\]]+)\].*?lastNames:\s*\[([^\]]+)\]",
        text, flags=re.S,
    ):
        nat = m.group(1)
        firsts = re.findall(r"'([^']+)'", m.group(2))
        lasts = re.findall(r"'([^']+)'", m.group(3))
        if firsts and lasts:
            pools[nat] = (firsts, lasts)

    # Fallback pool
    fallback_firsts = re.findall(r"'([^']+)'", text.split('FALLBACK_FIRST_NAMES')[1].split(']')[0]) if 'FALLBACK_FIRST_NAMES' in text else ['Alex', 'Max', 'Leo', 'Tom']
    fallback_lasts = re.findall(r"'([^']+)'", text.split('FALLBACK_LAST_NAMES')[1].split(']')[0]) if 'FALLBACK_LAST_NAMES' in text else ['Smith', 'Jones', 'Brown']
    pools['_fallback'] = (fallback_firsts, fallback_lasts)

    return pools


# ── Parse league data ─────────────────────────────────────────────────────

def parse_clubs() -> dict[str, dict]:
    """Read all clubs from league files."""
    clubs: dict[str, dict] = {}
    for path in sorted(LEAGUES_DIR.glob('*.ts')):
        if path.name == 'index.ts':
            continue
        text = path.read_text(encoding='utf-8')
        country_m = re.search(r"country:\s*'([^']+)'", text)
        country = country_m.group(1) if country_m else ''
        league_m = re.search(r"id:\s*'([^']+)'", text)
        league_id = league_m.group(1) if league_m else path.stem

        block_m = re.search(r'export const CLUBS:.*?=\s*\[(.*?)\n\];', text, flags=re.S)
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


# ── Load known players ────────────────────────────────────────────────────

def load_known_players() -> dict[str, list[tuple]]:
    """Load known player data from JSON files in scripts/known_players/."""
    all_known: dict[str, list[tuple]] = {}
    if not KNOWN_DIR.exists():
        return all_known
    for path in sorted(KNOWN_DIR.glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        for club_id, players in data.items():
            all_known[club_id] = [tuple(p) for p in players]
    return all_known


# ── Generate squad ────────────────────────────────────────────────────────

def generate_random_name(nat: str, pools: dict, used: set[str]) -> tuple[str, str]:
    """Generate a random name for a given nationality."""
    firsts, lasts = pools.get(nat, pools.get('_fallback', (['Alex'], ['Smith'])))
    for _ in range(50):
        fn = random.choice(firsts)
        ln = random.choice(lasts)
        key = f'{fn} {ln}'
        if key not in used:
            used.add(key)
            return fn, ln
    # Fallback with number suffix
    fn = random.choice(firsts)
    ln = random.choice(lasts)
    return fn, ln


def generate_squad(club_id: str, club_info: dict,
                   known: list[tuple] | None,
                   pools: dict) -> list[dict]:
    """Generate a 25-player squad for a club."""
    sq = club_info['squad_quality']
    league_id = club_info['league_id']
    nats = LEAGUE_NATIONALITIES.get(league_id, [club_info['country']])
    used_names: set[str] = set()

    players: list[dict] = []

    # Add known players first
    if known:
        for p in known[:25]:
            fn, ln, pos, age, nat, ovr = p[0], p[1], p[2], p[3], p[4], p[5]
            pot = p[6] if len(p) > 6 and p[6] else None
            used_names.add(f'{fn} {ln}')
            entry: dict = {'fn': fn, 'ln': ln, 'pos': pos, 'age': age,
                          'nat': nat, 'ovr': ovr}
            if pot and pot > ovr:
                entry['pot'] = pot
            players.append(entry)

    # Determine which template positions still need filling
    filled_positions = [p['pos'] for p in players]
    needed: list[str] = []
    from collections import Counter
    filled_counts = Counter(filled_positions)
    template_counts = Counter(SQUAD_TEMPLATE)
    for pos, count in template_counts.items():
        remaining = count - filled_counts.get(pos, 0)
        needed.extend([pos] * max(0, remaining))

    # Fill remaining slots
    for pos in needed:
        if len(players) >= 25:
            break
        # Pick nationality (weighted: 60% primary, 20% secondary, 20% other)
        r = random.random()
        if r < 0.6 and len(nats) > 0:
            nat = nats[0]
        elif r < 0.8 and len(nats) > 1:
            nat = nats[1]
        elif len(nats) > 2:
            nat = random.choice(nats[2:])
        else:
            nat = nats[0] if nats else club_info['country']

        fn, ln = generate_random_name(nat, pools, used_names)

        # Generate age
        age_r = random.random()
        if age_r < 0.20:
            age = random.randint(17, 21)
        elif age_r < 0.76:
            age = random.randint(22, 29)
        else:
            age = random.randint(30, 34)

        # Generate rating
        base = sq + random.randint(-8, 4)
        ovr = clamp(base, 48, 92)

        # Potential
        pot = None
        if age <= 21:
            pot = clamp(ovr + random.randint(6, 14), ovr + 1, 94)
        elif age <= 24:
            pot = clamp(ovr + random.randint(3, 8), ovr + 1, 92)

        entry = {'fn': fn, 'ln': ln, 'pos': pos, 'age': age,
                'nat': nat, 'ovr': ovr}
        if pot:
            entry['pot'] = pot
        players.append(entry)

    return players[:25]


# ── TypeScript generation ─────────────────────────────────────────────────

def esc(s: str) -> str:
    return s.replace("'", "\\'")


def write_squad_file(country: str, squads: dict[str, list[dict]], path: Path) -> None:
    lines = [
        "import type { PlayerTemplate } from '@/data/playerTemplates';",
        '', f'// {country} — generated by generate_all_squads.py',
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
            ' * Merge verified overrides from CSV planning sheet.',
            ' * NOTE: Mutates ALL_SQUAD_TEMPLATES at module init.',
            ' */',
            'for (const [clubId, additions] of Object.entries(SQUAD_OVERRIDES)) {',
            '  ALL_SQUAD_TEMPLATES[clubId] = [...(ALL_SQUAD_TEMPLATES[clubId] || []), ...additions];',
            '}',
        ])
    lines.append('')
    (SQUADS_DIR / 'index.ts').write_text('\n'.join(lines), encoding='utf-8')


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    print('Parsing name pool...')
    pools = parse_name_pool()
    print(f'  {len(pools)} nationality pools loaded')

    print('Parsing league data...')
    clubs = parse_clubs()
    leagues = set(c['league_id'] for c in clubs.values())
    print(f'  {len(clubs)} clubs across {len(leagues)} leagues')

    print('Loading known players...')
    known = load_known_players()
    print(f'  {len(known)} clubs with known player data')

    # Find which clubs already have squads in existing .ts files
    existing_clubs: set[str] = set()
    for path in SQUADS_DIR.glob('*.ts'):
        if path.name in ('index.ts', 'overrides.ts'):
            continue
        text = path.read_text(encoding='utf-8')
        existing_clubs.update(re.findall(r"'([^']+)':\s*\[", text))

    print(f'  {len(existing_clubs)} clubs already have squad files')

    # Group clubs needing squads by league
    clubs_needing: dict[str, list[str]] = defaultdict(list)
    for cid, info in clubs.items():
        if cid not in existing_clubs:
            clubs_needing[info['league_id']].append(cid)

    total_need = sum(len(v) for v in clubs_needing.values())
    print(f'\n  {total_need} clubs need squad generation across {len(clubs_needing)} leagues')

    if total_need == 0:
        print('All clubs already have squads!')
        return

    # Generate squads
    league_country: dict[str, str] = {}
    for info in clubs.values():
        league_country[info['league_id']] = info['country']

    total_players = 0
    total_clubs_gen = 0

    for league_id, club_ids in sorted(clubs_needing.items()):
        country = league_country.get(league_id, league_id)
        stem = country.lower().replace(' ', '-')
        path = SQUADS_DIR / f'{stem}.ts'

        squads: dict[str, list[dict]] = {}
        for cid in club_ids:
            info = clubs[cid]
            known_data = known.get(cid)
            squad = generate_squad(cid, info, known_data, pools)
            squads[cid] = squad
            total_players += len(squad)
            total_clubs_gen += 1

        if path.exists():
            # Append to existing file
            text = path.read_text(encoding='utf-8').rstrip()
            if text.endswith('};'):
                text = text[:-2]
            for cid in sorted(squads.keys()):
                text += f"\n  '{esc(cid)}': [\n"
                for p in squads[cid]:
                    pot = f", pot: {p['pot']}" if p.get('pot') else ''
                    text += (
                        f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', "
                        f"pos: '{p['pos']}', age: {p['age']}, "
                        f"nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot} }},\n"
                    )
                text += '  ],\n'
            text += '};\n'
            path.write_text(text, encoding='utf-8')
            print(f'  Updated {stem}.ts: +{len(squads)} clubs')
        else:
            write_squad_file(country, squads, path)
            print(f'  Created {stem}.ts: {len(squads)} clubs')

    # Update index.ts
    print('\nUpdating index.ts...')
    write_index_ts()

    print(f'\nDone! Generated {total_players} players for {total_clubs_gen} clubs.')
    print('Run: npm run preflight')


if __name__ == '__main__':
    main()
