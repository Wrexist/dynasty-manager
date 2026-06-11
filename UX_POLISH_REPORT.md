# Dynasty Manager — UX Polish Report

> Code-level review (visual run-through findings appended separately).
> Builds past AUDIT_REPORT.md §12/§13 — no overlap with already-filed bugs.

## (A) Stutter/jank risks, ranked

**A1 [HIGH] Post-advance feedback pile-up.** WeeklyDigest (z-[55], `WeeklyDigest.tsx:144`), achievement modals (z-50), CelebrationModal (z-50) and staggered toasts all fire in the same commit after `advanceWeek` (`Dashboard.tsx:234-310, 693`). An achievement modal mounts and plays its entrance INVISIBLY behind the digest backdrop — `hapticHeavy()` fires with nothing visibly changing; the modal is revealed mid-life after the digest closes. Two stacked fullscreen backdrop-blurs compound GPU cost. Fix: single post-advance presentation queue (digest → celebration → achievements → toasts).

**A2 [HIGH] MatchDay re-renders the whole tree every 20ms at Instant speed.** Ticker `setCurrentMin` re-renders ~1,700 lines 50×/sec; the event log (`MatchDay.tsx:1551-1568`) rebuilds `visibleEvents.filter().map()` per render and `CommentaryRow` is not memo()-wrapped (nor ScoreHeader/MatchSpeedPicker/TacticalPanel). Late match = ~100 rows × chips × flag imgs reconciled 50×/sec. Fix: memo(CommentaryRow), memoize row array on [visibleEvents], window to last N rows during live play.

**A3 [MED-HIGH] "Skip to Next Match" has no pending UI.** Main Advance button is exemplary (sync isAdvancing, 50ms paint kickoff, CSS spinner, completion pulse — `Dashboard.tsx:1043-1066`). The skip handler (`Dashboard.tsx:1068-1084`) never sets isAdvancing: tap → frozen screen up to ~1.5s (5 chained week sims) → week counter teleports. Intermediate weeks flash through. Fix: share isAdvancing + "Skipping to match week…" label; suppress intermediate digests during the loop.

**A4 [MED] Tab switches are hard cuts that replay mount staggers.** GameShell renders without transitions (`GameShell.tsx:313-321` — right call to skip AnimatePresence) but screens pop at frame 1 while nav pills animate; every return to Dashboard/Squad replays entrance staggers (`Dashboard.tsx:697+`, `SquadPage.tsx:417-419`). Fix: 120-150ms enter-only fade/4px rise + first-visit-only staggers (module-scope ref).

**A5 [MED] Perf mode kills transforms but not opacity loops.** `MotionConfig reducedMotion="always"` doesn't stop infinite opacity/filter loops: negotiation pulse rings (`TransferNegotiation.tsx:464,480` + Loan/IncomingOffer equivalents), `TalentTree.tsx:239`, `PackCard.tsx:161`, `PackShopCard.tsx:126`, pity pulse (`PackOpeningOverlay.tsx:1096`); WeeklyDigest has no reduced-motion awareness. The pack flow itself is exemplary (10+ explicit gates).

**Images:** clean overall (procedural avatars, lazy flags with dimensions). Gap: no fade-in on flag/pack art load; PackArt lacks intrinsic aspect-ratio (`pack/PackArt.tsx:26-41`).

## (B) Consistency gaps

- **B1 Motion vocabulary:** 36+ distinct durations; springs 220-500/12-38 with no rationale; near-identical reward modals use different springs/rotations/delays. `PACK_ANIM` (`config/packs.ts:195-231`) proves centralization works — nothing equivalent app-wide.
- **B2 LiquidButton used on exactly 2 screens** (AnalyticsConsentModal, SettingsPage) — none of the money paths (Dashboard Advance, pack CTA, SubscribeOnboarding purchase, negotiation submits). Three button systems on revenue-adjacent screens.
- **B3 Rating-color convention re-implemented ~6× with drifting thresholds** (canonical `utils/uiHelpers.ts:36-76`; variants in PlayerTransferTalk, SubstitutionSheet, YouthAcademy, TacticsPage). Same number = different color on adjacent screens.
- **B4 FinancePage inlines `£…toFixed()` 11 times** (lines 99-257) instead of `formatMoney`; Dashboard 3×; pack messages use toLocaleString. Negatives render differently per path.
- **B5 Gold diluted:** `primary` in 179 files, mostly selection states; Ballon d'Or/Pro/pack moments lose contrast.
- **B6 Glass/radius drift:** ~17 files compose ad-hoc `bg-card/60 backdrop-blur` instead of GlassPanel; radius mixes lg/xl/2xl on Dashboard/MatchDay/modals.
- **B7 Toasts:** no Sonner limit/gap config; pack failure paths can rapid-fire 2-3 error toasts; quick-sell fires success+undo back-to-back; dead shadcn toaster still mounted. Haptics coverage of premium moments is genuinely good.

## (C) Missing/weak states

1. TitleScreen slot picker can flash empty during IDB hydration ("no saves" heart-stopper, `TitleScreen.tsx:70-80`).
2. Commentary rows snap in with `instant` scrollIntoView — a goal lands with the visual weight of a throw-in (`MatchDay.tsx:551`).
3. TrophyCabinet empty state is plain text — should sell the dream.
4. YouthAcademy with 0 prospects renders zero-stats with no copy.
5. Skeleton system is well-built but has one consumer; cold-chunk loads show generic blocks.
6. Verified clean: init LoadingOverlay, no zero-budget frames, designed Suspense fallbacks.

## (D) Top-10 premium upgrades (feel-per-effort)

1. **Post-advance presentation queue** (M) — fixes the hidden-modal bug outright. `Dashboard.tsx:215-310,693,800-812`.
2. **Enter-only screen transition + first-visit-only staggers** (S) — `GameShell.tsx:317-321`, `SquadPage.tsx:417-419`. Biggest native-feel win per line.
3. **memo(CommentaryRow) + row memo + last-N windowing** (S) — de-jitters the flagship live screen.
4. **Shared MOTION presets in config/ui.ts** (S) — modeled on PACK_ANIM; migrate the reward modals + digest first.
5. **Goal moment upgrade** (M) — animated goal row + score digit count-up; reuse CountUpMoney pattern.
6. **Count-up money everywhere it changes** (S) — extract CountUpMoney → shared; Dashboard budget, FinancePage totals, transfer fees.
7. **Skip-to-match pending state** (S) — `Dashboard.tsx:1068-1084`.
8. **LiquidButton on the money paths** (S) — one button language across paid surfaces.
9. **Toaster limit=3 + 500ms same-title dedupe + inline pack errors; remove dead shadcn toaster** (S).
10. **Sell-the-dream empty states + hydration shimmer** (S) — TrophyCabinet, YouthAcademy, TitleScreen.

**Single highest-leverage item: #1** — it's the moment players hit every week, and it currently fires haptics for an invisible modal while toasts rain on top.
