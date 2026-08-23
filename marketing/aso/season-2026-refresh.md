# App Store ASO — 2026-27 season window (en-US primary)

> **Paste-ready** App Store Connect metadata. App Store id **6760918006**.
> Every field is char-counted against Apple's limit `[n/limit]` and verified by
> `node marketing/aso/validate-locales.mjs`.
>
> **Replaces `wc-2026-refresh.md`**, which is built around World Cup 2026 — a
> tournament that ended 19 July 2026. Keep that file for the archive and for
> the next tournament window; do not ship from it.
>
> **Window:** 2026-27 club season. European leagues kick off through August;
> the summer transfer window closes 1 September. Intent shifts from "watch a
> tournament" to "run my club for a season" — which is what this app is.
>
> **Positioning:** search real estate goes to category head terms; the wedge —
> *no energy timers, no rest packs, full depth without a subscription* — goes
> where it changes the install decision (promo text, first screenshot,
> description opener). Nobody searches "no energy timers".
>
> **Claims verified against the build** (`src/config/monetization.ts`,
> `src/data/leagues/`): free to download with Pro + cosmetic/consumable packs
> as IAP; no energy or stamina timers; 45 leagues, 37 countries, 756 clubs; 51
> national teams. We say **"Free to download"**, never "completely free".
>
> **Competitors are never named** (Guideline 2.3.7). No club, league or player
> names in store metadata either, even though the game ships real club data.

---

## Ship order

| # | Field | Needs a build? | Do it |
|---|---|---|---|
| 1 | Subtitle, Promotional Text, Keywords | **No** — editable any time | Today |
| 2 | Screenshot set (captions are indexed) | No — via Asset Library | Today |
| 3 | Custom product pages + in-app events | No | This week |
| 4 | App Name, Description, What's New | **Yes** — version submission | Next release |

---

## 🇺🇸 English (U.S.) — primary

### App Name `[30/30]` *(needs a version submission)*
```
Dynasty Manager: Soccer Career
```
Adds **career** — a real query cluster for this genre — at title weight
(~5× the same word in the subtitle). The brand string is untouched, so brand
search and recall are unaffected. **Conservative variant** if you would rather
not touch the title this cycle: keep `Dynasty Manager: Soccer` `[23/30]` and
move `career` into the keyword field — at 98/100 that means trading out
`cup,gm` (or `pack,cup`) to make room for its 7 characters + comma.

### Subtitle `[29/30]` *(no build needed)*
```
Tactics, Transfers & Trophies
```
Three fresh indexed terms, reads as a benefit for the Today-tab ad format
(which renders name + icon + subtitle). **A/B partner** for a CPP test:
`Deep Career Sim · No Timers` `[27/30]` — wedge-forward, fewer head terms.
Run both; subtitle is free to change.

### Keywords `[98/100]` *(no build needed; no space after commas)*
```
football,club,league,squad,sim,coach,scout,youth,lineup,penalty,wonderkid,gm,offline,pack,team,cup
```
Rebuilt 2026-08-23 against measured Semrush volume (`RESEARCH-2026.md` §0.5).
Excludes every word already in the App Name and Subtitle (`dynasty`,
`manager`, `soccer`, `career`, `tactics`, `transfers`, `trophies`) — Apple
indexes the union, so repeats are wasted characters. Singulars only. Notes:
- **Added on data:** `lineup` ("lineup builder" 4,400/mo US — the set's
  biggest miss; we ship a lineup editor + Smart Optimize), `penalty`
  ("penalty game" 1,600 + "penalty shootout game" 1,000/mo — the earlier
  "narrow query" call was wrong), `wonderkid` (1,300/mo, was captions-only),
  `gm` ("soccer gm" 590 + "general manager games" 720/mo, 2 chars), `pack`
  ("soccer pack opener" 320/mo, purchase-intent fit with the pack feature).
- **Cut on data:** `formation` (9 chars, ~140/mo — still OCR-indexed via the
  panel-03 caption "SQUAD & FORMATION"), `academy` (30/mo), `season` (~0),
  `champion` (20/mo).
- `football` is held here rather than in the title: in the US it reads as NFL
  intent in a title, but it still needs to be indexed for "football manager".
- `offline` survives unmeasured: Google web volume can't see in-store
  "offline games" browsing, which is the query this token exists for.

### Promotional Text `[168/170]` *(no build needed)*
```
New season, new dynasty. Take any of 756 real clubs from pre-season to the title — every transfer, every tactic, every minute. No energy timers. No waiting. No paywall.
```

### Description `[1765/4000]` *(needs a version submission)*
```
The 2026-27 season is kicking off. Pick a club, pick your XI, and manage every minute of it.

Dynasty Manager is a deep football management sim — a real manager's career, not a card-collecting grind. Take charge of any of 756 real clubs across 45 leagues in 37 countries, or take the top job with your country. Set the tactics, work the transfer window, and call every substitution as the match plays out minute by minute.

No energy timers. No rest packs. No waiting between sessions. Play as much as you want, whenever you want.

WHAT YOU CAN DO
- Career mode — start unknown, interview for jobs, earn contracts, win silverware, climb the ladder or get sacked
- 45 leagues, 756 real clubs — promotion, relegation and playoff drama across every tier
- Minute-by-minute matches — live commentary, half-time team talks, tactical changes and interactive penalty shootouts
- Tactics and formations — mentality, tempo, pressing, width and custom instructions
- Transfers and contracts — scout wonderkids, negotiate fees and wages, arrange loans, balance the wage bill
- Youth academy and training — grow your own stars instead of buying them
- Continental and cup runs — chase the treble across domestic cups, continental competitions and the Super Cup
- National team — take a country through qualifying and all the way to a world tournament
- Player packs — open packs and chase walkout cards
- Stadium, finances, sponsors and merchandise — run the whole club, not just the team

FREE TO DOWNLOAD
Everything above is in the free download. Dynasty Pro is optional: instant sim, advanced analytics, custom tactics, expanded press conferences, historical records and an ad-free experience. Start with a 7-day free trial, or buy it once and own it forever.

Manage your dynasty.
```
The description is **not indexed for search** on the App Store — it earns its
keep two other ways: conversion for the minority who expand it, and as the
main input to Apple's AI tag generator. That is why every feature is named
literally ("youth academy", "penalty shootouts", "promotion, relegation")
rather than described in brand voice.

### What's New blurb *(needs a version submission)*
```
New season, new dynasty. Fresh App Store look, sharper touchline AI, and a handful of match-day fixes. Still no energy timers, no rest packs, no waiting — just football.
```

### Screenshot captions (5) — **now an indexed field**

Since June 2025 Apple OCR-extracts screenshot text and treats it as metadata,
weighted toward the first three panels, and it can introduce keywords that
appear nowhere else in the listing. These are written to cover terms the
100-char keyword field cannot afford. They are the literal strings baked into
`marketing/appstore/build-hero.mjs` (`PANELS[].kicker` / `.white` + `.accent`
/ `.sub`), so the render and the store copy cannot drift apart.

| # | Kicker (indexed) | Headline | Subline (indexed) |
|---|---|---|---|
| 01 | 45 LEAGUES · 756 CLUBS | Manage any **club.** | Career mode: sign, scout, win, repeat. |
| 02 | MINUTE-BY-MINUTE MATCH DAY | Feel every **minute.** | Live commentary. Team talks. Penalty shootouts. |
| 03 | SQUAD & FORMATION | Collect gold **legends.** | Player cards, chemistry and your best XI. |
| 04 | THE TRANSFER WINDOW | Own the **market.** | Scout wonderkids. Negotiate fees and wages. |
| 05 | NATIONAL TEAM & TOURNAMENTS | Lead your **nation.** | Qualify, pick your 23, chase the trophy. |

New terms this set introduces that are in **no other field**: `match day`,
`transfer window`, `commentary`, `chemistry`, `national team`, `career mode`,
`XI`, plus `formation` (cut from the keyword field 2026-08-23, kept indexed
here by the panel-03 kicker). `penalty` and `wonderkid` moved into the
keyword field on measured volume — the captions repeating them costs nothing,
since the no-repeat rule only spans Name/Subtitle/Keywords.

> **Open item — a trademark is still visible in panel 05's device pixels.**
> The overlay copy is now generic, but the in-game screen behind it renders the
> tournament label `World Cup 1`, generated at `src/utils/international.ts:143`
> (`\`World Cup ${targetSeason}\``). That is the in-game half of
> `APP_STORE_LISTING.md` risk #4 — pre-existing and tracked, but it lands
> inside a ready-to-upload asset. Two ways to close it before uploading panel
> 05: rename the in-game tournament to a fictional equivalent (the codebase
> already uses `Champions Cup` for the continental competition, and the string
> appears across ~50 source files, so it is a real change, not a one-liner), or
> swap panel 05's hero screen for one that carries no mark and lose the
> club-and-country story. Panels 01-04 are clean either way.

---

## Custom product pages (up to 70 active, keyword-assignable)

CPPs stopped being an ads-only feature: since July 2025 each page can carry
its own organic keywords, and the cap doubled to 70 in early 2026. Minimum
viable set — each reuses the existing generator with a different panel order,
so the cost is one re-render per page:

| CPP | Assigned intent | Lead panels | Subtitle to pair |
|---|---|---|---|
| `career` | career mode / be a manager | 01, 05, 03 | Deep Career Sim · No Timers |
| `tactics` | tactics, formation, match day | 02, 03, 01 | Tactics, Transfers & Trophies |
| `transfers` | transfer market, scouting | 04, 03, 01 | Scout, Sign, Win |
| `nation` | national team, international tournaments | 05, 02, 01 | Club and Country |
| `brand` | brand search (paid defence) — no organic keywords assigned | 01, 02, 04 | Tactics, Transfers & Trophies |
| `pro` | Today-tab ad destination; depth-without-a-paywall pitch | 03, 01, 02 | Deep Career Sim · No Timers |

The first four carry assigned organic keywords and earn their keep whether or
not anything is being paid for. The last two are ad-serving pages: `brand` is
the destination for the brand-defence campaign (a brand searcher already knows
what they want — do not re-pitch, just confirm), and `pro` exists because
Today-tab ads *require* a CPP destination.

Each CPP is the landing page for the matching Apple Ads campaign — the mapping
and per-campaign bid ceilings live in `marketing/ads/apple-ads-2026-27.md` §3.
Page CVR is the binding constraint on paid spend, so a CVR gain here raises the
affordable bid on every campaign at once.

## In-app events

Free, indexed, and repeatable — two obvious ones on this calendar:

| Event | Window | Hook |
|---|---|---|
| Season Kickoff | mid-August | "Take a club from pre-season to the title" |
| Deadline Day | last week of August → 1 September | "One window. One signing. Change your season." |

## Measurement

Metadata changes are not A/B-able natively except through CPPs, so:

1. Record the baseline **before** changing anything: category rank, keyword
   ranks for the terms above, impressions → product page views → installs
   (App Analytics), and D1/D7 retention.
2. Change **subtitle + keywords + screenshots together** on day 0 — they share
   an indexing pass and separating them costs weeks for no extra signal.
3. Hold the title change for the next binary and read its effect separately,
   since title changes can briefly disturb existing rankings.
4. Re-read at +7 and +28 days. Retention is now a ranking input, so watch D7
   alongside installs — a keyword that brings volume but tanks D7 is a losing
   trade in 2026's algorithm.

## Rollback

Subtitle, promo text and keywords revert instantly with no review. The
previous World Cup values are preserved in `wc-2026-refresh.md` and in git
history for the locale files, so the tournament positioning can be restored
wholesale for the next tournament window.
