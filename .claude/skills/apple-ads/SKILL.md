---
name: apple-ads
description: Plan, structure or troubleshoot paid Apple Ads (Apple Search Ads) campaigns for Dynasty Manager — campaign structure, keyword sourcing, bids, placements, custom product page mapping and measurement. Use when the task mentions Apple Search Ads, Apple Ads, ASA, paid UA on the App Store, CPT/CPI targets, or bidding on keywords.
---

# Apple Ads

Paid search on the App Store. This skill covers structure and measurement; the
organic keyword work is `aso-metadata`, the creative is `store-conversion`, and
the cross-channel budget model is the `marketing-playbook` command.

## What changed in 2026

- Placements: **search results, Search tab, Today tab, and other apps' product
  pages**.
- From **3 March 2026** Apple shows **two advertisers per search query** on
  iOS/iPadOS 26.2+. Existing search campaigns are auto-eligible — nothing to
  opt into, but expect cost-per-tap and win-rate movement, so re-baseline
  rather than comparing against pre-March numbers.
- Placement cannot be hand-picked; ranking stays bid × auction performance.
- Today-tab ads render **app name + icon + subtitle** and **require a custom
  product page** as the destination.

## Structure

Minimum sane account, each campaign pointing at the CPP that matches its intent
(see `marketing/aso/season-2026-refresh.md` §Custom product pages):

| Campaign | Purpose | Notes |
|---|---|---|
| Brand defence | own brand terms | Cheapest installs; stops rivals taking your name |
| Category / head terms | soccer manager, football manager, career sim | Highest volume, highest CPT |
| Competitor conquest | rival brand terms | **Allowed in Apple Ads even though those words may not appear in metadata** — do not confuse the two rules |
| Discovery | broad match + search match, harvesting | Feed winners back into the exact-match campaigns and into the organic keyword field |

## Rules of engagement

1. **Validate keyword picks against Search Popularity** in the Apple Ads
   keyword planner before spending. The organic keyword fields in this repo are
   built from category knowledge and character-limit maximisation, **not** from
   live volume data — that caveat is stated in `marketing/aso/locales/README.md`
   and it still stands.
2. **Discovery feeds organic.** Any term that converts in ASA is a candidate
   for the 100-char keyword field, and vice versa; keep the two in sync in the
   same pass.
3. **Retention is a ranking input in 2026.** A keyword that buys volume but
   drags D7 hurts organic rank as well as ROAS — judge terms on retained
   users, not installs.
4. Localised campaigns need localised CPPs and metadata; do not run a
   storefront whose locale file is stale (the validator's expired-campaign
   report tells you which).

## Measurement

Baseline before launch: category rank, keyword ranks, impressions → product
page views → installs, D1/D7. Then read TTR, CR, CPT, CPA and **D7 retention by
campaign**. Attribute through SKAdNetwork/AdAttributionKit limitations
honestly — small-sample postbacks are noisy, so do not re-bid on a day of data.
