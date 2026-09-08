# Dynasty Manager: next App Store update

## Candidate status

This follow-up starts from `fbc89ee` on main, after PR #620 merged. It fixes both subsequent save review findings and adds a deadline for stalled IndexedDB writes. It does not certify native payment delivery or device stability.

| Item | Status |
|---|---|
| Save waits despite a durable localStorage copy | Fixed, regression reproduced before fix |
| Older save hides a newer serialization failure | Fixed, regression reproduced before fix |
| IndexedDB-only write never completes | Ten-second transaction deadline, abort and fresh-connection retry tested |
| Focused regression suite | 49 passed across five files |
| Complete commit gate | Passed: 3213 tests, 3 skipped, no errors; lint/typecheck/docs/i18n/pack supply/build/size passed |
| Production purchase-key guard | Required before full tests/archive |
| Production crash reporting | Missing Sentry DSN now stops non-developer builds |
| Marketing version | Repository remains 1.6.0; confirm live/pending App Store version before choosing the next number |
| Native build and physical-device tests | Pending |
| App Store Connect / RevenueCat configuration | Apple sign-in required; secure sign-in transport failed in this session. Private configuration not verified |
| Final submission | Not submitted |

Final bundle: 544.3 kB eager gzip against a 560 kB limit; 1293.1 kB main chunk against a 1300 kB limit. No visual UI changes are made by this follow-up.

PR #620's full GitHub PR Checks run passed: https://github.com/Wrexist/dynasty-manager/actions/runs/34198605725 . This follow-up needs its own green checks.

## Build inputs

After this follow-up is merged, use GitHub Actions → iOS TestFlight → Run workflow:

- Branch: `main`.
- `marketing_version`: use `1.6.1` only if 1.6.0 is the current version train and no newer train is intended. Confirm in App Store Connect first. Do not leave it blank just because the build number increases: the pending in-app release notes need a new marketing version to seal.
- `dev_tools`: false for the release candidate.
- Record the Git SHA, marketing version and generated build number. Test and submit that exact build.

The workflow runs the full suite and archives on macOS with latest-stable Xcode. It now checks purchase and crash-reporting configuration before the expensive full suite. Public key format/presence checks do not verify dashboards or real purchase delivery.

Required existing GitHub configuration:

| Purpose | Secret/variable names |
|---|---|
| iOS purchases | `VITE_REVENUECAT_API_KEY_IOS` (legacy fallback `VITE_REVENUECAT_API_KEY`) |
| Crash reporting | `VITE_SENTRY_DSN` |
| Symbolicated reports | `SENTRY_AUTH_TOKEN`, variables `SENTRY_ORG`, `SENTRY_PROJECT` |
| Apple upload | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` |
| Signing | `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_SSH_PRIVATE_KEY` |

Keep secret values out of issues, screenshots and chat. Use provider settings and GitHub Secrets. Verify a test event reaches the correct Sentry project before release. Do not deliberately crash a real user's save to test reporting.

## App Store purchase display names

The public English listing still showed old names when checked on 2026-09-08. Update localized display names in App Store Connect, preserving identifiers, prices, purchase types and existing customers' entitlements.

| Existing identifier | New English display name |
|---|---|
| `com.dynastymanager.pack.gold` | Champions Pack |
| `com.dynastymanager.pack.premium_gold` | Elite Pack |
| `com.dynastymanager.pack.rare_gold` | World Class Pack |
| `com.dynastymanager.pack.icon` | Legends Pack |
| `com.dynastymanager.pack.legends` | Dynasty Legacy Pack |

The last row is a cosmetic one-time purchase, not the Legends player consumable. Check that the native purchase sheet makes the distinction clear. Localized names need equivalent updates.

Also review the current description's absolute “No paywall” / “No pay-to-win” claims against the actual Pro and purchasable-player systems. A safer short replacement passage is:

> Build your football career through tactics, transfers and player development. The game includes optional Dynasty Pro features, player-pack purchases and cosmetic upgrades. Check each offer in the game for its contents, price and purchase terms.

This is suggested replacement copy, not an assertion that all storefront metadata has been updated.

## What's New — ready to paste after validation

Improved career saving and recovery after interrupted saves.
Protected quick-sell Undo from overwriting later squad and financial decisions.
Improved recovery of paid player packs.
Player profiles now highlight development and career milestones.
Additional stability improvements.

## App Review notes — draft

This update improves save reliability, paid player-pack recovery and player profile information.

To find player packs, start or load a club career and open the Market's pack screen. Dynasty Pro and Restore Purchases are available from the game's settings/purchase surfaces. Player-pack probabilities and guarantees are shown in the game before purchase. The cosmetic Dynasty Legacy Pack is separate from the Legends player pack.

Before submitting, verify these navigation directions on the final build and add the required contact details in App Store Connect. Supply review credentials there only if the final app requires an account. Do not paste unverified claims about successful interruption testing into the review notes.

## Device acceptance record

Export an existing career first. Preserve an installation for the upgrade check. Use a separate device/installation for fresh-install and destructive tests. Record the device, OS, app version/build, result and any reproduction steps for each row.

| Test | Passing condition | Result |
|---|---|---|
| Upgrade an existing career | Same squad, money, week and progression | Pending |
| Save, close, reopen | Latest completed save restored | Pending |
| Background during saving, then resume | No permanently stuck controls or lost acknowledged save | Pending |
| Low-storage save failure | Honest failure, working export/retry, no false success | Pending |
| New career and three matches | No crash or blocked progression | Pending |
| Season rollover | Next season loads with valid squads and finances | Pending |
| World Cup and Sunday modes | Start, play, save and resume each supported mode | Pending |
| Quick-sell, Undo | Correct players and money restored | Pending |
| Quick-sell, another financial action, Undo | Later action is preserved | Pending |
| Narrow iPhone and iPad layout | All primary buttons and labels usable | Pending |
| Privacy, terms and support | Destinations open and are usable | Pending |
| Each pack: buy and cancel | Correct delivery once; cancellation grants nothing | Pending |
| Full-squad purchase recovery | Credit retained and delivered when eligible | Pending |
| Pro buy, restore and expiry | Entitlement matches sandbox state | Pending |
| Interrupt around native payment confirmation | No lost or duplicate fulfilment | Pending |

TestFlight purchases use Apple's sandbox. A confirmed-charge/JavaScript-confirmation gap remains without receipt-backed reconciliation. If an interruption loses a purchase, stop release and fix reconciliation or remove the affected purchase flow before submission. Reopening the app once is not proof that every interruption case is covered.

## Submit and monitor

After the candidate passes: create the matching App Store version, select the tested build, update copy/screenshots where needed, verify privacy and age-rating answers, complete required compliance fields, choose manual release and a seven-day phased update, then Add for Review → Submit for Review.

After approval, monitor crashes, purchase delivery and save-loss reports daily. Pause the phased rollout for confirmed save loss, missing paid items, launch crashes or blocked career progression. Pausing does not roll back installed copies and does not prevent manual downloads. Ship a corrected version when necessary.

Sources:
- https://developer.apple.com/news/upcoming-requirements/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/
- https://apps.apple.com/de/app/dynasty-manager-football/id6760918006?l=en-GB (public search snapshot, no authenticated configuration access)
