# Ads attribution and ROI audit — 2026-09-26

## Scope and plan

Review purchase initialization, Apple Ads attribution, rewarded-ad readiness and the unit-economics assumptions. Preserve existing game balance and disabled native advertising.

1. Reproduce missing iOS attribution activation with focused tests.
2. Enable the installed RevenueCat SDK's AdServices collection after successful configuration, without blocking purchases on attribution failure.
3. Correct profitability claims that are only model scenarios.
4. Run purchase regressions and repository preflight checks; record results before handoff.

## Verified from code

- RevenueCat Capacitor 12.3.2 supports automatic AdServices collection; it is disabled by default. The current initialization does not enable it.
- Native rewarded ads are deliberately disabled in `src/utils/ads.ts`; do not budget projected ad revenue as current income.
- `marketing/ads/unit-economics.mjs` uses assumed conversion, churn, commission and auction inputs. Catalog fallback prices are not proof of App Store prices or realized proceeds.

## Release and measurement gates

Code tests cannot establish live attribution or profitability. Verify collection on an iOS build, the RevenueCat Apple Ads integration, and eligible campaign targeting. Reconcile campaign spend with mature attributed acquisition cohorts, proceeds after refunds/fees, and the same currency and dates before scaling. AdServices collection does not send purchase events back to Apple Ads.

No Dynasty acquisition budget has been authorized in this task. DeepLife's separate USD 50 maximum test loss does not authorize spending for Dynasty.

Source: https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads

## Implementation and validation

- iOS initializes automatic AdServices collection after successful RevenueCat configuration. Attribution failure or delay cannot block purchase readiness; Android and web do not collect Apple tokens.
- Four new attribution assertions failed on the original code. After the fix, five focused suites passed: 151 tests covering attribution, purchase failure modes, the IAP lifecycle/SKU matrix and ROAS arithmetic.
- Corrected required gross-equivalent revenue to multiply by target ROAS. Added scenario metadata to JSON output and removed automatic scaling advice from the model. Historical marketing tables are flagged as predating catalog changes.
- Lint passed with six pre-existing React fast-refresh warnings; typecheck, docs drift, i18n, type floor and pack supply checks passed. Documentation counts were updated for the two added test files.
- The Windows-equivalent preflight was started, but its broad test stage was interrupted under local memory pressure (about 1.1 GB free of 32 GB). This is not a full-preflight pass. Focused tests were then run with one worker. Full CI remains a merge gate.
- Live Apple Ads inspection found the Dynasty UK campaign paused with zero spend in Last 7 days. Current attributed revenue and ROI were not verified; dashboard interaction became unreliable after sign-in. No campaigns were activated.
