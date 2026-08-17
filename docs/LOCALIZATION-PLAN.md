# Localisation plan — Dynasty Manager

> Authored 2026-08-17. Scope: translating the **in-app** experience. The App
> Store listing is a separate, already-populated surface (`marketing/aso/locales/`
> has 38 locale files); this document is about what the player sees after they
> install.

## Where we actually stand

Verified against the code, not assumed:

| Fact | Value |
|---|---|
| i18n runtime | `src/i18n/index.ts` — hand-rolled, no dependency, ~40 lines |
| Translation keys in English | **272** (`src/i18n/locales/en.ts`) |
| Locales present | `en` (source of truth, always loaded), `sv` (**76 keys = 28%**) |
| Loading | Non-English locales are lazy chunks; only the active one is fetched |
| Missing-key behaviour | Falls back to English — never shows a raw key |
| Language picker | **Does not exist.** `setLocale` has no caller outside tests |
| Coverage gate | `npm run i18n:check` reports 0 hardcoded strings |

Three things follow from this, and they shape the whole plan:

1. **The engineering is done.** Lazy loading, fallback, and a re-render
   subscription all exist and work. Adding a language is adding a data file.
2. **272 keys is a small, tractable corpus** — roughly 2,000–2,500 words. This
   is one translator-day per language, not a project.
3. **Nobody can reach any of it.** Shipping languages requires a picker and
   device-locale detection first. That is Phase 0 and it blocks everything.

### One caveat to verify before trusting "272 keys = the whole app"

`scripts/check-i18n-coverage.mjs` scans **`src/pages` and `src/components/game`
only** (`SCAN` at line 29). Strings in `src/components/` (root), `src/store/`
messages, `src/data/` (press-conference questions, storylines, board pitches)
and toast text raised from slices are **outside the scanner's scope**, so "0
hardcoded strings" is a statement about two directories, not about the app.

**Phase 0 includes widening that scan and re-counting.** The corpus may be
larger than 272 — in-game *narrative* content (press questions, storyline
chains, board pitches) is authored English prose and is plausibly the largest
untranslated body of text in the product. Decide deliberately whether narrative
is in scope per language (see "Content tiers" below).

---

## Content tiers — decide this per language, once

Not all text is equally worth translating. Three tiers, cheapest first:

| Tier | What | Size | Verdict |
|---|---|---|---|
| **T1 — UI chrome** | Menus, buttons, labels, settings, screen titles, empty states | ~272 keys | **Always translate.** This is what makes the app feel native. |
| **T2 — System messages** | Board messages, transfer notifications, injury/contract alerts, toasts | Needs counting in Phase 0 | **Translate for Tier-A languages.** High frequency, high visibility. |
| **T3 — Narrative** | Press-conference questions/answers, storyline chains, board pitches, commentary | Large (`pressConferences.ts` alone is ~830 LOC of authored prose) | **Defer.** Highest cost, lowest per-word value, and machine translation reads worst here. Revisit only if a market performs. |

Never translate: club names, player names, league names, competition names,
position codes. These are proper nouns that football fans expect in the
original — a Spanish player wants "Manchester City", not "Ciudad de Manchester".
The match engine, `src/config/`, and anything written into save data stay
English by design (already documented in `src/i18n/index.ts`).

---

## Language selection — the shortlist and the reasoning

Chosen on three axes: **football culture** (does this market care about club
football?), **iOS revenue** (can it pay back?), and **presence in the game** (do
we already ship their leagues?). Dynasty Manager ships 45 leagues across 37
countries, which is the fairest guide to where the audience already is.

### Tier A — ship first (4 languages)

| Language | Locale | Why | In-game leagues |
|---|---|---|---|
| **Spanish** | `es-ES` + `es-419` | Largest football-speaking population on earth; Spain plus all of Latin America. One translation, two storefront variants. | Spain (2 tiers), Argentina, Mexico, Chile, Colombia |
| **Portuguese (Brazil)** | `pt-BR` | The most football-obsessed large market in the world; huge iOS install base. Lower ARPU, enormous volume — ideal for a game with IAP breadth. | Brazil, Portugal |
| **German** | `de-DE` | Highest-ARPU European football market; Bundesliga culture; management sims historically over-index here. | Germany (3 tiers), Austria, Switzerland |
| **French** | `fr-FR` | France plus francophone Belgium, Switzerland, Canada and West Africa. | France (2 tiers), Belgium |

Rationale for stopping at four: each additional language adds a permanent
maintenance tax on every future string. Four covers the majority of the
addressable non-English football audience and all four are LTR Latin script,
so **zero new layout work**.

### Tier B — add after Tier A proves out (3 languages)

| Language | Locale | Why | Watch out for |
|---|---|---|---|
| **Italian** | `it-IT` | Serie A; tactically-minded audience that over-indexes on management games. | Long compound words; check 375px |
| **Turkish** | `tr-TR` | Among the most football-obsessed markets anywhere; very large mobile base. | Low ARPU; **dotted/dotless i** breaks naive `toLowerCase()` |
| **Korean** | `ko-KR` | High ARPU, strong football-sim and squad-building culture. | CJK line breaking; needs a real font check |

### Tier C — only on evidence (3 languages)

| Language | Locale | Why | Cost |
|---|---|---|---|
| **Japanese** | `ja-JP` | Very high ARPU; genuine football-sim following. | CJK typography; text expansion is *negative* (shorter) which breaks some layouts the other way |
| **Arabic** | `ar-SA` | Saudi Pro League ships in-game; Gulf ARPU is high. | **RTL** — a genuine engineering project, not a data file. Mirror layouts, icon direction, number formatting |
| **Indonesian** | `id-ID` | Massive football following, huge iOS-adjacent mobile base. | Very low ARPU; justify on volume only |

**Deliberately excluded** despite appearing in the ASO locale set: Nordic
languages (including the existing `sv` — small markets with near-universal
English fluency), Dutch, Polish, Czech, Greek, Hebrew, Hindi. Strong football
cultures in several cases, but each fails the revenue-per-maintenance test for
an in-app translation.

### What to do with the existing Swedish file

`sv.ts` is 76 of 272 keys and Sweden is not on the shortlist. **Either** finish
it to 100% and keep it as a proof that a second locale works, **or** delete it.
Do not ship it at 28%: with English fallback a Swedish player sees a screen that
is half Swedish and half English, which reads as broken rather than as
partially translated. This is the one decision this plan cannot make for you.

---

## Phase 0 — make languages reachable (blocks everything)

Nothing ships until this is done. Estimated 1–2 days.

1. **Widen the coverage scanner.** Extend `SCAN` in
   `scripts/check-i18n-coverage.mjs` beyond `src/pages` + `src/components/game`
   to cover `src/components/**`, and add a separate report for `src/store/**`
   and `src/data/**` so the T2/T3 corpus is *counted* even if not yet migrated.
   Re-run and record the real totals per tier.
2. **Add the language picker.** A Settings row listing available locales, with
   the key `settings.language`. Must live in the same section as other display
   settings.
3. **Detect the device locale on first launch.** Map the platform locale to the
   nearest supported one, fall back to English, and let the picker override.
4. **Persist the choice** through `src/store/helpers/persistence.ts` with a new
   `STORAGE_KEYS` entry — device-global, not per-save-slot (a language is a
   property of the person, not the career).
5. **Add a pseudo-locale** (`en-XA`) that renders every key as `[!!Ëñglïsh
   Strïñg!!]`. This is the single highest-value QA tool: it exposes both
   untranslated strings and layouts that break under ~35% text expansion,
   without needing a single real translation.
6. **Widen the type.** `Locale` is currently `'en' | 'sv'`; make adding a locale
   a one-line change with a registry rather than three edits.

**Done when:** a tester can switch to the pseudo-locale in Settings, see every
screen expand, and the choice survives an app restart.

---

## Per-language pipeline — the same eight steps every time

Run this identically for each language. It is deliberately boring.

| # | Step | Owner | Notes |
|---|---|---|---|
| 1 | **Freeze the key set** | Eng | Translate against a tagged commit. A moving corpus is why localisation projects stall. |
| 2 | **Export** `en.ts` → translator format | Eng | Include a *context note* per key (screen, character limit). "Draw" is a scoreline, a cup draw, and a verb. |
| 3 | **Translate T1** (272 keys) | Native speaker | ~1 day. Must be a football fan — the domain vocabulary is the whole job. |
| 4 | **Football-terminology review** | Native speaker | Separate pass. "Clean sheet", "own goal", "loan spell", "sell-on clause", "matchday" all have established local terms that a generalist translator will get wrong. |
| 5 | **Import** as `src/i18n/locales/<code>.ts` | Eng | Register in the loader; verify the lazy chunk does not enter the eager bundle (`npm run size:check`). |
| 6 | **Layout QA at 375px** | Eng/QA | Every screen. German and Finnish expand longest; check nav labels, buttons, table headers, stat tiles. |
| 7 | **Release-note + store metadata** | Marketing | `marketing/aso/locales/<code>.md` already exists for most — align in-app tone with it. |
| 8 | **Ship + measure** | — | Track installs, D1/D7 retention and conversion per storefront for one full month before starting the next language. |

**Quality bar:** machine translation is acceptable for a *first draft of T1
only*, and only when a native speaker does step 4. It is not acceptable for T2
or T3 — a mistranslated board ultimatum or contract message damages trust at
exactly the moment the player is deciding whether to keep playing.

---

## Phase plan

### Phase 1 — Spanish + Portuguese (Brazil)
The two largest football audiences, and together they roughly double the
addressable market. Do both at once: they share a pipeline shakedown, and
running two languages through it immediately surfaces anything Phase 0 missed.

- Scope: **T1 + T2**
- Exit criteria: both locales at 100% of T1, layout QA clean at 375px, install
  and retention deltas measured for one month per storefront.

### Phase 2 — German + French
Highest-ARPU European markets. By now the pipeline is proven, so this is
throughput, not discovery.

- Scope: **T1 + T2**
- Exit criteria: as Phase 1. Additionally decide, on Phase 1 data, whether T3
  narrative translation is ever worth funding.

### Phase 3 — Italian, Turkish, Korean
Tier B. Gate on Phase 1+2 showing a real lift; if translated storefronts did not
move installs or retention, **stop here and bank the maintenance saving**.

- Scope: **T1 + T2**
- Turkish needs an explicit check for the dotted/dotless-i casing hazard.
- Korean needs a font and line-breaking pass.

### Phase 4 — Japanese, Arabic, Indonesian
Tier C, each with its own engineering cost. **Arabic must be scoped as a
separate RTL project**, not as a translation — mirrored layouts, directional
icons, and numeral formatting touch every screen and are not covered by any of
the above.

---

## Ongoing discipline (the part that decides whether this rots)

- **New strings are English-only until the next translation drop.** Fallback
  makes this safe; pretending otherwise makes it fragile.
- **Add a coverage gate to CI**: fail if a *shipped* locale drops below a
  threshold (say 95%) of the English key set. Without this, every feature PR
  silently degrades every language. This is the single most important item in
  this document.
- **Batch translation drops** to once per release train, not per PR.
- **Never let a locale ship below 100% of T1.** The `sv` situation is what that
  looks like.

## Cost summary

| Phase | Languages | T1 words | Rough translation effort |
|---|---|---|---|
| 0 | — (engineering) | — | 1–2 dev days |
| 1 | es, pt-BR | ~2,400 each | 2 translator-days + 1 review-day each |
| 2 | de, fr | ~2,400 each | same |
| 3 | it, tr, ko | ~2,400 each | same, plus 1 dev-day for tr/ko hazards |
| 4 | ja, id | ~2,400 each | same |
| 4 | ar | ~2,400 | **plus 5–10 dev-days for RTL** |

T2 sizing is unknown until Phase 0 counts it — that count is the first
deliverable, and it should be done before committing to Phase 1 scope.
