# Conversion recovery — 24 September 2026

App: Dynasty Manager: Soccer Career, App Store Connect ID 6760918006.

## What changed

4% to 1.49% is a 62.75% relative decrease, or 2.51 percentage points. Those headline figures do not establish that the same audience became less willing to download. The matched windows below separate exposure from downloads.

The inspected 90-day window (June 24–September 21) contained 82,642 summed daily unique impressions and 1,233 downloads: 1.492%. That is a whole-window ratio, not a September endpoint. The recent matched-window rate below is 1.545%; do not mix the 90-day aggregate with a single July day when measuring the decline.

| UTC window, inclusive | Unique impressions, sum of daily counts | Total downloads | Downloads / impressions |
|---|---:|---:|---:|
| July 13–26 | 2,710 | 111 | 4.096% |
| July 27–August 9 | 25,463 | 310 | 1.217% |
| September 8–21 | 12,362 | 191 | 1.545% |

The break was July 27: impressions rose from 248 on July 26 to 3,064, while downloads rose from 5 to 24. Search exposure expanded sharply. Browse conversion stayed approximately stable (5.57% to 5.84%); Search fell from 3.04% to 0.90%. This points to a search acquisition change, not a uniform collapse across every source. Source-level unique device counts overlap; do not sum them to reconstruct the overall denominator.

Version 1.2.5 became Ready for Distribution July 27 at 10:35 AM in the history UI. That timing is associated with the break, but neither a particular keyword change nor the release itself is proven causal. The repository's July 28 screenshot/ASO redesign is after the onset. Later releases: 1.3.0 August 9, 1.4.0 August 25, 1.6.0 September 21.

## Where performance is weaker

Search only; impressions are rounded daily averages displayed by App Store Connect. Conversion rates use the same source and territory filters. Small baseline samples make country percentages noisy.

| Territory | July 13–26 impressions/day; CVR | July 27–August 9 impressions/day; CVR | September 8–21 impressions/day; CVR |
|---|---|---|---|
| United States | 40; 1.98% | 438; 0.85% | 75; 2.01% |
| United Kingdom | 16; 5.75% | 106; 0.81% | 34; 1.91% |
| Vietnam | 8; 4.67% | 339; 0.27% | 189; 0.49% |
| Türkiye | outside top 10; 3.13% | 72; 0.90% | 90; 0.16% |
| Russia | outside top 10; unavailable | 70; 2.05% | 62; 2.06% |

US conversion recovered relative to the first expansion window, but search exposure fell about 83%. Vietnam and Türkiye remain high-exposure, low-conversion markets. Only English (US) and English (UK) listings are published. The 37-locale repository kit is draft material, not evidence of a historical live rollout. English-only presentation may contribute to the market mismatch; this is a hypothesis, not an established cause. Runtime localization remains partial and must not be advertised as translated gameplay.

Apple Ads account inspection did not identify a verified Dynasty campaign. The inspected generic brand campaign promoted Silicon: Tech Tycoon. No campaign was changed. Search can include Apple Ads, so these data must not be described as organic-only.

## Changes and release status

- **Saved in App Store Connect:** both English promotional texts now read: “Manage your club, shape your tactics and scout future stars. Play a football management career at your own pace. Free to download; optional Pro and player packs.” (161/170 characters).
- **Draft, not submitted:** Product Page Optimization test “Gameplay first — September 2026”, one treatment, 50% traffic allocation, both English localizations. Move `03-match-day.jpg` first on iPhone 6.9-inch, iPhone 6.5-inch and iPad 13-inch; retain the relative order of all other images. UK inherits the US assets. Default product page is unchanged. Apple requested App Review; that dialog was cancelled per the owner's instruction to build and test through TestFlight first.
- **Local app change:** make the existing paywall dismissal visibly say “Continue Free” and increase its target from 36px to at least 44px. Purchase, restore, entitlement, and skip handlers are unchanged. This addresses post-install clarity; it is not a direct repair to Apple's impression-to-download metric.

Previous promotional text for rollback (both locales): “Build your football dynasty. Scout future stars, master your tactics and boost your squad with redesigned packs, rotating bonus offers and smoother gameplay.”

Test URL: https://appstoreconnect.apple.com/apps/6760918006/distribution/optimization/efe80805-ebd6-45a6-9d15-b9848dda7ebc

## TestFlight gate and measurement

Build the candidate through `.github/workflows/ios-testflight.yml`, with developer tools disabled. A successful workflow upload is not proof of Apple processing or device testing. Before App Review, test on a real iPhone and iPad:

1. Fresh install: new career, visible Continue Free, dismiss without purchasing, choose a mode and start a match.
2. Existing save: update from the released build, resume career, play a match, force-close and recover the save.
3. Sandbox purchases: purchase and restore Pro, cancel a purchase, simulate unavailable store/network and verify the free path remains usable. Confirm no purchase on tapping Continue Free.
4. Check small screens, safe areas and large text. Confirm the build number actually matches the new candidate.

After device testing, submit the screenshot test for review. Start only after approval. Compare treatment vs randomized original, not a before/after aggregate. Review after at least two complete weekly cycles, and keep collecting if Apple's confidence is insufficient; do not declare a winner from a few daily installs. Track total downloads and source/territory impressions alongside CVR. A higher rate caused only by losing impressions is not success. Keep keyword and title changes out of this screenshot experiment.

Next release copy should qualify optional purchases and eligible trials, remove dated season openings and paid ad-removal claims while ads are disabled. Localized Vietnamese/Turkish storefront copy needs native-language review and an explicit English-gameplay disclosure before publishing.

Local validation completed before the native build: production Vite build; TypeScript; 31 focused purchase, paywall and i18n tests; 375×812 browser check (Continue Free measured 153×44px and navigated to Choose Your Mode); existing 37-locale metadata validator. These do not replace native StoreKit or device testing. The complete preflight and native CI results are reported with the candidate build.

Per-commit preflight passed with Git Bash as npm's script shell (the existing `VITEST_FAST=1` command uses POSIX syntax): 233 test files passed, 2 skipped; 3,240 tests passed, 3 skipped. Lint had 15 warnings and no errors. Production build and bundle budgets passed (544.7 kB gzip eager bundle against 560 kB). Native workflow must still pass `preflight:full` before upload. Candidate marketing version is 1.6.1 via the workflow's supported version override; developer tools are disabled.

## Source receipt and corrections to older ASO guidance

Read on 24 September 2026: [ASC metrics](https://appstoreconnect.apple.com/apps/6760918006/analytics/metrics), [version history](https://appstoreconnect.apple.com/apps/6760918006/distribution/activity/ios/versions), published v1.6.0 locale fields and screenshot media manager. Analytics windows end September 21; they do not include the effect of today's edits. Daily tables were inspected in the UI; these figures are transcribed, not an attached raw export.

Apple defines [conversion and impressions](https://developer.apple.com/help/app-store-connect-analytics/reference/metrics-definitions). [Acquisition guidance](https://developer.apple.com/help/app-store-connect-analytics/acquisition/acquisition) includes Apple Ads within App Store Search. [Product-page guidance](https://developer.apple.com/app-store/product-page/) says promotional text is editable without a new submission and does not affect search ranking; subtitle and description updates accompany a new version. Do not follow older repository claims that subtitle/keywords can always be edited on an already released version, that title terms have a proven 5x weight, or that screenshot OCR has a documented ranking weight. Those claims are not established by the Apple sources checked here. Google keyword volumes also do not measure App Store query volume.
