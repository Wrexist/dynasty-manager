# Apple Ads

Paid App Store search for Dynasty Manager. Organic metadata is `marketing/aso/`;
creative for Meta/TikTok is `marketing/scripts/`. This directory is the paid
App Store channel only.

```
marketing/ads/
├── README.md                  ← you are here
├── apple-ads-2026-27.md       ← the plan: structure, bids, CPPs, gates, phasing
├── unit-economics.mjs         ← runnable model; every bid ceiling comes from here
└── keywords/
    ├── en-US-brand.csv        ← campaign 1, exact
    ├── en-US-longtail.csv     ← campaign 2, exact, by ad group
    ├── en-US-conquest.csv     ← campaign 3, exact, rival brands (ads-only, never metadata)
    ├── en-US-head.csv         ← campaign 5, STAGED AND PAUSED
    └── negatives.csv          ← account-wide
```

## The one-paragraph version

Net revenue per install currently models at **~$0.24**, which caps the
affordable cost per tap at **~$0.13-0.18**. Category head terms clear well above
that, so they are staged and paused. Brand defence, long-tail feature queries
and competitor conquest can pay back at capped bids, and phase 1 runs them at
**$19/day for four weeks (~$570)** primarily as a *measurement instrument* — its
real deliverable is replacing the six guessed funnel rates in the model with
measured ones. Head terms unlock only when the model, fed real numbers, says
they can.

## Before you touch a bid

```bash
node marketing/ads/unit-economics.mjs
```

It parses prices live out of `src/config/monetization.ts`, prints the max CPT
the price ladder supports, and flags every input that is still an assumption.
**No number in `apple-ads-2026-27.md` may be hand-edited without re-running
it.** Override any assumption from the command line:

```bash
node marketing/ads/unit-economics.mjs --pro=0.03 --monthly=0.05 \
  --trial-to-paid=0.5 --churn=0.15 --consumables=0.15 --cpt=0.35 --cr=0.75
node marketing/ads/unit-economics.mjs --json    # machine-readable
```

**Modelling changes you have not shipped yet.** Two flag families exist so a
proposed change can be evaluated before anyone edits the app:

```bash
# Rewarded ads, currently a $0.00 line (src/utils/ads.ts, NATIVE_ADS_READY=false)
node marketing/ads/unit-economics.mjs --ad-arpi=0.12

# A repriced ladder, without touching the shipped catalog
node marketing/ads/unit-economics.mjs --price-annual=19.99 --price-bundle=24.99
```

Ad revenue is deliberately added **after** Apple's commission — ads do not pay
the IAP cut, and modelling them alongside IAP understates them by the
commission rate. The printed "gross" line grosses the ad revenue back up so it
sits in the same column as the IAP lines; the "net" line is the one that sets
the bid ceiling.

## Two rules that are easy to get wrong

1. **Rival brand names are legal in Apple Ads and a Guideline 2.3.7 violation
   in App Store metadata.** `keywords/en-US-conquest.csv` must never be copied
   into `marketing/aso/locales/*.md`.
2. **Discovery feeds organic, both directions.** A term that converts in the
   discovery campaign is a candidate for the 100-char keyword field; a term
   already ranking organically top-3 is a candidate to *stop* bidding on. Sync
   in the same pass — it is free efficiency.

## Related

- `marketing/aso/RESEARCH-2026.md` — ranking factors, indexed fields, sources
- `marketing/aso/season-2026-refresh.md` — organic metadata + the CPP set
- `/marketing-playbook` — cross-channel budget model and go/no-go
- `/apple-ads` · `/store-conversion` · `/aso-metadata` — the working skills
