# FC27 player database pipeline

Extracts the complete EA SPORTS FC 27 men's player database into
`data/fc27/FC27_male_players.csv` (+ `.json`), with a women's file alongside for
cross-checking.

> **Status: the pipeline is complete and tested; the dataset is not built.**
> Every host carrying FC27 data is refused by the egress policy of the
> environment this was developed in, so no FC27 rows could be downloaded. Run
> `npm run fc27:build` from a network that permits `drop-api.ea.com` and the
> CSV appears. See `docs/fc27-data-investigation.md` for the full evidence.

## Quick start

```bash
npm run fc27:discover     # probe every candidate source, write data/fc27/discovery.json
npm run fc27:build        # discover -> extract -> normalize -> validate -> compare
```

`fc27:build` is idempotent and restartable. Interrupt it and run it again: each
page of results is written to `data/fc27/raw/` as it lands and recorded in
`data/fc27/raw/_state.json`, so a resumed run re-requests only the pages that
never arrived. `--fresh` starts the pull over.

### Individual stages

| Command | Does |
|---|---|
| `npm run fc27:discover` | Probes every source in `lib/sources.mjs`, records status |
| `npm run fc27:extract` | Paginated pull → `data/fc27/raw/source_*.json` |
| `npm run fc27:normalize` | Raw → normalized CSV/JSON, split by gender, deduped |
| `npm run fc27:validate` | Quality report → `docs/fc27-data-quality.md` |
| `npm run fc27:compare` | Diff vs the FC26/FC25 baseline → `data/fc27/comparison/` |
| `npm run fc27:merge-potential` | Fill `potential` from a second source (see below) |
| `npm run fc27:export-game` | Translate to the shape `processFC26.mjs` consumes |
| `npm run fc27:fixture` | Local synthetic API for exercising the pipeline offline |

Useful flags: `--limit` (page size, EA caps at 100), `--delay` (ms between
requests, default 1000), `--max` (stop early), `--gender 0|1`, `--slug`,
`--base` (point at a different host), `--no-compare`,
`--merge-potential <csv>`, `--potential-label <label>`, `--clamp-potential`,
`--export-for-game`.

### The full build, including the optional stages

```bash
npm run fc27:build -- \
  --merge-potential FC26_20250921.csv --potential-label fc26-carryover \
  --export-for-game
```

## Where the data comes from

**EA's official ratings API** — the same JSON endpoint the EA ratings site calls
for its own filters:

```
GET https://drop-api.ea.com/rating/ea-sports-fc-27?locale=en&limit=100&offset=0
    → { "totalItems": 21000+, "items": [ … ] }
```

No authentication, no key, no scraping of rendered HTML. The season slug is
renamed by EA each year, so the extractor probes `ea-sports-fc-27`, `fc-27` and
`ea-sports-fc` in order and records which one answered instead of hardcoding it.

### Why this source

It is first-party, it paginates properly, it needs no credentials, it carries an
explicit gender field, and it includes PlayStyles and PlayStyles+. The
alternatives were investigated and rejected on the merits — WeFUT is Ultimate
Team data (the same ratings, unofficially, minus potential); CMTracker's export
UI caps at ~50 rows; SoFIFA is HTML behind Cloudflare. Full comparison table in
`docs/fc27-data-investigation.md`.

## The potential gap — read this before wiring FC27 into the game

**EA's public ratings API does not expose career-mode potential.** The game
needs it: `scripts/processFC26.mjs` writes `pot` onto every generated player,
and player development is driven by the `ovr`→`pot` gap.

So the extractor emits `potential` as an **empty cell**, with `potential_source`
empty beside it. It is never derived from `overall`, never defaulted, never
guessed.

`merge_potential.mjs` fills that column from a second source and stamps
`potential_source` on every row it touches, so the two sources are never
silently blended:

```bash
npm run fc27:merge-potential -- --from <provider.csv> --label cmtracker-fc27
```

The provider is any CSV in a baseline shape carrying `potential` — which covers
both the intended end state and the interim:

- **End state:** a CMTracker or SoFIFA **FC27** export dropped in here. That is
  real FC27 potential, and it is what you want.
- **Interim:** `--from FC26_20250921.csv`, carrying the prior season's potential
  across so career mode is functional while no FC27 potential source is
  reachable. Every such row is stamped `fc26-carryover` — **this is not FC27
  data** and the label exists so nobody can mistake it for FC27 data.

Rules the merge follows: a potential already present is never overwritten (a
real FC27 source merged first outranks a carry-over merged later); a matched
player whose provider record has no potential is left empty, not filled with a
neighbour's value; unmatched players are left untouched. `--clamp` raises a
potential that sits below `overall` and changes the stamp to
`<label>+clamped-to-overall`, because that is a judgement call rather than
source data — it is off by default.

Verified on real data: merging `FC26_20250921.csv` into 4,000 EA-shaped rows
carrying real ids fills 4,000/4,000 on the `id` tier with zero value
mismatches against the source.

### Feeding it to the game

`export_for_game.mjs` translates the EA-shaped schema into the SoFIFA-shaped
CSV that `scripts/processFC26.mjs` already reads, so FC27 data goes through the
existing community-pack build unchanged:

```bash
npm run fc27:export-game            # -> data/fc27/FC27_community_pack_input.csv
```

It renames `physical` to the game's `physic`, carries `derived_age` across as
`age`, maps PlayStyles into `player_traits`, and resolves the numeric
`league_id` — which EA does not publish — by matching league **name** against
the baseline CSV, reporting every league that fails to resolve rather than
dropping it. `goalkeeping_speed` is left empty because EA publishes no
equivalent.

Verified against real data: every column `processFC26.mjs` reads is present,
and all 42 real league names resolve to ids (the only unresolved rows are free
agents, who have no league at all).

It writes one CSV and stops — running the community-pack build over it stays a
separate, deliberate step, and nothing under `src/data/` is touched.

## How gender is determined

From EA's own `gender.label` field, present on every record. That is an explicit
first-party signal and is used in preference to any league or club heuristic —
inferring "women's league" from a competition name misfiles anyone whose club
EA lists unusually, and silently drops men.

Records with no gender at all are **not** assumed male. They go to
`FC27_unknown_gender_players.csv` and the validator reports the count. If that
file is non-empty, look at it before shipping.

## Output

```
data/fc27/
  FC27_male_players.csv          <- the deliverable
  FC27_male_players.json
  FC27_female_players.csv/.json  <- cross-check
  FC27_unknown_gender_players.*  <- only if EA sent records without a gender
  discovery.json                 <- source probe results
  last-run.json                  <- run report: counts, findings, args
  raw/source_*.json              <- untouched API responses, never rewritten
  raw/_state.json                <- restart checkpoint
  comparison/*.csv               <- new/removed/changed vs the baseline
docs/
  fc27-data-quality.md           <- generated quality report
  fc25-vs-fc27.md                <- generated comparison summary
```

UTF-8, one player per row, fixed column order, RFC4180 quoting, no index column.

### Attributes preserved

Identity (`player_id`, names) · demographics (`date_of_birth`, `derived_age`,
`nationality`, `height`, `weight`) · club and league · positions (primary,
alternates, position type, preferred foot) · `overall` · the six face stats ·
all ~35 sub-attributes across pace/shooting/passing/dribbling/defending/physical
· goalkeeping · `weak_foot`, `skill_moves` · `playstyles` and `playstyles_plus` ·
`gender` · provenance (`source`, `source_player_id`, `source_url`,
`data_version`, `scraped_at`, and the three `*_source` columns).

**Missing means missing.** An empty cell is "the source did not supply this" —
never a zero, never an estimate. Anything the pipeline computes is prefixed
`derived_` (`derived_age`, computed from `birthdate` because EA sends no age
field). Any EA stat key the schema has no slot for is passed through as
`stat_<key>` rather than dropped, and the validator reports it — so an EA rename
next season degrades into a visible extra column instead of a silent data loss.

## Validation

`npm run fc27:validate` writes `docs/fc27-data-quality.md` and **exits non-zero**
on a blocking finding. A run that completes is not a run that succeeded.

Blocking: fewer than 15,000 players (treated as a truncated extraction, not a
small database), duplicate or missing `player_id`, missing `name`/`overall`/
`position`, `overall` outside 1–99.

Advisory: an all-null potential column (expected with EA as the only source),
implausible ages, unparseable dates, a right-footed share far from the ~75%
real squads show (which is how an inverted `preferredFoot` code mapping would
surface), markup-ish club names, and unmapped stat passthroughs.

## FC25/FC26 comparison

`npm run fc27:compare` diffs against `FC26_20250921.csv` (or `--baseline fc25`).

Matching runs in descending-confidence tiers — `id`, then `name+dob`, then
`longname+dob`, then `name+club` — and **records which tier each pair used**, so
a collapsed id space shows up in the report instead of quietly degrading into
name matching. Ambiguous names (shared by more than one player on either side)
are never matched; those players are reported as new rather than resolved by
coin flip.

The id tier works because SoFIFA's `player_id` and the trailing id of an EA
ratings URL are the same id space — verified: 72.1% of FC25 ids appear in the
FC26 file, and an id-tier match resolves 2,646 of a 3,000-row cross-version
sample.

## Testing

`src/test/fc27Pipeline.test.ts` (25 tests) covers CSV round-tripping, the
never-fabricate-potential rule, derived-age labelling, PlayStyle splitting,
gender splitting including the unknown bucket, dedupe, the match-tier
preference and ambiguous-name refusal, the validator's blocking/advisory split,
every merge rule above, and the game export's column contract and league
resolution.

The network path is exercised separately against `fc27:fixture`, a local server
serving synthetic records:

```bash
npm run fc27:fixture &
node scripts/fc27/extract_fc27.mjs --base http://127.0.0.1:8791/rating \
  --raw-dir /tmp/fc27/raw --limit 100 --delay 0 --max 200   # partial run
node scripts/fc27/extract_fc27.mjs --base http://127.0.0.1:8791/rating \
  --raw-dir /tmp/fc27/raw --limit 100 --delay 0             # resumes
node scripts/fc27/normalize_fc27.mjs --raw-dir /tmp/fc27/raw --out-dir /tmp/fc27/out
```

The fixture's players are named "Fixture Player N" on purpose. Its output is
written to a temp directory, never to `data/fc27/`, so synthetic rows can never
be mistaken for FC27 data.

## Ethics and limits

Public endpoints only, one request at a time, a 1s default delay, capped
exponential backoff that honours `Retry-After`, and **no retry at all on
401/403** — a refusal is treated as an answer. No authentication is bypassed, no
CAPTCHA defeated, no paywall circumvented, no credentials used. A `User-Agent`
is sent because EA's edge rejects requests without one; that identifies a normal
client and defeats no access control.

## Known limitations

1. **No FC27 data has been extracted yet** — the source is blocked from the
   development environment.
2. **No FC27 `potential` source is reachable.** The merge stage is built and
   verified, but it needs a provider. Until a CMTracker/SoFIFA FC27 export
   exists, the only available provider is the prior season's file, and rows
   filled from it are carry-overs, not FC27 values.
3. **No `value` / `wage` / `release_clause` / `contract_until`** — not in the EA
   ratings payload; they live in UT and career sources.
4. **`preferredFoot` numeric mapping (1=Right, 2=Left)** is the community
   convention and is unverified against FC27. The validator's foot-split check
   is what will catch it if EA changed the codes.
5. **The 21,000+ figure is EA's reported number, not a measured one** — it
   spans men's and women's databases, so the men's file will be smaller.
6. **The game conversion is built but not applied.** `fc27:export-game`
   produces the input file; actually rebuilding the community pack from it is
   your call to make. No production data under `src/data/` was touched.

## Regenerating

```bash
npm run fc27:build            # full rebuild, resumes if interrupted
npm run fc27:build -- --fresh # discard the checkpoint and re-pull from offset 0
```
