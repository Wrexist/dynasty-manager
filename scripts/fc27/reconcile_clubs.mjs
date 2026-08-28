#!/usr/bin/env node
/**
 * Resolve every FC27 player to a club and league the GAME ships.
 *
 * Club NAMES are the least reliable thing in this data. EA writes exonyms
 * ("FC Bayern München"), abbreviations ("R. Union St.-G."), and placeholders
 * for clubs it has no licence for — Inter Milan ships as "Lombardia FC", which
 * no amount of string cleverness will ever match. So names are the LAST resort
 * here, not the first.
 *
 * Resolution runs in tiers, strongest evidence first, and every club records
 * which tier decided it so the report can be audited:
 *
 *   1. squad-fingerprint  Whose players are these? The game's own squad files
 *                         are keyed by club id, so surname overlap identifies
 *                         the club outright. Lautaro, Bastoni and Barella can
 *                         only be one team whatever the label says.
 *   2. player-vote        For each player matched to the baseline on a stable
 *                         id (gated on nationality), vote for what the
 *                         baseline calls their club; resolve that name.
 *   3. fc26-report        The validated fc26Name -> gameClubId map that
 *                         analyzeFC26 produced and processFC26 already trusts.
 *   4. exact name         Normalised name equality.
 *   5. token subset       Confined to one league, unique candidate required.
 *
 * Separately, EA omits the club entirely for whole competitions (every
 * Eredivisie player; everyone under Libertadores/Sudamericana). Those are
 * backfilled from the id-matched baseline row, but ONLY when the baseline's
 * league agrees with EA's — otherwise a player who moved abroad last summer
 * would be handed his old club.
 *
 * Anything not sourced from FC27 is stamped in `club_source`.
 *
 * Run: npx vite-node scripts/fc27/reconcile_clubs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LEAGUES, ALL_CLUBS } from '@/data/league';
import { ALL_SQUAD_TEMPLATES } from '@/data/squads';
import { cpLeagueSquads } from '@/data/communityPack/cpLeagueSquads';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { normClub } from './match_game_clubs.mjs';
import { LEAGUE_ALIASES } from './leagueAliases.mjs';
import { buildSquadIndex, fingerprintClub } from './lib/squadFingerprint.mjs';
import { sameNationality } from './lib/nationality.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FC27 = join(ROOT, 'data/fc27/FC27_male_players.csv');
const BASELINE = join(ROOT, 'FC26_20250921.csv');
const REPORT_JSON = join(ROOT, 'scripts/fc26-report.json');
const OUT_CSV = join(ROOT, 'data/fc27/FC27_male_players_reconciled.csv');
const OUT_REPORT = join(ROOT, 'data/fc27/reconciliation.json');

/** Evidence classes, strongest first — see the contested-claim sort below. */
const CLUB_TIER_RANK = {
  'squad-fingerprint': 5,
  'player-vote': 4,
  'fc26-report': 3,
  'exact-name': 2,
  'token-subset': 1,
};

const norm = (s) => normClub(s);

function gameClubIndex() {
  const byName = new Map();
  const collide = new Set();
  for (const club of ALL_CLUBS) {
    for (const key of [norm(club.name), norm(club.shortName)]) {
      if (!key) continue;
      if (byName.has(key) && byName.get(key).id !== club.id) { collide.add(key); continue; }
      byName.set(key, club);
    }
  }
  for (const k of collide) byName.delete(k);
  return byName;
}

function tokenSubsetMatch(eaName, candidates) {
  const want = new Set(norm(eaName).split(' ').filter(Boolean));
  if (want.size === 0) return null;
  const hits = candidates.filter((club) => {
    const have = new Set(norm(club.name).split(' ').filter(Boolean));
    if (have.size === 0) return false;
    return [...want].every((t) => have.has(t)) || [...have].every((t) => want.has(t));
  });
  return hits.length === 1 ? hits[0] : null;
}

export function main() {
  const rows = parseCsv(readFileSync(FC27, 'utf8'));
  const baseline = parseCsv(readFileSync(BASELINE, 'utf8'));
  const byId = new Map(baseline.map((b) => [String(b.player_id), b]));
  const gameByName = gameClubIndex();
  const gameById = new Map(ALL_CLUBS.map((c) => [c.id, c]));
  const squadIndex = buildSquadIndex({ ...ALL_SQUAD_TEMPLATES, ...cpLeagueSquads });

  // The validated fc26Name -> gameClubId map processFC26 already trusts.
  const report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'));
  const fc26NameToClubId = new Map();
  for (const e of [...(report.bucketA ?? []), ...(report.bucketB ?? [])]) {
    if (e.fc26Name && e.gameClubId) fc26NameToClubId.set(norm(e.fc26Name), e.gameClubId);
  }

  // ── Group the EA clubs, and vote each one's baseline counterpart ─────────
  const eaClubs = new Map(); // ea name -> { rows[], votes: Map }
  for (const row of rows) {
    const ea = (row.club ?? '').trim();
    if (!ea) continue;
    if (!eaClubs.has(ea)) eaClubs.set(ea, { rows: [], votes: new Map() });
    const entry = eaClubs.get(ea);
    entry.rows.push(row);
    const base = byId.get(String(row.player_id));
    // Fold nationality aliases before comparing: EA writes "Holland" where the
    // baseline writes "Netherlands". Comparing raw labels discarded 461
    // perfectly good votes — 408 Dutch, 239 Turkish, 88 Czech — as if the two
    // sources disagreed about who the player was.
    if (!base || !sameNationality(row.nationality, base.nationality_name)) continue;
    const bc = (base.club_name ?? '').trim();
    if (bc) entry.votes.set(bc, (entry.votes.get(bc) ?? 0) + 1);
  }

  /** ea club name -> { club, tier } */
  const resolvedClub = new Map();
  const tierCounts = {};
  const unresolvedClubs = [];
  const rejectedCrossCountry = [];
  const leagueCountry = new Map(LEAGUES.map((l) => [l.id, l.country]));

  for (const [ea, entry] of eaClubs) {
    let club = null;
    let tier = null;
    let evidence = 0;

    // 1. squad fingerprint, with a country guard.
    //
    // The game's league structure is a season behind FC27, so a fingerprint
    // landing in a different DIVISION than EA states is usually correct — it
    // is a club that was promoted or relegated (Ipswich, Southampton, Wrexham,
    // Luton). A fingerprint landing in a different COUNTRY never is: that is
    // how "Red Star FC" of Paris matched Red Star Belgrade, and Laval matched
    // Slavia Sofia, on a handful of coincidental surnames.
    const fp = fingerprintClub(entry.rows.map((r) => r.last_name), squadIndex);
    if (fp && gameById.has(fp.clubId)) {
      const candidate = gameById.get(fp.clubId);
      const eaLeagueId = LEAGUE_ALIASES[(entry.rows[0].league ?? '').trim()] ?? null;
      const eaCountry = eaLeagueId ? leagueCountry.get(eaLeagueId) : null;
      const sameCountry = !eaCountry || eaCountry === leagueCountry.get(candidate.divisionId);
      if (sameCountry) { club = candidate; tier = 'squad-fingerprint'; evidence = fp.overlap; }
      else { rejectedCrossCountry.push({ eaClub: ea, matched: candidate.name, overlap: fp.overlap }); }
    }

    // 2. player vote -> baseline name -> game club
    if (!club && entry.votes.size) {
      const [winner, wv] = [...entry.votes.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...entry.votes.values()].reduce((a, b) => a + b, 0);
      if (wv / total >= 0.5) {
        const hit = gameByName.get(norm(winner)) ?? gameById.get(fc26NameToClubId.get(norm(winner)));
        if (hit) { club = hit; tier = 'player-vote'; }
      }
    }

    // 3. the validated fc26 report map, on EA's own name
    if (!club) {
      const id = fc26NameToClubId.get(norm(ea));
      if (id && gameById.has(id)) { club = gameById.get(id); tier = 'fc26-report'; }
    }

    // 4. exact normalised name
    if (!club) {
      const hit = gameByName.get(norm(ea));
      if (hit) { club = hit; tier = 'exact-name'; }
    }

    // 5. token subset, inside the league EA names
    if (!club) {
      const leagueId = LEAGUE_ALIASES[(entry.rows[0].league ?? '').trim()] ?? null;
      if (leagueId) {
        const hit = tokenSubsetMatch(ea, ALL_CLUBS.filter((c) => c.divisionId === leagueId));
        if (hit) { club = hit; tier = 'token-subset'; }
      }
    }

    if (club) {
      resolvedClub.set(ea, { club, tier, evidence });
    } else {
      unresolvedClubs.push({ eaClub: ea, players: entry.rows.length, league: entry.rows[0].league ?? '' });
    }
  }

  // ── One game club, one claimant ─────────────────────────────────────────
  //
  // A game club can only be one EA club. Without this, "Atl. Nacional"
  // (Colombian, filed by EA under Libertadores where no country is known, so
  // the country guard cannot fire) landed on Tigre alongside the real Tigre,
  // giving it a 60-man squad; HamKam did the same to Brann. When two EA clubs
  // claim one game club, the stronger fingerprint keeps it and the other is
  // dropped rather than silently merged.
  const claims = new Map();
  for (const [ea, r] of resolvedClub) {
    if (!claims.has(r.club.id)) claims.set(r.club.id, []);
    claims.get(r.club.id).push({ ea, ...r });
  }
  const contested = [];
  for (const [clubId, list] of claims) {
    if (list.length < 2) continue;
    // `evidence` is only ever set on the squad-fingerprint tier, so sorting on
    // it alone left every other contest a tie — and a tie resolved by Map
    // insertion order, i.e. by the order EA happened to list the clubs in the
    // CSV. The loser's entire squad then falls to `unresolved`, so which real
    // players make it into the game was decided by row order. Rank by how
    // strong the evidence CLASS is first, then by its magnitude, then by name
    // so the outcome is reproducible run to run.
    list.sort((a, b) =>
      (CLUB_TIER_RANK[b.tier] ?? 0) - (CLUB_TIER_RANK[a.tier] ?? 0)
      || b.evidence - a.evidence
      || String(a.ea).localeCompare(String(b.ea)));
    const [winner, ...losers] = list;
    for (const l of losers) resolvedClub.delete(l.ea);
    contested.push({
      gameClubId: clubId,
      // `basis` records WHY this claimant survived, so the report explains the
      // decision instead of just naming it.
      basis: (CLUB_TIER_RANK[winner.tier] ?? 0) > (CLUB_TIER_RANK[losers[0].tier] ?? 0)
        ? 'tier'
        : winner.evidence !== losers[0].evidence ? 'evidence' : 'name-order',
      kept: { eaClub: winner.ea, tier: winner.tier, evidence: winner.evidence },
      dropped: losers.map((l) => ({ eaClub: l.ea, tier: l.tier, evidence: l.evidence })),
    });
  }

  for (const r of resolvedClub.values()) tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;

  // ── Apply to every player ───────────────────────────────────────────────
  const stats = { fromEaClub: 0, backfilled: 0, backfillRefused: 0, unresolved: 0 };

  for (const row of rows) {
    row.game_club_id = '';
    row.game_club_name = '';
    row.game_league_id = '';
    row.club_source = '';

    const ea = (row.club ?? '').trim();
    if (ea) {
      const club = resolvedClub.get(ea)?.club;
      if (club) {
        Object.assign(row, {
          game_club_id: club.id, game_club_name: club.name,
          game_league_id: club.divisionId, club_source: 'fc27',
        });
        stats.fromEaClub += 1;
      } else {
        stats.unresolved += 1;
      }
      continue;
    }

    // EA gave no club: borrow the baseline's, if the leagues agree.
    const base = byId.get(String(row.player_id));
    const baseClub = (base?.club_name ?? '').trim();
    if (!baseClub) { stats.unresolved += 1; continue; }

    const club = gameByName.get(norm(baseClub)) ?? gameById.get(fc26NameToClubId.get(norm(baseClub)));
    if (!club) { stats.unresolved += 1; continue; }

    const eaLeagueId = LEAGUE_ALIASES[(row.league ?? '').trim()] ?? null;
    if (eaLeagueId !== null && club.divisionId !== eaLeagueId) {
      stats.backfillRefused += 1; stats.unresolved += 1; continue;
    }

    Object.assign(row, {
      game_club_id: club.id, game_club_name: club.name,
      game_league_id: club.divisionId, club_source: 'fc26-backfill',
    });
    stats.backfilled += 1;
  }

  writeFileSync(OUT_CSV, toCsv([...new Set(rows.flatMap((r) => Object.keys(r)))], rows), 'utf8');

  const covered = new Map();
  for (const r of rows) {
    if (!r.game_league_id) continue;
    if (!covered.has(r.game_league_id)) covered.set(r.game_league_id, new Set());
    covered.get(r.game_league_id).add(r.game_club_id);
  }
  const leagueCoverage = LEAGUES.map((l) => {
    const gameClubs = ALL_CLUBS.filter((c) => c.divisionId === l.id).length;
    const clubsMatched = covered.get(l.id)?.size ?? 0;
    return {
      id: l.id, name: l.name, country: l.country, gameClubs, clubsMatched,
      pct: gameClubs ? +(100 * clubsMatched / gameClubs).toFixed(0) : 0,
      players: rows.filter((r) => r.game_league_id === l.id).length,
    };
  }).sort((a, b) => a.pct - b.pct);

  const resolved = stats.fromEaClub + stats.backfilled;
  const out = {
    generatedAt: new Date().toISOString(),
    ...stats,
    resolved,
    resolvedPct: +(100 * resolved / rows.length).toFixed(1),
    clubResolutionTiers: tierCounts,
    fingerprintRejectedCrossCountry: rejectedCrossCountry,
    contestedGameClubs: contested,
    unresolvedClubs: unresolvedClubs.sort((a, b) => b.players - a.players),
    gameClubsCovered: new Set(rows.map((r) => r.game_club_id).filter(Boolean)).size,
    gameClubsTotal: ALL_CLUBS.length,
    leagueCoverage,
  };
  mkdirSync(dirname(OUT_REPORT), { recursive: true });
  writeFileSync(OUT_REPORT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log(`resolved ${resolved}/${rows.length} (${out.resolvedPct}%)`);
  console.log(`  from EA's club field: ${stats.fromEaClub}   backfilled: ${stats.backfilled}   refused: ${stats.backfillRefused}   unresolved: ${stats.unresolved}`);
  console.log(`club resolution by tier: ${JSON.stringify(tierCounts)}`);
  if (rejectedCrossCountry.length) {
    console.log(`fingerprints rejected for crossing a country border: ${rejectedCrossCountry.length}`);
    for (const r of rejectedCrossCountry) console.log(`  ${r.eaClub} !-> ${r.matched} (overlap ${r.overlap})`);
  }
  if (contested.length) {
    console.log(`contested game clubs resolved to one claimant: ${contested.length}`);
    for (const c of contested) console.log(`  ${c.gameClubId}: kept "${c.kept.eaClub}" (${c.kept.evidence}), dropped ${c.dropped.map((d) => `"${d.eaClub}" (${d.evidence})`).join(', ')}`);
  }
  console.log(`game clubs covered: ${out.gameClubsCovered}/${out.gameClubsTotal}`);
  console.log(`\nleagues below 100%:`);
  for (const l of leagueCoverage.filter((l) => l.pct < 100)) {
    console.log(`  ${String(l.pct).padStart(4)}%  ${String(l.clubsMatched).padStart(2)}/${String(l.gameClubs).padEnd(2)}  ${l.name} (${l.country})`);
  }
  console.log(`\nunresolved EA clubs: ${unresolvedClubs.length}`);
  for (const c of unresolvedClubs.slice(0, 10)) console.log(`  ${String(c.players).padStart(3)}  ${c.eaClub}  [${c.league}]`);
  return out;
}

// Run unconditionally: this is a CLI stage and nothing imports it. The
// import.meta.url / argv[1] guard does not hold under vite-node, which is
// required here to resolve the '@/' alias and the TS league + squad data.
main();
