# GOALS.md — Dynasty Manager

> The execution list. Authored 2026-07-09 against **v1.2.0, save schema v72**, from a
> full-app audit (10 domain passes + competitive benchmark, every claim verified at
> file:line in live code). This file **supersedes** the open items in `ROADMAP.md`,
> `IDEAS.md`, and the `AUDIT*`/`UX_POLISH` reports — when they disagree, this file wins.
> Work the goals **in order**. When a goal ships, mark it done here; don't let this
> file rot.
>
> Run `/goals` in a Claude session to pick up the next goal.

## Where the app actually stands

The engineering is strong and most historical correctness debt is **closed** (verified:
loan-return wipe, continental finals, advance double-fire, training caps, finance
double-counts, localStorage hygiene, match-result persistence — see "Corrected record"
at the bottom before re-planning anything). What separates this from "best on the
market" is not missing features — it's shipped features that silently under-deliver at
exactly the moments that decide trust, revenue, and retention: the paywall fires before
gameplay, a paid transfer keeps the player's old contract, the flagship match is silent
while a proven SFX engine sits unwired, the weekly loop collapses to spamming Advance,
and the highest-LTV player has no backup for a multi-season dynasty.

---

## G1 — Kill the cold-open paywall, compress the funnel

> ✅ **Shipped 2026-07-10** — paywall deferred to post-first-match (`utils/paywallTiming.ts`), slot guard, inline community-pack toggle, one-card welcome, mode-aware copy.

**Why.** The worst trust-and-revenue defect in the app (flagged P0 independently by two
audit passes). A full-screen Pro paywall fires before the player has picked a mode,
seen a club, or kicked a ball (`TitleScreen.tsx:110-127` → `/subscribe` before
`/mode-select`). The cold open measures **12 taps / 9 screens** to first kickoff, with
three blocking modals before mode select. Paywalls convert on demonstrated value; the
contextual `ProUpsell`s at gated features already do this right.

**Scope.**
- Route first-time New Game straight to `/mode-select`; fire `SUBSCRIBE_ONBOARDING_SEEN`
  once after the **first match result** (or first Gold+ walkout) instead.
- Close the save-overwrite hole: `SubscribeOnboarding.tsx:111-114` defaults
  `slot ?? 1` with no missing-slot guard — a webview reload on `#/subscribe` can
  clobber slot 1. Mirror the guard ModeSelect/ClubSelection/WorldCupSetup already have.
- Fold the community-pack popup into ClubSelection (inline toggle); default the welcome
  tour to one dismissible card. Target **< 6 taps** to kickoff.
- Mode-aware copy: the Sandbox path says "Begin Career" / "Setting up your career…"
  (`ClubSelection.tsx:709,281,315`).

**Done when:** paywall never appears before the first match or pack reveal ·
SubscribeOnboarding redirects to title on missing slot · < 6 taps to kickoff on the
Sandbox path · Sandbox copy says club/start, not career.

**Risk:** low — `returnTo` plumbing exists; the only care point is making the deferred
paywall fire exactly once.

---

## G2 — Fix paid mechanics that silently under-deliver

> ✅ **Shipped 2026-07-10** — fresh contracts on paid signings (`transferSlice` + `getSignedWage`), null-safe subscription sync (4 sites + listener), shared negotiation-odds math, stranded-pack recovery toast, honest Starter Kit.

**Why.** The player pays — money or a core decision — and silently gets less than
promised. Verified cluster:
- A **fee-paid signing keeps his old wage and old `contractEnd`**
  (`transferSlice.ts:363-370`; contrast `signFreeAgent` at `:616` which sets both).
  Pay £50M for a final-year player and he walks free at season end, no warning.
- **Active subscribers transiently lose Pro** on any RevenueCat sync hiccup:
  `updateSubscription(extractSubscriptionInfo(info))` writes `null` unguarded on every
  load (`GameShell.tsx:215`, also `ShopPage:110`, `SubscribeOnboarding:143`,
  `SettingsPage:234`).
- Negotiation modal shows accept-odds that **ignore the strike penalty** the resolver
  applies (`TransferNegotiation.tsx:102` vs `transferSlice.ts:281-287`) — players bid
  into a wall the UI says is open.
- A crash-stranded **paid pack has no recovery path** — the reconciler just re-fails and
  re-fires Sentry per mount (`PacksPage.tsx:148-154`, `packsSlice.ts:224-232`).
- **Starter Kit "Limited Offer" is the identical product at the identical price**
  (`monetization.ts:308-313` vs `:66`) — fake urgency.

**Scope.** Personal-terms step (or fresh `contractEnd` + visible remaining-contract
before commit) on the buy flow · guard all four `updateSubscription` sites
(`if (sub) update…`, only clear on confirmed revocation) · route the displayed accept-%
through the same effective-price + strike math as the resolver · actionable toast +
once-per-marker Sentry for stranded packs · make Starter Kit a real discount or drop
the countdown framing.

**Done when:** a paid signing joins on a fresh contract and the UI shows remaining
contract pre-commit · a transient null customerInfo never clears an active sub · shown
odds match the roll · stranded packs tell the user how to claim · Starter Kit is honest.

**Risk:** contract change touches wageBill/FFP math; if the persisted shape grows a
field, bump `CURRENT_VERSION` + migration. Test season-end expiry after a mid-season buy.

---

## G3 — Turn the weekly loop from a button-tap into a game you play

> ✅ **Shipped 2026-07-10** — friendlies dodge occupied weeks (all 45 leagues verified), lineup-aware auto-sim, board ultimatums with mid-season sack (schema v73), one-at-a-time presentation queue, pre-kickoff team talks, free tactical debrief.

**Why.** The interaction performed ~46×/season. Today the optimal week is "tap Advance
until a match appears": MatchPrep has zero verbs, board pressure has no mid-season
consequence, and one Advance can stack ~10 independent dismiss-tap modals with haptics
firing for invisible ones (`Dashboard.tsx:685-826`). Two first-session trust bugs live
here: **weeks 1–3 are still double-booked** (league round 1 = week 1 at
`league.ts:167` while friendlies occupy weeks 1–3 at `:236` — the "fix" was excuse
copy, not a schedule fix), and the collision auto-sim **ignores the player's chosen
lineup** (`weekAdvance.ts:1106-1132` uses roster order).

**Scope.**
- Reconcile the calendar: no week ever shows two interactive matches (pre-season
  friendly block, or league starts week 4 as the cup calendar already assumes).
  ⚠ Interacts with cup-week choreography (`cup.ts`, week 43 final) — verify collisions.
- Single ordered **post-advance presentation queue** derived from the existing
  `pending*` flags — one modal at a time, haptics only for the visible one. No
  state-shape change.
- **Pre-kickoff team talk** on high-stakes matches (derby/cup/six-pointer): re-mount the
  existing half-time sheet in the pre phase, same `matchTeamTalk` effects.
- **Free post-match tactical debrief**: the engine already computes
  `tacticalInsight` + `ai_tactical_change` events and throws them away
  (`match.ts:352-367,1063-1072`). Render the top line in PostMatchPopup — closes the
  choice→outcome loop that makes tactics matter.
- **Mid-season board teeth**: ultimatum objective at `BOARD_REVIEW_WEEKS`
  (`weekAdvance.ts:2417-2470` is currently message-only) and a mid-season sack path at
  rock-bottom confidence via the existing career machinery.
- Collision auto-sim builds its XI from `club.lineup`, not roster order.

**Done when:** a new player never sees two matches in one week · one Advance presents
modals sequentially · big matches offer a pre-kickoff talk · free users see the tactical
debrief · sustained rock-bottom confidence can end in a mid-season sacking.

---

## G4 — Wire the shipped audio engine game-wide; generalize the trophy ceremony

> ✅ **Shipped 2026-07-10** — global sound-setting sync, pack-walkout SFX handler registered, live-match audio (whistles/roar/groan/crowd bed), celebration + digest cues, reusable `TrophyLift` + `TrophyCeremonyModal` for titles and cup wins. *Needs one on-device listening pass.*

**Why.** The highest immersion-per-line change available. A fully built procedural SFX
engine (`sfx.ts`) shipped with the shootout and is wired to <5% of the game. The
flagship 90-minute match is **silent**. The monetized pack walkout is silent because
`setPackSfxHandler` is **never registered** (`packAudio.ts:31`; `packsSlice.ts:355`
fires cues into the void). `WorldCupResult.tsx:144-182` proves the trophy-lift pattern
— but league titles and domestic cups get a generic modal.

**Scope.** Register the pack SFX handler at app init · live-match audio (crowd bed,
kickoff/full-time whistle, goal roar/net, concede groan) hooked into MatchDay's
existing goal-detection effect (`MatchDay.tsx:597-613`) · sync `setSfxEnabled` from the
persisted `soundEnabled` at init (today it's only synced by entering a shootout —
`sfx.ts:20`) · `sfxRoar` in CelebrationModal + haptic/chime on WeeklyDigest ·
generalize the WC trophy-lift for confirmed league titles and cup-final wins · broaden
the Settings "Sound effects" description.

**Done when:** packs, matches, celebrations, and the digest all sound off (gated on the
setting) · a sound-off user hears nothing even pre-shootout · winning the league or a
domestic cup gets a real trophy-lift + roar.

**Risk:** audio annoys if over-fired — crowd bed low, strict setting gate. iOS autoplay
unlock already handled via `resumeSfx`.

---

## G5 — Keep retention systems alive and make them personal

> ✅ **Shipped 2026-07-10** — deterministic monthly festivals (never-dark) + teaser, challenge XP/badges + weekly featured rotation, save-aware comeback notifications + first-win permission ask, resume card, daily-pack dot.

**Why.** Shipped retention pillars are dead or generic. The **entire festival
subsystem goes permanently dark on 2026-07-19** — ten days out — with nothing queued
(`liveEvents.ts:56,68`: one event in `LIVE_EVENTS`). Ten authored challenge scenarios
grant **only an inbox message** (`seasonEnd.ts:1163-1165`; no reward field on
`ChallengeScenario`, `types/game.ts:1502`). Comeback notifications never reference the
save ("your squad is waiting" instead of "your cup final vs Arsenal is waiting"), and
permission is never requested at the first-win peak
(`notifications.ts:75-80,162-165`; `matchProcessing.ts:247` milestone exists).

**Scope.** Deterministic recurring live event (real-month keyed, like pack rotation) +
"next event in N days" teaser so surfaces never go empty · challenge rewards
(`rewardXp` + badge, persisted completion, featured weekly rotation) · save-derived
cliffhanger notifications (reuse the Dashboard cliffhanger detector + pending offers +
expiring contracts) with a value-framed permission ask after the first win · a
"Continue where you left off" resume card deep-linking the top pending decision
(reuse `quickLinkBadges` priority, `Dashboard.tsx:665-676`) · surface free-daily-pack
availability on the Dashboard.

**Done when:** festival surfaces never go empty post-WC · completing a challenge pays
XP + badge and shows on the picker · inactivity notifications cite actual save state ·
returning players land on one ranked resume card.

---

## G6 — Protect the deep player's dynasty from data loss

> ✅ **Shipped 2026-07-10** — export/import in Settings with full validation chain, `preMatchSnapshot` persisted, validated backup rotation. *Cloud backup remains the deferred larger arc (by design).*

**Why.** The highest-LTV player — ten seasons in, most likely to review — loses
everything on a lost phone or iOS IndexedDB eviction. No cloud save, no export
(verified: zero account/sync code). This is the "lost my save" 1-star generator and it
undercuts the entire multi-season-dynasty pitch. Compounding bugs, verified: the
Invincible-perk **pre-match snapshot is restored on load and widened by the v72
migration but never written by save** (`orchestrationSlice.ts:192-307` payload lacks it;
`:915` restores it) — silently lost on any background. And the **single-backup rotation
can burn the last-known-good backup** if two bad saves land consecutively
(`persistence.ts:698-711`).

**Scope.** Ship **export/import of the active slot** first (zero backend, immediate
safety net, through `persistence.ts` + `migrateSaveData`) · add `preMatchSnapshot` to
the save payload (it's null outside the play→post-match window, so cost is bounded) ·
gate backup rotation on `validateSaveShape` (or a validated 2-deep ring) · then the
larger arc: opt-in cloud backup (anonymous Sign in with Apple + encrypted upload +
restore-on-reinstall) — which also unblocks the v2.0 online track.

**Done when:** a save exports and re-imports cleanly · the Invincible rewind survives a
reload · two consecutive bad autosaves can't destroy the last valid backup · (stretch)
cloud backup restores a career on a fresh install.

---

## G7 — Seize the closing World Cup window; sharpen the market wedge

> ✅ **Shipped 2026-07-10 (engineering + drafts)** — canvas share cards on WC final + shootout wins; `marketing/aso/wc-2026-refresh.md` has paste-ready EN/ES/PT metadata. *Owner action: paste metadata into App Store Connect + capture the 5 screenshots before the WC final.*

**Why.** The real WC 2026 is on air for **only a few more weeks** and this is the only
major mobile football manager with a native WC-2026 mode. Two zero-engineering wedges
compound it: the game already *has* the no-energy/no-rest-pack loop Top Eleven players
resent but doesn't sell it, and FM26 Mobile is Netflix-gated — "FM depth, no
subscription" search demand is unserved. Marketing value decays to ~zero after the
final; this is ASO/creative work first, engineering second.

**Scope.** ASO refresh NOW (WC title/subtitle/keywords/screenshots; localize metadata
ES + PT for WC traffic) · lead with "No energy timers. No rest packs. No waiting." and
the no-Netflix wedge · one-tap **share card** for the shootout winner and WC-final
trophy (Capture Studio infra exists, `git 86aebf0`).

**Done when:** store listing reflects WC mode + no-grind pillar with ES/PT metadata
before the WC final · a shootout/WC-final moment shares in one tap.

**Guardrail:** this never displaces G1/G2 — creative work parallelizes; engineering
doesn't.

---

## Quick wins (each < ~2h, independent of the goals)

> ✅ All six shipped 2026-07-10 (1–5 inside their parent goals; 6 standalone — dead shadcn toast system removed, ~4.9 kB gz saved).

1. Remove the `/subscribe` branch in `TitleScreen.tsx:110-127` (G1's core one-liner).
2. Register `setPackSfxHandler` in `main.tsx` → the monetized walkout becomes audible
   with zero new assets (`packAudio.ts:31`).
3. Add `preMatchSnapshot: state.preMatchSnapshot` to the save payload
   (`orchestrationSlice.ts:192`) — load-restore and the v72 migration already expect it.
4. Guard `updateSubscription` at `GameShell.tsx:215` (+ ShopPage:110,
   SubscribeOnboarding:143, SettingsPage:234): `const sub = extractSubscriptionInfo(info);
   if (sub) updateSubscription(sub)`.
5. Add the missing-slot redirect to `SubscribeOnboarding.tsx:111-114`.
6. Delete the dead shadcn `<Toaster/>` (`App.tsx` + `ui/toast.tsx`, `toaster.tsx`,
   `use-toast.ts`) — all toasts use Sonner; drops `@radix-ui/react-toast` (~69.5 kB gz)
   from the near-limit main chunk.

## Do NOT do (declined on purpose — keep the plan clean)

- **Server-authoritative online leagues** — v2.0 scope; ship export/cloud backup and
  async leaderboards first.
- **Full i18n** — ES/PT *store metadata* only for the WC window; string extraction is a
  v1.3+ track.
- **LOC refactors of `weekAdvance.ts`/`Dashboard.tsx` for their own sake** — dev-velocity
  debt, not user-visible; peel helpers opportunistically.
- **Bumping the eager main-chunk limit again** — delete the dead Toaster and chase leaks
  instead.
- **RevenueCat hosted paywall** — banned (Apple 3.1.2(c)), permanently.
- **Create-a-Club before G1/G2 land** — differentiation, not trust; correctly sequenced
  in ROADMAP v1.3.
- **"Fixing" the pitch-view speed clamp as a broken paid feature** — it isn't one: the
  default commentary view runs paid speeds unclamped and a true Pro "Sim to full time"
  exists (`MatchPrep.tsx:584-593`). Just *communicate* the pitch-view cap.

## Corrected record (verified 2026-07-09 — do not re-plan these)

- **Match-speed "broken paid speeds" (IDEAS F7): stale.** Default commentary view runs
  Turbo/Instant unclamped; true instant sim exists. Residual = an uncommunicated
  pitch-view cap only.
- **"Match results lost on reload": fixed.** `playCurrentMatch` saves at full time on
  every path; autoSave defaults true (`coreSlice.ts:37`).
- **Shipped and verified:** advance double-fire fix, loan-return at season end,
  continental AI finals + catch-up, bye-free cup bracket, interactive shootout,
  deep-link slot guards on ModeSelect/ClubSelection/WorldCupSetup, WelcomeOverlay Skip,
  training caps at potential, staff-bonus morale factors, single-sourced league prize,
  merchandise double-count, `formatMoney` millions/negatives, idle-poll gating,
  localStorage hygiene (ESLint-enforced), test backfill (suite now 136 files).
- **Streak visibility (IDEAS QW3): partially shipped** — flame + count live via
  `DynastyStatusChip`; only the free-daily-pack surface remains (folded into G5).
- **Doc drift:** save schema is **v72** (`saveMigration.ts:14`), app **v1.2.0** — older
  docs citing v71/v1.0.x are stale.
