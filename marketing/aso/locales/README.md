# App Store localization kit — 37 locales

> **2026-07-29 — season refresh.** The World Cup 2026 window closed on
> 19 July 2026. All 37 locales are pivoted onto the 2026-27 club season in the
> four **indexed** fields — App Name, Subtitle, Promotional Text, Keywords —
> and `validate-locales.mjs` passes clean with no expired-campaign tokens.
> Strategy and sources: `../RESEARCH-2026.md`. en-US paste-ready set:
> `../season-2026-refresh.md` (NOT `../wc-2026-refresh.md`, which is the
> superseded tournament set, kept only for the next tournament window).
>
> **Residue check 2026-08-23:** the tournament copy the 2026-07-29 notice
> flagged in What's New / description tails has been re-scanned — all eight
> locales' consumer-visible fields are clean; the one live mark left
> ("Modo Copa 2026" in the pt-BR description) is now fixed. Remaining
> tournament mentions in these files are rationale prose only, which never
> ships. Keyword fields for the four English locales were rebuilt against
> measured Semrush volume on 2026-08-23 — see `../RESEARCH-2026.md` §0.5.

> Paste-ready App Store Connect metadata for every football-relevant storefront,
> transcreated (not translated) by native-market passes and machine-validated
> against Apple's limits (name/subtitle ≤30, promo ≤170, keywords ≤100,
> description ≤4000; no space after commas; no App-Name/Subtitle words repeated
> in keywords; no competitor, league, club, or player names anywhere).
> en-US lives in `../season-2026-refresh.md`.

## Rollout order (do the top tier first)

| Tier | Locales | Why |
|---|---|---|
| **1 — this week** | es-MX, es-ES, pt-BR, de-DE, fr-FR, it, tr, id, en-GB | Biggest football-game download markets; es-MX also indexes in the **US** storefront, widening US keyword coverage for free |
| 2 | ja, ko, ar-SA, pl, nl-NL, vi, th, ru | Large stores, strong football-game demand |
| 3 | pt-PT, fr-CA, en-AU, en-CA, ro, el, cs, hu, sv, da, no, fi | Meaningful volume, low effort — paste-ready |
| 4 | uk, hr, sk, he, ms, hi, zh-Hans, zh-Hant | Completeness; zh-Hans mainly serves SG + overseas Simplified users (no mainland game license) |

## How to apply (App Store Connect)

1. **No build needed:** Subtitle, Promotional Text, and Keywords are editable
   any time — set Tier 1 today; the 2026-27 season window is open now and the
   summer transfer window closes 1 September.
2. **Needs a version submission:** App Name, Description, What's New — batch
   them into the next release.
3. Add each locale under *App Information → Localizations*, then paste the
   fields from the matching file here. The `[n/limit]` counts are pre-verified.
4. **Cross-locale indexing:** on several storefronts Apple indexes TWO locales'
   keyword fields (US: en-US + es-MX · Canada: en-CA + fr-CA). UK/IE serves
   **en-GB only**, falling back to en-US — never to en-AU, so do not tune en-AU
   for UK coverage. The files are written so paired fields COMPLEMENT rather
   than duplicate each other — don't "fix" apparent gaps by copying terms
   between them.
5. **In-app language note:** the game itself is English-only for now. That is
   fine for store metadata (players in these markets largely play football
   games in English), but expect the biggest conversion lift in Tier-1 markets
   once the app UI is localized — that is the v1.3+ i18n track in `GOALS.md`.

## Search-volume caveat (honest)

These keyword fields are optimized from native football-market knowledge and
character-limit maximization — **not** from live search-volume data (no ASO
tool is wired into this repo). Before spending on Apple Search Ads, sanity-check
the Tier-1 keyword fields against the *Search Popularity* score in ASA's
keyword planner and swap any dud terms; everything else (titles, subtitles,
copy) stands on its own.

## Regeneration

The per-locale validator lives next to this file
(`../validate-locales.mjs`, run `node marketing/aso/validate-locales.mjs` — it parses the backticked fields and enforces every rule
above). If you edit a file by hand, keep the structure intact: `## Field
[n/limit]` heading followed by the single backticked value line.
