# TestFlight 1.6.1 (193) — device test gate

Candidate source: `eca1f924597d90d9a84fe475f842293f3021f56d` on `fix/limited-deal-covers`.
[Build pipeline](https://github.com/Wrexist/dynasty-manager/actions/runs/36051622216).
[Processed TestFlight build](https://appstoreconnect.apple.com/teams/47a0adf3-7006-447c-8543-48214a1a243d/apps/6760918006/testflight/ios/744efb13-98cf-4f47-89e3-a4482c61d2e4).
Marketing version: 1.6.1 via the workflow override. Developer tools: off.

## Status

- Local preflight: passed (3,240 tests passed, 3 skipped; production build and bundle limits passed).
- Browser smoke test: passed at 375×812; Continue Free is visible, 44px high, and opens mode selection.
- macOS full release validation, signed archive and upload: passed. Workflow 193 completed successfully; upload confirmed at 20:30 UTC on September 24.
- Apple processing: Complete. Build 1.6.1 (193) is assigned to the existing `Iternal` internal group with one tester; verified in the build detail page. It is ready for internal TestFlight installation. The `Ready to Submit` label does not mean it has been submitted for external testing or App Review.
- Real-device testing: not performed by the agent; no iOS device host is available in this Windows environment.
- App Review and screenshot experiment: not submitted. Do not submit until device testing passes.

## What changed in this candidate

- The Pro welcome screen now visibly offers Continue Free instead of an icon-only dismissal.
- The free button uses a 44px minimum tap target. Payment, entitlement, restoration and navigation handlers are unchanged.
- The current branch also includes newer player-card portrait work after the previous TestFlight candidate, 1.6.0 (192). Inspect portraits as part of this test.

## Device checks

Record the device model, iOS version, build number and result for each scenario. Keep an existing save safe; use a separate device or spare save slot for clean-start testing.

| Scenario | Pass condition | Result |
|---|---|---|
| Update from 1.6.0 | Existing career loads and remains intact after force-close/reopen | Pending |
| Cold launch | No immediate exit, endless splash or empty save-slot skeleton | Pending |
| New career | Continue Free is visible; tapping it opens mode selection without purchase | Pending |
| Small screen / large text | Free button, prices, legal links and purchase controls remain readable and reachable | Pending |
| Sandbox purchase / restore | Correct plan and entitlement; restore survives relaunch | Pending |
| Purchase cancellation | No false success or entitlement change; the player can still continue free | Pending |
| Unavailable store / network | Clear fallback, no stuck loading and a usable free path | Pending |
| Match progression | Kick-off, halftime, full-time and advance to the next fixture work | Pending |
| Mid-season / depleted squad | Resume around rounds 20–23 and advance through an injury-heavy fixture | Pending |
| Portraits | Cards, lineup and pack views display the new assets correctly on iPhone and iPad | Pending |

Use Apple's TestFlight sandbox for purchase checks. Record failures before changing the candidate; a replacement build needs its own build number and test result.

## Why launch and mid-season progression matter

On September 24, [App Store Connect ratings](https://appstoreconnect.apple.com/apps/6760918006/distribution/ratings/ios) showed 4.4/5 across 14 ratings and four written reviews. A Mexico review dated July 29 on version 1.2.5 reported exiting immediately after opening. A Serbia review dated August 23 on 1.3.0 reported being unable to continue at round 22; the August 27 developer response said it was fixed in 1.4.0. Another review liked the depth but wanted less text and a simpler presentation.

These are individual reports, not reproduced defects in this candidate or proof of the conversion decline's cause. Existing cold-open, launch-configuration and match-startability regression tests passed in local preflight; the device checks above are still required.
