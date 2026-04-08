#!/usr/bin/env python3
"""Fetch real squad data from football APIs and generate TypeScript squad files.

Requires Python 3.10+.

Supports two API backends with automatic fallback:
  1. api-football.com (via api-sports.io) — broadest coverage (30+ leagues)
  2. football-data.org — reliable fallback (7 top leagues)

Usage:
  # Set API key(s) as environment variables
  export API_FOOTBALL_KEY=your_key    # from api-sports.io (free: 100 req/day)
  export FOOTBALL_DATA_KEY=your_key   # from football-data.org (free: 10 req/min)

  # Run full pipeline (discover teams, fetch squads, generate .ts files)
  python scripts/fetch_squad_data.py all

  # Or run steps individually:
  python scripts/fetch_squad_data.py discover   # Map our clubs to API teams
  python scripts/fetch_squad_data.py fetch       # Fetch squad data (uses cache)
  python scripts/fetch_squad_data.py generate    # Generate .ts files from cache
  python scripts/fetch_squad_data.py update-index # Update squads/index.ts imports

Rate limits & caching:
  - api-football free tier: 100 req/day -> ~5 days for all 455 teams
  - All API responses cached to scripts/.cache/. Re-running skips cached data.
  - To re-fetch a team, delete its cache file.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

# ─── Paths ───────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / 'scripts' / '.cache' / 'squads'
MAPPING_PATH = ROOT / 'scripts' / '.cache' / 'club_mapping.json'
LEAGUES_DIR = ROOT / 'src' / 'data' / 'leagues'
SQUADS_DIR = ROOT / 'src' / 'data' / 'squads'

# ─── API League ID Mappings ──────────────────────────────────────────────────

# api-football.com league IDs (season=2025 for 2025/26)
API_FOOTBALL_LEAGUES: dict[str, int] = {
    'eng': 39, 'esp': 140, 'ita': 135, 'ger': 78, 'fra': 61, 'ned': 88,
    'aut': 218, 'bel': 144, 'bgr': 172, 'cro': 210, 'cyp': 318, 'cze': 345,
    'den': 119, 'fin': 244, 'gre': 197, 'hun': 271, 'isl': 352, 'irl': 357,
    'isr': 384, 'nor': 103, 'pol': 106, 'por': 94, 'rou': 283, 'sco': 179,
    'srb': 286, 'svk': 332, 'swe': 113, 'che': 207, 'tur': 203, 'ukr': 333,
}

# football-data.org competition codes (fallback, fewer leagues)
FOOTBALL_DATA_LEAGUES: dict[str, str] = {
    'eng': 'PL', 'esp': 'PD', 'ita': 'SA', 'ger': 'BL1',
    'fra': 'FL1', 'ned': 'DED', 'por': 'PPL',
}

SEASON = 2025

# ─── Squad Template (sync with src/config/playerGeneration.ts:71-79) ─────────

SQUAD_TEMPLATE = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'CB', 'CB',
    'LB', 'LB', 'RB', 'RB',
    'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
    'CAM',
    'LW', 'LW', 'RW', 'RW',
    'ST', 'ST', 'ST',
]

# Position slots per generic API category
POSITION_SLOTS: dict[str, list[str]] = {
    'Goalkeeper': ['GK', 'GK'],
    'Defender':   ['CB', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB'],
    'Midfielder': ['CDM', 'CM', 'CM', 'CM', 'CM', 'CM', 'CAM'],
    'Attacker':   ['LW', 'LW', 'RW', 'RW', 'ST', 'ST', 'ST'],
}

# football-data.org gives specific positions — direct mapping
SPECIFIC_POS_MAP: dict[str, str] = {
    'Goalkeeper': 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB',
    'Right-Back': 'RB', 'Defensive Midfield': 'CDM',
    'Central Midfield': 'CM', 'Attacking Midfield': 'CAM',
    'Left Midfield': 'LW', 'Right Midfield': 'RW',
    'Left Winger': 'LW', 'Right Winger': 'RW',
    'Centre-Forward': 'ST', 'Second Striker': 'ST',
}

GENERIC_POS_MAP: dict[str, str] = {
    'Goalkeeper': 'Goalkeeper',
    'Centre-Back': 'Defender', 'Left-Back': 'Defender', 'Right-Back': 'Defender',
    'Defence': 'Defender',
    'Defensive Midfield': 'Midfielder', 'Central Midfield': 'Midfielder',
    'Attacking Midfield': 'Midfielder', 'Left Midfield': 'Midfielder',
    'Right Midfield': 'Midfielder', 'Midfield': 'Midfielder',
    'Left Winger': 'Attacker', 'Right Winger': 'Attacker',
    'Centre-Forward': 'Attacker', 'Second Striker': 'Attacker',
    'Offence': 'Attacker',
}

# ─── Data Classes ────────────────────────────────────────────────────────────


@dataclass
class OurClub:
    id: str
    name: str
    league_id: str
    squad_quality: int
    country: str


@dataclass
class FetchedPlayer:
    full_name: str
    first_name: str
    last_name: str
    age: int
    nationality: str
    position_generic: str   # Goalkeeper / Defender / Midfielder / Attacker
    position_specific: str  # GK / CB / LB / ... (if known)
    market_value: int = 0   # euros, 0 if unknown


# ─── Utilities ───────────────────────────────────────────────────────────────

def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def split_name(full: str) -> tuple[str, str]:
    parts = full.strip().split()
    if len(parts) <= 1:
        return ('', full.strip())
    return (parts[0], ' '.join(parts[1:]))


def normalize_club_name(name: str) -> str:
    """Normalize a club name for fuzzy matching."""
    n = re.sub(r'[^a-z0-9 ]', '', name.lower())
    for sfx in ['fc', 'sc', 'cf', 'afc', 'bk', 'fk', 'sk', 'if', 'bsc',
                 'vfl', 'sv', 'tsv', 'ssc', 'us', 'as', 'og', 'ac']:
        n = re.sub(r'\b' + sfx + r'\b', '', n)
    return ' '.join(n.split())


def fuzzy_score(a: str, b: str) -> float:
    na, nb = normalize_club_name(a), normalize_club_name(b)
    return SequenceMatcher(None, na, nb).ratio()



# ─── Parse Our League Data ───────────────────────────────────────────────────

def parse_our_clubs() -> dict[str, OurClub]:
    """Read all clubs from src/data/leagues/*.ts."""
    clubs: dict[str, OurClub] = {}
    for path in sorted(LEAGUES_DIR.glob('*.ts')):
        if path.name == 'index.ts':
            continue
        text = path.read_text(encoding='utf-8')
        country_m = re.search(r"country:\s*'([^']+)'", text)
        country = country_m.group(1) if country_m else ''
        league_m = re.search(r"id:\s*'([^']+)'", text)
        league_id = league_m.group(1) if league_m else path.stem

        block_m = re.search(
            r"export const CLUBS:\s*ClubData\[\]\s*=\s*\[(.*?)\n\];",
            text, flags=re.S,
        )
        if not block_m:
            continue

        for obj in re.finditer(r'\{([^{}]+)\}', block_m.group(1), flags=re.S):
            obj_text = obj.group(1)
            id_m = re.search(r"id:\s*'([^']+)'", obj_text)
            name_m = re.search(r"""name:\s*(?:'([^']*)'|"([^"]*)")""", obj_text)
            sq_m = re.search(r"squadQuality:\s*(\d+)", obj_text)
            if not (id_m and name_m and sq_m):
                continue
            club_name = name_m.group(1) if name_m.group(1) is not None else name_m.group(2)
            clubs[id_m.group(1)] = OurClub(
                id=id_m.group(1),
                name=club_name,
                league_id=league_id,
                squad_quality=int(sq_m.group(1)),
                country=country,
            )
    return clubs


# ─── API Clients ─────────────────────────────────────────────────────────────

def _cached_request(cache_key: str, url: str, headers: dict,
                    delay: float = 0.5) -> dict | None:
    """Make an HTTP request with disk caching."""
    cache_path = CACHE_DIR / f'{cache_key}.json'
    if cache_path.exists():
        return json.loads(cache_path.read_text())

    req = urllib.request.Request(url)
    for k, v in headers.items():
        req.add_header(k, v)

    try:
        time.sleep(delay)
        resp = urllib.request.urlopen(req, timeout=20)
        data = json.loads(resp.read())
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return data
    except urllib.error.HTTPError as e:
        print(f'    HTTP {e.code}: {e.reason}')
        if e.code == 429:
            print('    Rate limited. Waiting 60s...')
            time.sleep(60)
        return None
    except Exception as e:
        print(f'    Error: {e}')
        return None


class ApiFootball:
    """api-football.com (api-sports.io) client."""

    BASE = 'https://v3.football.api-sports.io'

    def __init__(self, key: str):
        self.key = key
        self.headers = {'x-apisports-key': key}
        self.req_count = 0

    def get_teams(self, league_id: int) -> list[dict]:
        data = _cached_request(
            f'apif_teams_{league_id}_{SEASON}',
            f'{self.BASE}/teams?league={league_id}&season={SEASON}',
            self.headers,
        )
        self.req_count += 1
        if not data:
            return []
        return [r['team'] for r in data.get('response', []) if 'team' in r]

    def get_squad(self, team_id: int) -> list[FetchedPlayer]:
        data = _cached_request(
            f'apif_squad_{team_id}',
            f'{self.BASE}/players/squads?team={team_id}',
            self.headers,
        )
        self.req_count += 1
        if not data or not data.get('response'):
            return []

        players: list[FetchedPlayer] = []
        for entry in data['response']:
            for p in entry.get('players', []):
                fn, ln = split_name(p.get('name', ''))
                players.append(FetchedPlayer(
                    full_name=p.get('name', ''),
                    first_name=fn,
                    last_name=ln,
                    age=p.get('age', 25),
                    nationality='',
                    position_generic=p.get('position', 'Midfielder'),
                    position_specific='',
                ))
        return players


class FootballData:
    """football-data.org client."""

    BASE = 'https://api.football-data.org/v4'

    def __init__(self, key: str):
        self.key = key
        self.headers = {'X-Auth-Token': key}

    def get_teams_with_squads(self, comp_code: str
                              ) -> dict[str, list[FetchedPlayer]]:
        """Return {team_name: [players]} for a competition."""
        data = _cached_request(
            f'fdata_teams_{comp_code}_{SEASON}',
            f'{self.BASE}/competitions/{comp_code}/teams?season={SEASON}',
            self.headers, delay=6.5,
        )
        if not data:
            return {}

        result: dict[str, list[FetchedPlayer]] = {}
        for team in data.get('teams', []):
            players: list[FetchedPlayer] = []
            for p in team.get('squad', []):
                fn, ln = split_name(p.get('name', ''))
                raw_pos = p.get('position', 'Midfield')
                specific = SPECIFIC_POS_MAP.get(raw_pos, '')
                generic = GENERIC_POS_MAP.get(raw_pos, 'Midfielder')
                age = 25
                if dob := p.get('dateOfBirth'):
                    try:
                        age = 2025 - int(dob[:4])
                    except ValueError:
                        pass
                players.append(FetchedPlayer(
                    full_name=p.get('name', ''),
                    first_name=fn,
                    last_name=ln,
                    age=clamp(age, 16, 42),
                    nationality=p.get('nationality', ''),
                    position_generic=generic,
                    position_specific=specific,
                ))
            result[team.get('name', '')] = players
        return result



# ─── Club Matching ───────────────────────────────────────────────────────────

def match_clubs(our_clubs: list[OurClub],
                api_teams: list[dict],
                api_name_key: str = 'name') -> dict[str, dict]:
    """Fuzzy-match our clubs to API teams. Returns {our_id: {api_id, api_name, score}}."""
    mapping: dict[str, dict] = {}
    used_api_ids: set = set()

    for club in our_clubs:
        best_score = 0.0
        best_team = None
        for team in api_teams:
            api_name = team.get(api_name_key, '')
            api_id = team.get('id', 0)
            if api_id in used_api_ids:
                continue
            score = fuzzy_score(club.name, api_name)
            if score > best_score:
                best_score = score
                best_team = team

        if best_team and best_score >= 0.4:
            api_id = best_team.get('id', 0)
            used_api_ids.add(api_id)
            mapping[club.id] = {
                'api_id': api_id,
                'api_name': best_team.get(api_name_key, ''),
                'our_name': club.name,
                'score': round(best_score, 3),
                'confirmed': best_score >= 0.7,
            }
        else:
            mapping[club.id] = {
                'api_id': None,
                'api_name': '',
                'our_name': club.name,
                'score': 0,
                'confirmed': False,
            }

    return mapping


# ─── Position Assignment ─────────────────────────────────────────────────────

def assign_positions(players: list[FetchedPlayer]) -> list[tuple[FetchedPlayer, str]]:
    """Assign specific positions (GK/CB/LB/...) to players.

    Uses specific positions when available, otherwise distributes generic
    positions across the squad template slots.
    """
    result: list[tuple[FetchedPlayer, str]] = []
    unassigned: dict[str, list[FetchedPlayer]] = defaultdict(list)

    # First pass: use specific positions where available
    for p in players:
        if p.position_specific:
            result.append((p, p.position_specific))
        else:
            unassigned[p.position_generic].append(p)

    # Second pass: distribute generic positions across template slots
    # Count how many of each specific position we already have
    assigned_counts: Counter[str] = Counter(pos for _, pos in result)

    for generic, slot_list in POSITION_SLOTS.items():
        remaining = unassigned.get(generic, [])
        for slot_pos in slot_list:
            if assigned_counts[slot_pos] >= SQUAD_TEMPLATE.count(slot_pos):
                continue
            if not remaining:
                break
            player = remaining.pop(0)
            result.append((player, slot_pos))
            assigned_counts[slot_pos] += 1

    # Any leftover players: assign to most-needed positions
    all_remaining = []
    for group in unassigned.values():
        all_remaining.extend(group)

    for player in all_remaining:
        if player not in [p for p, _ in result]:
            # Find position with biggest gap
            for pos in SQUAD_TEMPLATE:
                if assigned_counts[pos] < SQUAD_TEMPLATE.count(pos):
                    result.append((player, pos))
                    assigned_counts[pos] += 1
                    break

    return result


# ─── Rating Estimation ───────────────────────────────────────────────────────

def estimate_rating(squad_quality: int, rank_in_squad: int,
                    total_players: int, age: int,
                    market_value: int = 0) -> tuple[int, int | None]:
    """Estimate (overall, potential) for a player.

    Uses market value if available, otherwise derives from club quality
    and the player's rank within the squad (assumes API returns roughly
    by importance).
    """
    if market_value > 0:
        # Market-value-based estimation
        mv_m = market_value / 1_000_000
        if mv_m >= 100:    base = random.randint(88, 93)
        elif mv_m >= 60:   base = random.randint(85, 89)
        elif mv_m >= 30:   base = random.randint(81, 85)
        elif mv_m >= 15:   base = random.randint(77, 81)
        elif mv_m >= 8:    base = random.randint(73, 77)
        elif mv_m >= 3:    base = random.randint(68, 73)
        elif mv_m >= 1:    base = random.randint(63, 68)
        elif mv_m >= 0.3:  base = random.randint(58, 63)
        else:              base = random.randint(52, 58)
    else:
        # Squad-quality-based estimation with rank adjustment
        ratio = rank_in_squad / max(total_players, 1)
        if ratio < 0.15:     adj = random.randint(3, 6)   # Stars
        elif ratio < 0.45:   adj = random.randint(-1, 3)  # Starters
        elif ratio < 0.75:   adj = random.randint(-5, 0)  # Squad
        else:                adj = random.randint(-10, -4) # Reserves
        base = squad_quality + adj

    ovr = clamp(base, 48, 94)

    # Potential based on age
    if age <= 20:     pot = ovr + random.randint(8, 15)
    elif age <= 23:   pot = ovr + random.randint(5, 10)
    elif age <= 27:   pot = ovr + random.randint(2, 5)
    elif age <= 30:   pot = ovr + random.randint(0, 2)
    else:             pot = ovr

    pot = clamp(pot, ovr, 94)
    return ovr, pot if pot > ovr else None



# ─── TypeScript Generation ───────────────────────────────────────────────────

def esc(s: str) -> str:
    """Escape single quotes for TS string literals."""
    return s.replace("'", "\\'")


def generate_squad_ts(league_id: str, country: str,
                      squads: dict[str, list[dict]]) -> str:
    """Generate a TypeScript squad file for one league."""
    lines = [
        "import type { PlayerTemplate } from '@/data/playerTemplates';",
        '',
        f'// {country} — auto-generated by fetch_squad_data.py',
        'export const SQUADS: Record<string, PlayerTemplate[]> = {',
    ]

    for club_id in sorted(squads.keys()):
        players = squads[club_id]
        lines.append(f"  '{esc(club_id)}': [")
        for p in players:
            pot_str = f", pot: {p['pot']}" if p.get('pot') else ''
            lines.append(
                f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', "
                f"pos: '{p['pos']}', age: {p['age']}, "
                f"nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot_str} }},"
            )
        lines.append('  ],')

    lines.append('};')
    lines.append('')
    return '\n'.join(lines)


def update_index_ts(league_ids: list[str], countries: dict[str, str]) -> None:
    """Rewrite src/data/squads/index.ts to import all squad files."""
    index_path = SQUADS_DIR / 'index.ts'

    # Find all squad .ts files (exclude index.ts and overrides.ts)
    squad_files = sorted(
        p.stem for p in SQUADS_DIR.glob('*.ts')
        if p.name not in ('index.ts', 'overrides.ts')
    )

    lines = ["import type { PlayerTemplate } from '@/data/playerTemplates';", '']

    # Generate imports
    for stem in squad_files:
        var_name = stem.upper().replace('-', '_') + '_SQUADS'
        lines.append(f"import {{ SQUADS as {var_name} }} from './{stem}';")

    # Import overrides if file exists
    overrides_path = SQUADS_DIR / 'overrides.ts'
    if overrides_path.exists():
        lines.append("import { SQUAD_OVERRIDES } from './overrides';")

    lines.append('')
    lines.append('/** All club squad templates, keyed by club ID */')
    lines.append('export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {')
    for stem in squad_files:
        var_name = stem.upper().replace('-', '_') + '_SQUADS'
        lines.append(f'  ...{var_name},')
    lines.append('};')

    if overrides_path.exists():
        lines.extend([
            '',
            '/**',
            ' * Merge verified overrides from CSV planning sheet into squad templates.',
            ' * NOTE: This mutates ALL_SQUAD_TEMPLATES at module init time by appending',
            ' * override entries. Callers see the merged result via the normal export.',
            ' */',
            'for (const [clubId, additions] of Object.entries(SQUAD_OVERRIDES)) {',
            '  ALL_SQUAD_TEMPLATES[clubId] = [...(ALL_SQUAD_TEMPLATES[clubId] || []), ...additions];',
            '}',
        ])

    lines.append('')
    index_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f'  Updated {index_path.relative_to(ROOT)}')


# ─── Commands ────────────────────────────────────────────────────────────────

def cmd_discover(our_clubs: dict[str, OurClub]) -> None:
    """Discover API teams and create club mapping."""
    api_key = os.environ.get('API_FOOTBALL_KEY', '')
    fd_key = os.environ.get('FOOTBALL_DATA_KEY', '')

    if not api_key and not fd_key:
        print('ERROR: Set API_FOOTBALL_KEY or FOOTBALL_DATA_KEY env var.')
        sys.exit(1)

    mapping: dict[str, dict] = {}
    clubs_by_league: dict[str, list[OurClub]] = defaultdict(list)
    for club in our_clubs.values():
        clubs_by_league[club.league_id].append(club)

    # Try api-football first
    if api_key:
        client = ApiFootball(api_key)
        for league_id, api_league_id in API_FOOTBALL_LEAGUES.items():
            league_clubs = clubs_by_league.get(league_id, [])
            if not league_clubs:
                continue
            print(f'[api-football] Discovering {league_id} (API league {api_league_id})...')
            teams = client.get_teams(api_league_id)
            if not teams:
                print(f'  No teams found. League ID {api_league_id} may be wrong.')
                continue
            print(f'  Found {len(teams)} API teams, matching {len(league_clubs)} clubs...')
            league_map = match_clubs(league_clubs, teams)
            for cid, entry in league_map.items():
                entry['source'] = 'api-football'
                entry['api_league_id'] = api_league_id
            mapping.update(league_map)

            matched = sum(1 for e in league_map.values() if e['confirmed'])
            low = sum(1 for e in league_map.values()
                       if e['api_id'] and not e['confirmed'])
            missed = sum(1 for e in league_map.values() if not e['api_id'])
            print(f'  Matched: {matched} confirmed, {low} low-confidence, {missed} unmatched')

    # Fallback: football-data.org for unmapped leagues
    if fd_key:
        client_fd = FootballData(fd_key)
        for league_id, comp_code in FOOTBALL_DATA_LEAGUES.items():
            league_clubs = clubs_by_league.get(league_id, [])
            unmapped = [c for c in league_clubs if c.id not in mapping
                         or not mapping[c.id].get('api_id')]
            if not unmapped:
                continue
            print(f'[football-data] Discovering {league_id} ({comp_code})...')
            teams_data = client_fd.get_teams_with_squads(comp_code)
            if not teams_data:
                continue
            # Build team list for matching
            api_teams = [{'id': i, 'name': name}
                         for i, name in enumerate(teams_data.keys())]
            fd_map = match_clubs(unmapped, api_teams)
            for cid, entry in fd_map.items():
                if entry['api_id'] is not None:
                    entry['source'] = 'football-data'
                    entry['comp_code'] = comp_code
                    # Store actual team name for lookup
                    entry['fd_team_name'] = entry['api_name']
                    mapping[cid] = entry

    # Save mapping
    MAPPING_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAPPING_PATH.write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False), encoding='utf-8',
    )
    total = len(mapping)
    confirmed = sum(1 for e in mapping.values() if e.get('confirmed'))
    print(f'\nMapping saved to {MAPPING_PATH.relative_to(ROOT)}')
    print(f'Total: {total} clubs, {confirmed} confirmed matches')
    print(f'Review the file and set "confirmed": true for correct matches.')


def cmd_fetch(our_clubs: dict[str, OurClub]) -> None:
    """Fetch squad data for all mapped clubs."""
    if not MAPPING_PATH.exists():
        print(f'No mapping file found. Run "discover" first.')
        sys.exit(1)

    mapping = json.loads(MAPPING_PATH.read_text())
    api_key = os.environ.get('API_FOOTBALL_KEY', '')
    fd_key = os.environ.get('FOOTBALL_DATA_KEY', '')

    fetched = 0
    cached = 0
    skipped = 0

    apif = ApiFootball(api_key) if api_key else None

    # Cache for football-data (fetches whole league at once)
    fd_league_cache: dict[str, dict[str, list[FetchedPlayer]]] = {}

    for club_id, entry in mapping.items():
        if not entry.get('api_id') and not entry.get('fd_team_name'):
            skipped += 1
            continue

        cache_path = CACHE_DIR / f'squad_{club_id}.json'
        if cache_path.exists():
            cached += 1
            continue

        source = entry.get('source', '')
        players: list[FetchedPlayer] = []

        if source == 'api-football' and apif:
            api_id = entry['api_id']
            print(f'  Fetching {club_id} (API team {api_id})...')
            players = apif.get_squad(api_id)

        elif source == 'football-data' and fd_key:
            comp = entry.get('comp_code', '')
            team_name = entry.get('fd_team_name', '')
            if comp not in fd_league_cache:
                fd = FootballData(fd_key)
                fd_league_cache[comp] = fd.get_teams_with_squads(comp)
            league_squads = fd_league_cache.get(comp, {})
            players = league_squads.get(team_name, [])

        if players:
            # Save to cache
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(
                [asdict(p) for p in players],
                indent=2, ensure_ascii=False,
            ))
            fetched += 1
        else:
            skipped += 1

    print(f'\nFetch complete: {fetched} new, {cached} cached, {skipped} skipped')



def cmd_generate(our_clubs: dict[str, OurClub]) -> None:
    """Generate .ts squad files from cached data."""
    clubs_by_league: dict[str, list[OurClub]] = defaultdict(list)
    for club in our_clubs.values():
        clubs_by_league[club.league_id].append(club)

    # Country name per league
    league_country: dict[str, str] = {}
    for club in our_clubs.values():
        league_country[club.league_id] = club.country

    # Map league_id → file stem (country name lowercase)
    league_file_stem: dict[str, str] = {}
    for league_id, country in league_country.items():
        league_file_stem[league_id] = country.lower().replace(' ', '-')

    generated_leagues: list[str] = []
    total_players = 0
    total_clubs = 0

    for league_id, clubs in sorted(clubs_by_league.items()):
        squads: dict[str, list[dict]] = {}

        for club in clubs:
            cache_path = CACHE_DIR / f'squad_{club.id}.json'

            players: list[FetchedPlayer] = []
            if cache_path.exists():
                raw = json.loads(cache_path.read_text())
                players = [FetchedPlayer(**p) for p in raw]

            if not players:
                continue

            # Assign positions
            positioned = assign_positions(players)

            # Limit to 25 players
            positioned = positioned[:25]

            # Estimate ratings
            templates: list[dict] = []
            for rank, (player, pos) in enumerate(positioned):
                ovr, pot = estimate_rating(
                    club.squad_quality, rank, len(positioned),
                    player.age, player.market_value,
                )
                entry: dict = {
                    'fn': player.first_name,
                    'ln': player.last_name,
                    'pos': pos,
                    'age': player.age,
                    'nat': player.nationality or club.country,
                    'ovr': ovr,
                }
                if pot:
                    entry['pot'] = pot
                templates.append(entry)

            squads[club.id] = templates
            total_players += len(templates)
            total_clubs += 1

        if not squads:
            continue

        # Check if file already exists (don't overwrite manually curated data)
        file_stem = league_file_stem.get(league_id, league_id)
        ts_path = SQUADS_DIR / f'{file_stem}.ts'
        if ts_path.exists():
            # Merge: only add clubs that don't already exist
            existing_text = ts_path.read_text(encoding='utf-8')
            existing_clubs = set(re.findall(r"'([^']+)':\s*\[", existing_text))
            new_clubs = {cid: sq for cid, sq in squads.items()
                         if cid not in existing_clubs}
            if not new_clubs:
                print(f'  {file_stem}.ts: all clubs already exist, skipping')
                continue
            print(f'  {file_stem}.ts: adding {len(new_clubs)} new clubs '
                  f'(keeping {len(existing_clubs)} existing)')
            # For existing files, append new clubs
            # Remove closing }; and add new entries
            text = existing_text.rstrip()
            if text.endswith('};'):
                text = text[:-2]
            for club_id in sorted(new_clubs.keys()):
                text += f"\n  '{esc(club_id)}': [\n"
                for p in new_clubs[club_id]:
                    pot_str = f", pot: {p['pot']}" if p.get('pot') else ''
                    text += (
                        f"    {{ fn: '{esc(p['fn'])}', ln: '{esc(p['ln'])}', "
                        f"pos: '{p['pos']}', age: {p['age']}, "
                        f"nat: '{esc(p['nat'])}', ovr: {p['ovr']}{pot_str} }},\n"
                    )
                text += '  ],\n'
            text += '};\n'
            ts_path.write_text(text, encoding='utf-8')
        else:
            # New file
            country = league_country.get(league_id, league_id)
            ts_content = generate_squad_ts(league_id, country, squads)
            ts_path.write_text(ts_content, encoding='utf-8')
            print(f'  Created {file_stem}.ts ({len(squads)} clubs)')

        generated_leagues.append(league_id)

    print(f'\nGeneration complete: {total_clubs} clubs, {total_players} players '
          f'across {len(generated_leagues)} leagues')


def cmd_update_index(our_clubs: dict[str, OurClub]) -> None:
    """Update squads/index.ts to import all squad files."""
    league_country: dict[str, str] = {}
    for club in our_clubs.values():
        league_country[club.league_id] = club.country
    update_index_ts(list(league_country.keys()), league_country)
    print('Done.')


def cmd_status(our_clubs: dict[str, OurClub]) -> None:
    """Show current data coverage status."""
    clubs_by_league: dict[str, list[OurClub]] = defaultdict(list)
    for club in our_clubs.values():
        clubs_by_league[club.league_id].append(club)

    league_country: dict[str, str] = {}
    for club in our_clubs.values():
        league_country[club.league_id] = club.country

    print(f"{'League':<6} {'Country':<20} {'Clubs':>5} {'Cached':>6} {'Missing':>7}")
    print('-' * 50)
    total_clubs = 0
    total_cached = 0
    for league_id in sorted(clubs_by_league.keys()):
        clubs = clubs_by_league[league_id]
        cached = sum(1 for c in clubs
                     if (CACHE_DIR / f'squad_{c.id}.json').exists())
        country = league_country.get(league_id, '?')
        print(f'{league_id:<6} {country:<20} {len(clubs):>5} {cached:>6} '
              f'{len(clubs) - cached:>7}')
        total_clubs += len(clubs)
        total_cached += cached
    print('-' * 50)
    print(f"{'TOTAL':<6} {'':<20} {total_clubs:>5} {total_cached:>6} "
          f"{total_clubs - total_cached:>7}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Fetch real squad data and generate TypeScript squad files.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        'command',
        choices=['discover', 'fetch', 'generate', 'update-index', 'status', 'all'],
        help='Command to run',
    )
    parser.add_argument(
        '--seed', type=int, default=42,
        help='Random seed for reproducible rating estimation (default: 42)',
    )
    args = parser.parse_args()
    random.seed(args.seed)

    print('Parsing league data...')
    our_clubs = parse_our_clubs()
    print(f'Found {len(our_clubs)} clubs across '
          f'{len(set(c.league_id for c in our_clubs.values()))} leagues\n')

    if args.command == 'status':
        cmd_status(our_clubs)
    elif args.command == 'discover':
        cmd_discover(our_clubs)
    elif args.command == 'fetch':
        cmd_fetch(our_clubs)
    elif args.command == 'generate':
        cmd_generate(our_clubs)
    elif args.command == 'update-index':
        cmd_update_index(our_clubs)
    elif args.command == 'all':
        cmd_discover(our_clubs)
        print('\n' + '=' * 60 + '\n')
        cmd_fetch(our_clubs)
        print('\n' + '=' * 60 + '\n')
        cmd_generate(our_clubs)
        print('\n' + '=' * 60 + '\n')
        cmd_update_index(our_clubs)


if __name__ == '__main__':
    main()
