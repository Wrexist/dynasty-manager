# App Store release audit — 2026-09-20

Audited `feature/pack-store-rotation` at `440bcf052171244cd71d6968ee3532c25f102e60`, app version **1.6.0**, four commits ahead of the locally fetched `origin/main` (`5cd2aade`). This is a review, not a release certification. No production settings, purchases, uploads, or game code were changed.

**Recommendation: hold submission until the purchase/store issues and the native release gates below are resolved.** Initial local checks passed, but installed dependency drift invalidates them as release evidence. Clean-checkout verification is recorded below. Neither web checks nor this audit establish StoreKit delivery, device stability, or App Store Connect configuration.

## Fix before submission

| Priority | Finding | Evidence and required result |
| --- | --- | --- |
| P1 | Local validation was using stale dependencies. | `npm ls` exits `ELSPROBLEMS`: installed React Router DOM 6.30.3 does not satisfy declared `^7.18.3`; lockfile specifies 7.18.3. Installed Vite 7.3.2 / Vitest 3.2.4 also differ from locked 7.3.6 / 3.2.7. Reinstall from the lockfile and run the release gate on the exact candidate. The original full suite was stopped when this mismatch was discovered; no passing full-suite result is claimed. |
| P1 | The linked privacy policy contradicts the shipping integrations. | `src/config/legal.ts` links to `https://wrexist.github.io/dynasty-manager/privacy.html`. The live page and `docs/privacy.html:73` say no analytics or crash-reporting SDKs are used. `src/utils/sentry.ts` initializes Sentry when configured; purchases use RevenueCat. Reconcile the actual SDK data flows, linked policy, and ASC privacy answers. `public/privacy-policy.html` is a different policy and is not the linked source; copying it blindly would also retain stale advertising statements. |
| P1 | An interrupted payment can fall between native charge and durable confirmation. | `src/pages/PacksPage.tsx:519` persists `charged: false`, awaits the native purchase, then marks it true at line 537. `src/utils/packCreditRecovery.ts:32` discards false markers on restart. A kill after native success but before the JS confirmation is persisted therefore lacks a recoverable confirmed credit. This is a code-supported risk, not a reproduced real-money loss. Resolve using verified native transaction reconciliation; do not simply grant every unconfirmed marker. Require interruption tests around this exact boundary. |
| P1 | Purchase recovery preserves bonus-card count but not the weekly edition. | The pending marker contains bonus cards/slot but no purchase-time week, frame, or version boost (`src/store/helpers/persistence.ts:748`). Recovery calls `openPack`; `src/store/slices/packsSlice.ts:373–394` derives the edition/boost from the current week. A confirmed purchase delivered after the weekly boundary can receive different content from the advertised edition. Persist and validate the paid offer's complete content contract for both ordinary completion and restart recovery. |
| P1 | Main store prices are still static USD while the popup uses localized prices. | `src/pages/PacksPage.tsx:653` supplies `iapPriceDisplay` to the deal rail; main cards use the same configured prices through `PackShopCard`. The fetched `packPrices` map is passed to the popup only. Use the native product's localized price everywhere a purchase is offered; unavailable prices/products need a consistent unavailable/loading state. A non-US storefront must see the same currency/price in the card, popup and native sheet. |
| P2 | “Choose pack” does not preserve a complete route to the chosen purchase. | `PackDealOfferHost.tsx:53` ignores the selected deal and merely opens the Market. `PacksPage.tsx:1021` opens an odds sheet, which has no purchase action. Carry the selected deal into a focused pack detail/confirmation flow, retaining contents and expiry semantics. Keep odds accessible before purchase. |
| P2 | Weekly scarcity copy promises something the implementation does not do. | `src/config/packs.ts:340` says the Dynasty frame can never be pulled again after the week. `getFeaturedPackTier` repeats the same three skins, and `packFrameFor` returns their same frame IDs. Correct the wording to describe a recurring rotation, or implement genuinely distinct editions. The real countdown must describe the actual offer expiry. |
| P2 | Pack naming and release notes are inconsistent with this branch. | Gold uses the former Champions product/artwork; weekly Royal Reserve copy still says Champions. Align store labels, cover art, ASC product display names, and purchase confirmations without changing existing SKU identities unintentionally. The sealed 1.6.0 news still describes the older single-free-pack market; the latest changes remain in `pendingNews`. Version checks passing does not mean the release notes describe this build. |
| P2 | Daily Reward's close button is covered by its content layer. | At 390×844, a normal click on `Close daily reward` repeatedly failed because the header intercepted pointer events. A hit test at the button center `(352, 315.375)` returned the later header div, not the button. `src/components/game/DailyRewardModal.tsx:131–142` places the absolute close button before a positioned content sibling without a higher stacking order. Fix the stacking/hit area and verify normal touch dismissal. Escape dismissed it in the browser, so this is not a complete navigation deadlock. Screenshot: `%TEMP%/dynasty-audit-daily-close.png`. |

## Additional polish and balance work

- Independent rotating slots can offer the same SKU with different bonus counts at the same time (`src/utils/packDeals.ts`). Browser reproduction during this audit showed Gold twice: 8 players for $2.99 and 7 players for $2.99, with different countdowns. The generic tier lookup selects the first matching offer. Deduplicate to the best live offer or consistently preserve the explicitly selected offer; do not make players guess which card to tap for the better contents.
- Fresh onboarding displays both **Turkey / Türkiye** and **Czech Republic / Czechia** as separate nationalities with different ranks (`src/data/nations.ts:30,38,80,85`). Canonicalize the choices while preserving existing save references. Browser reproduction confirmed the duplicates.
- Recheck progression balance after adding daily Bronze/Silver claims and recurring multi-card bonuses, especially the high-tier pack. The old economy simulations alone do not establish the balance of the new offer cadence.
- There are untranslated player-facing strings and 15 existing lint warnings. The localization ceiling passes; that is not proof of complete translation.
- Main bundle has only **5.8 KB** of remaining uncompressed headroom. Further UI work should preserve lazy loading and rerun the size gate.
- `docs/app-store-submission.md` contains older product assumptions. Do not reuse its metadata without reconciling current IAPs, integrations and gameplay.
- **Windows test portability:** the clean fast suite cannot collect `fc27Pipeline.test.ts` with this checkout's CRLF `.mjs` scripts (`Invalid or unexpected token`, import at line 15). Node's own syntax check and direct import pass. An isolated LF-only diagnostic then runs 38 tests successfully and fails two path assertions at lines 303 and 311 because they hard-code `/` separators. Normalize script checkout line endings and make path expectations platform-aware. This is evidence of a Windows test/tooling issue, not proof of an iOS gameplay defect or a failure on macOS CI.

## Intentionally unavailable features

- **Online mode:** the mode selector explicitly marks it Coming Soon. It is unfinished, but not necessary for this release if metadata does not promise it.
- **Rewarded ads:** the native implementation is disabled/stubbed and callers are gated. Do not enable it or claim ads are available without a separate integration/device pass.

## Verification on this audit

The initial results below were obtained with the **existing, stale `node_modules`** and are diagnostic only. A detached checkout of the audited SHA was created at `%TEMP%/dynasty-release-audit-clean-440bcf05` for `npm ci` and clean checks, without replacing the user's working dependency directory.

Clean `npm ci` succeeded (577 packages). A browser check against that checkout, with React Router 7.18.3 and Vite 7.3.6, reproduced the Daily Reward close-button obstruction and the two differently sized Gold offers at the same price. The saved Sandbox game loaded and navigated to Packs without a reported page exception. The original browser pass also reached match preparation and the kickoff screen; initial Manager Career, Sunday League, and World Cup setup screens loaded at 1024×768. No completed-match or complete-season manual pass is claimed.

**Clean-checkout results:** lint (0 errors / 15 warnings), typecheck, docs drift, localization ceiling, pack supply, production build and bundle limits all passed. The actual locked-dependency build is **544.6 KB gzip eager payload** (15.4 KB below its limit), and **1294.2 KB main chunk** (5.8 KB below its limit). The fast suite exits **1**: **231 files passed, 1 failed to collect, 2 skipped; 3,187 tests passed, 3 skipped** in 431 seconds. The failing FC27 suite reproduced alone; the LF-only diagnostic gives 38 passed / 2 failed (Windows path assertions), as described above. The temporary line-ending changes were restored. **No all-green full-suite result is claimed.** Logs: `%TEMP%/dynasty-release-clean-install.log`, `%TEMP%/dynasty-release-clean-checks.log`, `%TEMP%/dynasty-release-clean-fast.log`, `%TEMP%/dynasty-release-clean-fc27.log`, and `%TEMP%/dynasty-release-clean-fc27-lf.log`.

| Check | Result |
| --- | --- |
| ESLint | Pass, 0 errors / 15 warnings |
| TypeScript | Pass |
| Docs drift / localization ceiling | Pass |
| Pack supply | Pass: all storefront bands have player supply |
| Marketing version / What's New structural check | Pass; semantic release-note gap above remains |
| Observability check | Warn-only exit 0: local `VITE_SENTRY_DSN` is missing. **Not proof of production reporting.** |
| Production web build | Pass |
| Bundle limits | Pass: eager 538.8 KB gzip / 560 KB; main 1294.2 KB / 1300 KB |
| Dependency audit | Production dependencies: 0 findings. Full tree: 2 moderate affected development packages, Vitest and its mocker; review GHSA-82fw-gwwq-j7x9 and upgrade/test separately. The earlier zero-total-audit statement is stale. |
| Full game suite | Stopped after dependency drift was discovered. No full-suite sign-off; run `preflight:full` on the final candidate with a clean install. |
| Browser smoke | At 390×844: fresh title screen, dismissible Pro onboarding, mode selection, nationality/league/club selection, creation of an Arsenal Sandbox save, reload into its dashboard, and navigation to the pack store exercised. Opening the free Daily pack increased squad size from 24 to 27 and entered the reveal overlay. Daily Reward close hit-target failure is documented above. No page exception was reported during these completed flows. This is not an iOS device pass or a complete all-mode playthrough. |

Runtime configuration probe confirmed that `packFrameFor('rare', 0)` / `packVersionBoostFor('rare', 0)` return `dynasty` / 4, week 1 returns `world-class` / 3, and week 3 returns `dynasty` / 4 again. This supports the weekly-content and repeating-edition findings; it does not simulate a real StoreKit interruption.

Local command logs: `%TEMP%/dynasty-release-checks-2026-09-20.log` and `%TEMP%/dynasty-release-full-tests-2026-09-20.log`.

## Native and external gates still required

1. Build the final candidate SHA for TestFlight after fixes. The latest successful TestFlight workflow found was **build 185, September 3**, which predates this branch. Public Apple lookup still reports **1.4.0**, released August 25. Do not represent 1.5.0 or 1.6.0 as previously released App Store versions.
2. Real iPhone **and** iPad: cold launch, resume/background, force-close and restore saves, upgrades from live 1.4.0 and existing 1.6.0 TestFlight saves, every available game mode, match completion, season rollover, and low-storage save handling. Confirm popup readability, dismissal, safe areas and reduced motion on device.
3. Sandbox purchases: every pack SKU and Pro product; trial-eligible/ineligible users; cancellation, pending/interrupted transactions, offline/unavailable products, full squad, storage failure, duplicate callbacks, restart recovery, restore of restorable purchases, and expiry/week-boundary delivery. Consumable packs require their own delivery recovery rather than assuming subscription restoration will recover them.
4. RevenueCat and Sentry dashboards: correct iOS app/key, active products, offerings/entitlements, subscription introductory offers, and an actual test purchase plus an actual received crash/error event. Workflow format guards cannot confirm dashboard configuration.
5. App Store Connect: reconcile the five pack display names with the final in-game names/art, select the correct version train, seal accurate notes, verify privacy declarations/link on-device, and complete the age-rating questionnaire using actual paid randomized-item mechanics.
6. Verify the produced archive uses the required Xcode/iOS SDK, signing and export settings. Windows web checks cannot establish this.

## External references checked

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): paid randomized virtual items need odds disclosed before purchase; review the final purchasing and metadata flows against the current rules.
- [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/): uploads require Xcode 26 / iOS 26 SDK or later from April 28, 2026; the revised age-rating questionnaire is also in effect.
- [Linked live privacy policy](https://wrexist.github.io/dynasty-manager/privacy.html).
- [Latest successful TestFlight run found](https://github.com/Wrexist/dynasty-manager/actions/runs/33804303940).
- [Vitest advisory GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9): development-tool exposure, not a demonstrated iOS runtime exploit.

## Remediation in the release candidate

The findings above record the original audit, not the final status. The candidate now includes verified-transaction recovery for interrupted pack purchases, purchase-week preservation, slot-switch guards, consistent localized store pricing, selected-offer navigation and an odds-sheet purchase action, deduplicated rotating offers, honest recurring-edition copy, a distinct Gold cover, a usable Daily Reward close target, and canonical onboarding nation choices.

The owner confirmed there is no Sentry project. Sentry is intentionally disabled for 1.6.0; the workflow only requires a DSN when the SENTRY_ENABLED repository variable is explicitly true. Source-map uploads follow the same switch. Production purchase-key validation remains mandatory. Privacy copy and the native manifest reflect this decision. Publishing the revised hosted policy and checking ASC privacy answers remain required.

Vitest was upgraded to 4.1.11 and its worker configuration migrated; Node typings are explicit. Script line endings and pipeline path assertions now support Windows. The dependency audit reports zero vulnerabilities. Type checking, production build, and bundle limits pass (544.7 KB eager gzip; 1294.6 KB main uncompressed). Full-suite and native-build results must be recorded after completion.

The App Store Connect draft has been changed from unsubmitted 1.5.0 to 1.6.0 and English release notes saved. No App Review submission or public release has been made. Device and StoreKit sandbox gates remain open until actual testing establishes them.
