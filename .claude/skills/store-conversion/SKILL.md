---
name: store-conversion
description: Improve App Store conversion and organic reach through the visual surfaces — screenshot sets and their (now indexed) captions, custom product pages, in-app events, and the App Store tag list. Use when the task mentions App Store screenshots, product page, custom product pages, CPP, in-app events, store conversion rate, app preview, or store tags.
---

# Store conversion surfaces

Conversion rate is a ranking input, and since 2025 two of these surfaces became
search surfaces too. Read `marketing/aso/RESEARCH-2026.md` §1 before changing
any of them.

## Screenshots are metadata now

Since **June 2025** Apple OCR-extracts screenshot text and treats it as
indexed metadata, weighted toward the **first three panels**, and it can
introduce keywords that appear nowhere else in the listing.

Consequences for this repo:

- The caption copy lives in **`marketing/appstore/build-hero.mjs`** (`PANELS[]`:
  `kicker`, `white` + `accent`, `sub`) and is mirrored in
  `marketing/aso/season-2026-refresh.md`. **Change both together** or the
  render and the store copy drift.
- Spend caption words on terms the 100-char keyword field cannot afford —
  `match day`, `penalty shootout`, `wonderkid`, `transfer window`,
  `career mode`. Do not burn them on brand-voice phrasing alone.
- Trademark rules apply to pixels as much as to text fields: no tournament
  marks, club, league or player names baked into an uploaded PNG
  (`APP_STORE_LISTING.md` risk #4).

Two generators exist:

```bash
node marketing/appstore/build-hero.mjs           # layered hero-cluster set, all 3 sizes
node marketing/appstore/build-hero.mjs ipad-13   # one size (~2 min each)
node marketing/appstore/build.mjs                # single-device 3D set (legacy)
```

Sizes rendered: iPhone 6.9" 1290×2796, iPhone 6.5" 1242×2688, iPad 13"
2064×2752. Layout is expressed as **fractions of the canvas** (`PROPS.phone` /
`PROPS.tablet`) — change a fraction, not a pixel, so all sizes move together.
On-device pixels must stay the verbatim real game, cropped from
`docs/ingame/*.png` with the shared `CROP` rect. No mockups.

## Custom product pages

Up to **70 active pages** (doubled from 35 in early 2026), each able to carry
its **own organic keywords** since July 2025 — so a CPP is a long-tail search
asset, not just an ads landing page. One page per intent cluster, each with a
screenshot order that matches the query, each the destination for the matching
Apple Ads campaign. Today-tab ads *require* a CPP destination. The planned set
is in `marketing/aso/season-2026-refresh.md` §Custom product pages.

## In-app events

Free, indexed, repeatable. Tie them to the football calendar (season kickoff,
transfer deadline day) and keep the event copy inside the same trademark and
claim rules as the listing.

## App Store tags

Apple generates tags with an LLM from metadata, description and screenshots;
they are human-verified and manageable in App Store Connect. The description is
otherwise unindexed, so keep it **explicitly feature-named** ("youth academy",
"promotion and relegation") to steer the tagger, and re-check the tag list
after each release.

## Method

1. Change caption copy in the generator **and** the ASO doc in the same commit.
2. Re-render every size; verify the PNG dimensions match the required canvases.
3. Run `node marketing/aso/validate-locales.mjs` — it guards the caption count
   and trademarks across all 37 locales.
4. State plainly which changes need a binary (none of these do — screenshots go
   through the Asset Library, CPPs and events are live edits).
