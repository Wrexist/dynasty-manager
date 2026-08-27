# FC27 player database — source investigation

> Investigated 2026-08-27 on branch `claude/fc27-player-database-rf0tz0`.
> Probe evidence: `data/fc27/discovery.json` (regenerate with `npm run fc27:discover`).

## Outcome in one line

The pipeline is built, tested and runnable — but **no FC27 data could be
downloaded from this environment**, because every source that carries FC27 data
is refused at the network layer by this session's egress policy. `npm run
fc27:build` produces the dataset on any network that permits `drop-api.ea.com`.

---

## Phase 1 — what the repo already has and expects

### Existing player data

| File | Rows | Shape | Origin |
|---|---:|---|---|
| `FC26_20250921.csv` | 18,405 | SoFIFA export schema (`player_id`, `fifa_version=26`, `potential`, 110 columns) | SoFIFA-derived community dataset |
| `fc25_players.csv` | 16,161 | EA ratings schema (`Name`, `OVR`, `play style`, `url`) | EA ratings site |

The FC26 file is the live one. It feeds `scripts/processFC26.mjs`, which emits
the generated TypeScript under `src/data/communityPack/` (`byClub.ts`,
`freeAgents.ts`, `cpLeagueSquads.ts`) plus `src/data/nationalPlayerPool.ts`.

### Fields the game actually requires

From `scripts/processFC26.mjs` (`buildPlayer`, `translateOutfieldStats`,
`translateGKStats`, `deriveMental`):

- **Identity/demographics** — `player_id`, `short_name`/`long_name`, `age`,
  `nationality_name`, `height_cm`, `weight_kg`
- **Ratings** — `overall`, **`potential`**
- **Position** — `player_positions` (primary + alternates)
- **Face stats** — `pace`, `shooting`, `passing`, `dribbling`, `defending`,
  `physic`
- **GK stats** — `goalkeeping_diving|handling|kicking|positioning|reflexes`,
  `goalkeeping_speed`
- **Mental derivation inputs** — `mentality_composure`, `movement_reactions`,
  `mentality_vision`
- **Club/league** — `club_name`, `league_id`, `league_name`
- **Skill** — `skill_moves`

### The finding that shapes source selection

**The game requires `potential`, and EA's public ratings API does not have it.**
`processFC26.mjs` writes `pot: parseInt(row.potential, 10)` into every generated
player, and player development in
`src/store/helpers/development.ts` is driven by the gap between `ovr` and `pot`.
A dataset without potential cannot drive career mode.

Potential is a career-mode concept that EA does not publish on the ratings site.
It exists on SoFIFA and CMTracker — which is precisely why CMTracker came up in
the original brief. So the correct architecture is **not** "pick the single best
source": it is EA for the official base + one potential source merged on top,
with per-field provenance. The schema carries `overall_source`,
`attributes_source` and `potential_source` columns for exactly that reason, and
`potential` stays `null` rather than being back-computed from `overall`.

### Other Phase 1 answers

- **Male-only?** Yes in effect — the game ships men's clubs and men's leagues
  only, and the FC26 file is a men's export. The pipeline still extracts both
  and splits, so the women's set exists as a validation cross-check.
- **Are FC25 ids used elsewhere?** Not in game state. `fcId` is carried on
  generated players as a provenance stamp only.
- **Compatibility layer needed?** Yes. The normalized FC27 schema is
  EA-shaped (`overall`, `club`, `position`); `processFC26.mjs` expects
  SoFIFA-shaped column names (`overall`, `club_name`, `player_positions`,
  `physic`). Wiring FC27 into the game is a follow-up step and is deliberately
  **not** done here — no production data was touched.
- **Are the id spaces compatible?** Yes, verified: SoFIFA's `player_id` and the
  trailing id in an EA ratings URL are the same id space. 11,659 of 16,161 FC25
  ids (72.1%) appear in the FC26 file, and cross-version matching on the id tier
  resolves 2,646 of a 3,000-row sample. This is what lets the FC25↔FC27
  comparison match on stable ids instead of names.

---

## Phase 2 — source investigation

### A. EA SPORTS FC 27 (official)

FC27's full ratings database went live **21 August 2026**, reported at **21,000+
players** covering both the men's and women's databases.

The ratings site is a client-side app backed by a public JSON API — the "Drop
API" — which is what the site's own filters call:

```
GET https://drop-api.ea.com/rating/<title-slug>?locale=en&limit=100&offset=0
```

Verified characteristics, from published open-source clients of this endpoint
(`victorcmoraes/FC26-MetaEvoCalculator`, `Muhamad-Fatah/fc-pedia`,
`PabloJRW/FC25-Players-ETL`, `sauravhiremath/ea-fc25-scraper`):

| Property | Value |
|---|---|
| Auth | None |
| Response | `{ "totalItems": N, "items": [...] }` |
| Pagination | `offset`/`limit`, **limit caps at 100** |
| Gender | Explicit `gender: {id, label}` per record, plus a `gender` query filter |
| PlayStyles | `playerAbilities[]` with `type.id` of `playStyle` / `playStylePlus` |
| Attributes | `stats.<key>.value`, 40+ per-attribute values |
| Potential | **Absent** |
| Season slug | Renamed yearly (`fc-24` → `ea-sports-fc` → `ea-sports-fc-26`) |

Because the slug changes each season, `extract_fc27.mjs` probes
`ea-sports-fc-27`, `fc-27`, `ea-sports-fc` in order and records which answered
rather than hardcoding a guess.

**Reachability from this environment: BLOCKED.** `drop-api.ea.com` and
`www.ea.com` are both refused with HTTP 403 at the egress proxy's CONNECT, for
every slug. The same block applies to the Anthropic-side fetch tool, which
returns `EGRESS_BLOCKED` for the host. This is an organization egress policy,
not a rate limit and not a source-side restriction; per the proxy's own
documentation it must be reported, not worked around.

### B. WeFUT

`wefut.com` — **BLOCKED (403 at the proxy)**, so its network traffic could not be
inspected to answer "how does WeFUT get its data".

What can be said without the probe: WeFUT is an Ultimate Team database. UT data
is the same EA ratings data with UT-specific pricing on top, and it carries **no
career-mode potential**. Even fully reachable it would be strictly worse than
the official EA API for this purpose — same attributes, unofficial, no
documented bulk endpoint, no potential. It is not the right primary source.

### C. CMTracker

`cmtracker.net` — **BLOCKED (403 at the proxy)**.

```
CMTracker:
Public bulk access:      UNVERIFIED — host unreachable from this environment
Authentication required: UNVERIFIED
Useful endpoint:         none discovered; no public API documentation found
Reason usable/not usable: Cannot be probed here. Valuable because it is
                         career-mode oriented and therefore carries POTENTIAL,
                         which EA's API lacks. The ~50-row export cap in the
                         brief is a UI limit; whether a bulk endpoint sits
                         behind the UI could not be tested.
```

CMTracker remains the **best candidate for the potential merge** and should be
re-probed first from an unrestricted network.

### D. Kaggle / GitHub / Hugging Face / public datasets

- **Kaggle** (`kaggle.com`) — BLOCKED at the proxy. The long-running
  `stefanoleone992` "complete player dataset" series is the origin of the
  repo's FC26 file and would be the natural FC27 home, but it could not be
  reached or checked for an FC27 edition.
- **Hugging Face** — BLOCKED at the proxy.
- **GitHub** — **reachable**, and searched thoroughly. There is no FC27 player
  dataset on it:
  - repository search for `FC27 players dataset` → 0 results
  - repository search for `FC27` (194 hits) → all unrelated (landing pages,
    sniping bots, an eFootball cheat script); no player database
  - code search for `"ea-sports-fc-27"` / `fc-27` + `drop-api` → 0 results
  - code search for `filename:players.csv "FC 27"` → 0 results
  - the known FC26 live-database repo (`victorcmoraes/FC26-MetaEvoCalculator`)
    commits **no** CSV; it builds the file at runtime from the Drop API
  This is unsurprising: the FC27 database is six days old.
- **npm / PyPI** — reachable, and neither carries an FC27 dataset package.

---

## Phase 3 — source comparison

Counts marked *reported* come from EA's own announcement and published
third-party clients; they could not be verified here because the hosts are
blocked. Nothing in this table is presented as measured.

| Source | Player count | Male/Female | Attributes | Bulk access | Official | Reachable here | Reliability |
|---|---:|---|---|---|---|---|---|
| **EA Drop API** | 21,000+ *(reported)* | Explicit `gender` field | 40+ stats, PlayStyles & PlayStyles+; **no potential** | Yes — `offset`/`limit`, no auth | **Yes** | ❌ 403 | Highest — first-party |
| CMTracker | unknown | yes | full + **potential** | Unverified; UI caps at ~50 | No | ❌ 403 | Unverified |
| SoFIFA | ~18k *(FC26 precedent)* | yes | full + **potential** | HTML only, Cloudflare-gated | No | ❌ 403 | Good, historically the community standard |
| WeFUT | unknown | yes | UT attributes, no potential | No documented endpoint | No | ❌ 403 | Redundant vs EA |
| Kaggle | n/a | — | — | CSV, if an FC27 edition exists | No | ❌ 403 | Good but derivative |
| GitHub | **0 FC27 rows** | — | — | Raw file access works | No | ✅ | Verified empty for FC27 |
| npm / PyPI | 0 | — | — | — | No | ✅ | Verified empty for FC27 |

### Selection

1. **Primary: EA Drop API.** Official, no auth, genuine bulk pagination, an
   explicit gender field, and the full PlayStyles set. Implemented in
   `scripts/fc27/extract_fc27.mjs`.
2. **Potential merge: CMTracker, SoFIFA second.** Not implemented, because
   neither could be probed from here and implementing an extractor against an
   endpoint whose shape is unverified would be guesswork committed as code.
   The schema and provenance columns are in place for it.

WeFUT is rejected on the merits, not on reachability: it adds nothing EA does
not already provide, and lacks the one field that would justify it.

---

## What is blocked, precisely

| Host | Result | Via |
|---|---|---|
| `drop-api.ea.com` | HTTP 403 on CONNECT | curl, node fetch, Anthropic fetch tool |
| `www.ea.com` | HTTP 403 on CONNECT | curl, node fetch |
| `sofifa.com` | HTTP 403 on CONNECT | curl, node fetch |
| `cmtracker.net` | HTTP 403 on CONNECT | curl, node fetch |
| `wefut.com` | HTTP 403 on CONNECT | curl, node fetch |
| `futbin.com`, `easysbc.io`, `fctoolshub.com` | HTTP 403 on CONNECT | curl |
| `kaggle.com`, `huggingface.co` | HTTP 403 on CONNECT | curl |

Reachable: `github.com`, `raw.githubusercontent.com`, `api.github.com`,
`registry.npmjs.org`, `pypi.org`, `storage.googleapis.com`.

The egress proxy's own README states these denials must be reported rather than
retried or routed around, so no attempt was made to do either. No
authentication was bypassed, no CAPTCHA defeated, no rate limit circumvented,
and no credentials were used.
