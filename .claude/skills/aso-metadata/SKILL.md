---
name: aso-metadata
description: Write, refresh or audit App Store Connect metadata for Dynasty Manager — app name, subtitle, keyword field, promotional text, description, what's-new and screenshot captions, in any of the 37 locales. Use when the task mentions ASO, App Store metadata, keywords, subtitle, store listing, storefront localization, search ranking, or a seasonal store refresh.
---

# App Store metadata (ASO)

The kit lives in `marketing/aso/`. Read `RESEARCH-2026.md` first — it carries
the indexed-field map, the 2025-26 algorithm changes and the sources. Do not
re-derive ranking theory from memory; that file is the project's position.

## Non-negotiable rules

1. **Every field is char-limited and machine-checked.** App Name ≤30, Subtitle
   ≤30, Promotional Text ≤170, Keywords ≤100, Description ≤4000, exactly 5
   screenshot captions. Never hand-count — run:
   ```bash
   node marketing/aso/validate-locales.mjs              # check
   node marketing/aso/validate-locales.mjs --fix-counts # restamp [n/limit]
   ```
   The validator must exit 0 before you hand anything over.
2. **Keyword field mechanics.** Comma-separated, **no space after a comma**
   (a space costs a character). Singular only — Apple matches plurals. No stop
   words. **Never repeat a word from the App Name or Subtitle** — Apple indexes
   the union, so a repeat is a wasted character (the validator fails on this).
   No category name. Apple builds phrases by combining tokens across fields, so
   `soccer` in the title plus `club` in keywords already covers "soccer club".
3. **No trademarks, ever** (Guideline 2.3.7 + `APP_STORE_LISTING.md` risk #4):
   no competitor app names, no real club/league/player names, and no
   tournament marks ("World Cup", "Copa América", "AFCON", …) in listing copy —
   use a generic descriptor ("world tournament", "national team"). The
   in-game mode names are a separate, tracked IP item; do not conflate them.
   The validator fails on tournament marks in consumer-visible fields.
4. **Claims must match the build.** Check `src/config/monetization.ts` before
   writing anything about price, trial or Pro; check `src/data/leagues/` for
   league/club/country counts. Say "Free to download", never "completely free".
5. **Seasonal copy expires.** Anything anchored to a tournament or window goes
   in `EXPIRED_CAMPAIGNS` in the validator with its end date, so the next run
   reports it instead of leaving it to rot in the highest-weighted fields.

## Which fields need a build

| No build (App Store Connect, any time) | Needs a version submission |
|---|---|
| Subtitle, Promotional Text, Keywords, screenshot set (Asset Library), custom product pages, in-app events | App Name, Description, What's New |

Always tell the user which bucket a change lands in — it decides whether it
ships today or waits for a release.

## Cross-locale indexing

Some storefronts index two locales' keyword fields — US indexes **en-US +
es-MX**, Canada indexes **en-CA + fr-CA**. Paired fields must **complement**,
never duplicate. "Fixing" an apparent gap by copying terms across a pair is a
regression.

## Working method

1. Read `RESEARCH-2026.md`, then the current locale file(s) in
   `marketing/aso/locales/`.
2. Draft, then **measure with a script**, then write. Trim to fit; never ship
   an over-limit field and never fudge the `[n/limit]` header.
3. Run the validator with `--fix-counts`.
4. Report: what changed, per field; what ships today vs. next release; and the
   rollback (subtitle/promo/keywords revert instantly, no review).

## Files

- `marketing/aso/RESEARCH-2026.md` — ranking factors, indexed fields, sources.
- `marketing/aso/season-2026-refresh.md` — current en-US paste-ready set.
- `marketing/aso/locales/*.md` — 37 storefronts, same structure each.
- `marketing/aso/validate-locales.mjs` — limits, keyword rules, trademark and
  expired-campaign guards.
- `marketing/aso/wc-2026-refresh.md` — archived tournament-window variant.
