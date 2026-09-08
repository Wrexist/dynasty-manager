# App Store update audit — 2026-09-08

Base: `cece2329bc1338399d834c5f4872b2d4028c71b2` (`main`, app 1.6.0).
Branch: `codex/app-store-release-audit`.

**Status: commit preflight passed; native release gates remain.**
A repository audit cannot establish native StoreKit delivery, signing, device stability, or the contents of App Store Connect. No upload, merge, or release was performed by this audit.

## Recent PR review

GitHub returned no open PRs at the time of review. Reviewed the descriptions of #612–#619, with source-level attention to #619's bulk sale/Undo and milestones, #618's rendering changes, #617's squad integrity, and the paid-pack changes in #614–#615. PR #619, #618, and #617 had no inline review comments returned by the API. Old PR test results are not evidence for this branch.

## Findings addressed

| Priority | Finding | Change and evidence |
|---|---|---|
| P1 | Quick-sell Undo could overwrite a later financial or roster action in the same week, or a different active save slot. | Capture post-sale references and slot/club identity. Refuse Undo when restoring would overwrite changed data. New tests reproduced both failures before the fix. Ordinary navigation still allows Undo. |
| P1 | Paid-pack code treated a non-failed save status as proof of durability while IndexedDB was still writing. | `flushSave()` returns a disk outcome. Recovery awaits it before deleting the credit. IDB-only saves display “saving” until completion, repeated failures continue to display failure, and Settings no longer announces success or returns to the menu before persistence succeeds. |
| P1 | A successful localStorage fallback could be ignored on restart when IndexedDB held an older save. | Persist a consistency marker with the fallback, prefer that newer copy at hydration, and clear only the matching marker when IDB succeeds. Restart and overlapping-write regressions pass. |
| P1 | Duplicate recovery implementations could grant the same credit again after a failed save or concurrent mounts. | One shared reconciler, shared in-flight gate, and a stable grant id recorded before generation. Existing `OpenedPackRecord.id` identifies a completed grant without changing the save schema. Retry persists existing players instead of rolling another pack. |
| P1 | Confirmed but unclaimed purchases expired after seven days. | Confirmed credits no longer expire. Full squads keep a waiting credit. Product id must match the tier before delivery. |
| P1 | Another purchase could overwrite the one pending credit; purchases also proceeded when writing the initial marker failed. | Keep the existing credit and refuse a new charge. Storage failure before StoreKit blocks purchase with an actionable message. |
| Security | Dependency audit reported 15 affected packages (2 critical, 7 high, 4 moderate, 2 low). These ratings include build-time dependencies, not 15 demonstrated remote exploits in the iOS app. | Compatible lockfile updates plus React Router 7.18.3. Removed obsolete v6 future flags, whose behaviours are already enabled in v7. Follow-up `npm audit` reports zero. |
| Security | Workflow interpolated its free-text marketing version directly into shell code. | Pass through an environment variable, require a numeric three-part version, and quote it. |
| Release | TestFlight could archive a branch without running the full release gate or checking the production purchase key. | Run `preflight:full` before archive and reject missing/test/Android RevenueCat key formats. Signing SSH credentials are loaded only after validation and the web build. Key format validation does not prove the dashboard products are configured. |
| Security | iOS allowed arbitrary insecure WebView loads despite application resources using HTTPS. | Removed the broad ATS exception. Native smoke testing is still required. |
| UX | Latest PR's derived player-standing headline was not surfaced in player profiles. | Show the existing headline for the managed club's players, covering breakthrough development, service, and career milestones. No simulation balance or save-schema change. |
| Data | EA midnight birthdates changed day when normalized on a runner east of UTC, affecting birthday/age data. | Normalize calendar date components before deriving age. The existing live-shape regression plus birthday-boundary assertions pass. Generated player datasets were not edited. |
| CI | PR checks omitted the documented docs, localisation ceiling and pack supply guards. | Added all three to PR validation. |

## Verification

- New Undo regressions: 2 failures reproduced before the fix.
- Focused packs/recovery/autosave/save-protection run: **101 tests passed**.
- Save durability/storage/protection regression run after fallback fix: **63 tests passed**.
- Production web build: passed after dependency updates; final eager payload 544.2 kB gzip (560 kB limit), main chunk 1292.9 kB (1300 kB limit).
- Dependency audit after updates: **0 reported vulnerabilities**.
- Release key guard: missing and test keys rejected; synthetic `appl_` fixture accepted without printing the key.
- Initial full release gate: **3331 passed, 4 failed, 5 skipped**. Failures: an early version of the save-status race (fixed), timezone-sensitive FC27 birthday parsing (fixed), a 60-second season-turnover timeout, and a 201.9 ms simulation sample against a 200 ms limit. Follow-up results are recorded below.
- Date pipeline and save-status race follow-up: **43 tests passed**.
- Isolated 100-week performance check: passed the unchanged 200 ms limit. The three-season integrity timeout reproduced on unchanged `main` using the same installed dependencies. Its deadline is now 120 seconds (the suite default), with all assertions retained. It then passed in 80.93 seconds.
- Final fast-suite assertions: **3208 passed, 3 skipped**, but the runner reported a worker RPC timeout. The 800-match medical regression blocked the event loop for over 60 seconds; it now yields between seeded pairs using the existing harness helper, preserving all 400 seeds and assertions. The complete commit gate then passed: **228 files passed, 3208 tests passed, 3 tests skipped, no runner errors**; lint/typecheck/docs/i18n/pack supply/build/size all passed.
- Lint: zero errors; 16 existing warnings remain (unused imports/hooks and Fast Refresh exports).
- Visual browser check: blocked by this session's browser (`ERR_BLOCKED_BY_CLIENT` on the local preview). Do not count this as a visual pass.
- A single all-green full-suite run on the final commit remains a CI/release requirement. The initial full run plus the documented focused follow-ups are not represented as that result.
- Native archive, device performance, sandbox StoreKit, Sentry dashboard and App Store Connect: not verified here.

## Remaining release gates

1. Build this reviewed commit with `dev_tools=false`, then test on a real iPhone and iPad. Cover cold launch, upgrade from an existing 1.6.0 save, background/force-quit recovery, first match, season rollover, all game modes, and narrow-screen layout. Verify routing after the React Router upgrade.
2. Sandbox purchases: buy/cancel each pack and each Pro product, restore Pro, verify expired Pro, interrupt a purchase, fill the squad, and test low-storage recovery. A local marker is not a receipt ledger: termination between StoreKit charging and JavaScript receiving confirmation still needs native receipt reconciliation/support. Do not claim this window is solved.
3. Confirm the production RevenueCat SDK keys, offering/product availability and Sentry configuration. Repository code cannot verify dashboard secrets or entitlements.
4. Update App Store Connect display names for Champions, Elite, World Class, Legends and Dynasty Legacy Pack. Product identifiers remain unchanged.
5. Check the actual App Store release notes/version train, paid-pack odds, subscriptions, age rating and privacy declarations against the binary. Existing rights/data decisions are owner-acknowledged in `LEARNINGS.md`; this audit does not establish licensing or endorse stale submission documents.
6. Open the privacy link on device. The URL is present in code, but this session could not verify its public availability. Apple's standard EULA page was accessible.

## Gameplay recommendations, separate from release blockers

The existing `docs/squad-routes-report.md` measured 200 opens per tier per club. Its older report found a Champions pack averaged 3.33 starting-XI upgrades at Luton versus 0.42 at Manchester City. The quick-sell taper addresses cash extraction; it does not remove the squad-strength shortcut. These are prior measurements, not rerun measurements from this audit.

| Next improvement | Why it helps | Smallest useful validation |
|---|---|---|
| Opt-in earned-only career for new saves | Preserve scouting, youth development and promotion as meaningful routes without reducing an already purchased pack's promise. | Compare progression and seven-day return rate in a small playtest against current sandbox. Keep purchases out of that mode from its start. |
| Contextual next-action guidance after matches | Connect the match result to one useful decision: tactical weakness, fatigue, or a contract deadline. | Observe five new players completing their first three matches without prompting. Reuse the current game-plan/debrief systems. |
| Squad development story | Make players care about developing their own squad. The profile headline is the first increment delivered here. | Check whether players notice and can explain a breakthrough; then consider a seasonal academy recap, not another currency or reward layer. |
| Purchase transaction ledger | Recover confirmed native transactions even when JavaScript never receives success, and prevent duplicate fulfilment beyond one device/slot. | Native interruption matrix with transaction ids and idempotent receipt-backed fulfilment. This requires native/backend work, not another client-only marker. |

Sources: [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Apple standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/), npm advisory data in the audit run, repository source and linked PRs. No guarantee of finding every defect or of App Review approval is implied.
