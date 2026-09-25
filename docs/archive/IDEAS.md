# IDEAS.md — Game Design & UX Review

> Senior game-designer / UX review of the live game, **v1.2.0, save schema v72**,
> conducted 2026-07-03 against the code (not the docs — several docs are stale).
> Companion docs: `UX_POLISH_REPORT.md` (visual polish/jank — not re-audited here),
> `ROADMAP.md`, `docs/retention-audit-and-plan.md`, `docs/retention-roadmap.md`.
> Where an idea below overlaps a roadmap item, that's called out — this file
> re-ranks, it doesn't pretend to invent.
>
> **Doc discrepancy found during review:** `ROADMAP.md` §0 claims a "daily
> challenge" shipped in retention v1. No daily-challenge system exists in the
> code — `src/data/challenges.ts` has 10 static scenarios with no rotation and
> no rewards, and the only wall-clock hooks are the login streak
> (`DailyRewardModal`) and real-date-keyed free packs (`packsSlice.ts:50-72`).
> Trust the code.

---

## 1. FRICTION AUDIT — the player journey

Severity: **P0** = actively costs installs/revenue/retention · **P1** = real
friction, fix soon · **P2** = polish. Ranked within each phase.

### Phase 0 — Cold open (install → first meaningful choice)

**F1 · P0 · Monetization is shown before the game is.** On the first-ever New
Game tap, a non-Pro player is routed to the full-screen Pro paywall
(`SubscribeOnboarding`) *before ModeSelect* — before they've picked a mode,
seen a club, or kicked a ball (`TitleScreen.tsx:124-127`). The only dismissal
is a small top-right X (`SubscribeOnboarding.tsx:262-270`). This is the worst
single decision in the funnel: you're asking for money from someone who has no
idea what the product is, and you're spending your one guaranteed
full-attention moment on a screen with a ~0% conversion prior. Paywalls
convert on demonstrated value (post-first-win, post-first-pack, on hitting a
Pro-gated feature), not on cold opens.

**F2 · P0 · The cold-open gauntlet is 4 decisions and ~12 taps before kickoff.**
Sequence: non-dismissible analytics consent (literal first screen,
`App.tsx:69-72`) → New Game → CommunityPackPopup ("real players vs generated"
— jargon with zero context, `TitleScreen.tsx:103-106`) → Pro paywall →
ModeSelect → 3–5 selection steps → welcome tour → dashboard → MatchPrep →
kickoff. ~12 taps across ~9 screens/modals on the *short* (Sandbox) path; the
Career path is longer (5 dense steps; the offers step alone shows salary
negotiation, board patience meters, and 3-stat grids to someone who hasn't
played a match yet, `ManagerCreation.tsx:498-762`). The roadmap's own D1
target ("first win inside 60 seconds") is not just unmet — the current flow is
architected against it.

**F3 · P1 · No beginner guidance across 756 clubs.** ClubSelection funnels
well (nation → league → club, quality-sorted, searchable), but difficulty
exists only at *league* level (`ClubSelection.tsx:836-850`); a new player
infers club difficulty from budget color and reputation dots. There is no
"recommended start", no quick-start, no "good first club" badge. Career mode
solves this (3 curated offers); Sandbox — the mode a curious first-timer taps
— doesn't.

**F4 · P1 · Weeks 1–3 are still double-booked, and the copy now admits it.**
League fixtures start week 1 (`league.ts:202-219`) while friendlies also
occupy weeks 1–3 (`league.ts:228-249`). Instead of fixing the schedule, the
onboarding checklist now says "a friendly may share the week with a league
fixture" (`OnboardingChecklist.tsx:209`) and an inbox message explains it
(`initGame.ts:387`). That's friction laundering — writing copy to excuse a
scheduling bug. A new player still plays a match, returns to the dashboard,
and finds *another* match in the same week with no calendar-level
reconciliation. The prior UX report called this the #1 "looks broken" item; it
remains open (`ROADMAP.md` §3 residual check).

**F5 · P2 · Teaching is device-global, saves are not.** The 6-panel welcome
tour fires once per *device* (`Dashboard.tsx:74,188`) and the Getting Started
XP reward pays once per device (`featureSlice.ts:164-177`). A player's second
career — the one where they actually start caring — gets no re-teaching and a
checklist that pays nothing. Also, the "Send your first scout" row silently
becomes an un-tickable "Hire your first scout" detour when the club starts
with zero scouts (`OnboardingChecklist.tsx:174-194`).

### Phase 1 — First session (first club → first match)

**F6 · P0 · The game is completely silent.** No audio library, no assets, no
sound settings; the only audio code is a permanently-unwired no-op stub
(`src/utils/packAudio.ts` — `setPackSfxHandler` is never called anywhere).
No goal sound, no whistle, no crowd, no pack-open sting, no UI ticks. Haptics
are the *only* non-visual channel, and they don't exist in the browser or on
mute-switch-irrelevant moments. For a football game whose flagship screen is a
live match, this is a top-3 immersion gap. The roadmap defers audio to v1.3
and marks it "BLOCKED" on a settings-shape change plus crowd-audio assets —
that's over-scoping the blocker. A minimal SFX set (goal, whistle, pack
reveal, button tick — 5 files, one lazy-loaded module, one toggle) is not
blocked on stadium-ambience ambitions.

**F7 · P0 · Pro's fastest match speeds silently don't work in the default
view.** Turbo (4×) and Instant (10×) are Pro-gated (`matchSpeed.ts:16-22`),
but the 2.5D pitch view — the default, headline view — floors speed at
`PITCH_VIEW_MIN_SPEED = 1500ms/min` (`matchSpeed.ts:33`, applied
`MatchDay.tsx:555`). A paying subscriber selects Instant, watches the match
run at 2× with no explanation, and correctly concludes the feature is broken.
There is also no *true* instant sim anywhere: "Instant" still ticks
minute-by-minute (~30s + pauses). This is a paid feature that under-delivers
silently — a trust problem, not a polish problem.

**F8 · P1 · Post-advance modal pile-up remains the most-repeated friction in
the game.** After every Advance Week: WeeklyDigest, then possibly
CelebrationModal, AchievementUnlockModal, MidSeasonReport, DailyRewardModal,
PressConference, StorylineModal, PlayerTransferTalk, NationalTeamOfferModal,
BoardWarning — each with its own dismiss tap, some stacking in one commit
(`Dashboard.tsx:237-313, 682-705`). This is the interaction a player performs
~46 times per season. Known since the UX report (A1) and re-flagged in the
retention audit (§3.4); still open. It gates every other "make the loop feel
good" investment — fix it first.

**F9 · P1 · Match prep is a dossier, not a decision.** MatchPrep is genuinely
rich reading (unit comparisons, H2H grudge, opponent manager style, key
threats — `MatchPrep.tsx:203-546`) but contains zero pre-kickoff verbs: no
team talk (team talks exist only at half-time/extra-time,
`MatchDay.tsx:977-1091`), no ritual decision. The emotional peak of the loop
opens with "read, then tap Play."

**F10 · P1 · Tactics affect the engine but the player is never told so
afterward.** The engine computes explicit tactical matchup bonuses (high-press
vs slow tempo, wide vs narrow, etc. — `match/helpers.ts:179-183`,
`match.ts:351-358`) and even generates `tacticalInsights` strings and AI
manager reactions *during* the match — then throws the thread away. There is
no post-match debrief connecting your tactical choices to the result. Without
a visible cause→effect loop, tactics degrade into superstition and players
set-and-forget — which the training screen already demonstrates is exactly
what happens when a system stops asking questions.

### Phase 2 — The weekly loop (sessions 1–3)

**F11 · P1 · The week requires zero decisions.** The minimum week is 1 tap
(Advance) + 1 dismiss. Everything else — lineup, tactics, training, transfers
— is optional and nudged only by attention dots (`Dashboard.tsx:665-676`).
Good for respecting time (the anti-FM26 thesis), but combined with F10 it
means the *optimal* play pattern converges on "tap Advance until a match
appears." Injuries, fitness, and chemistry do force squad churn
(`TacticsPage.tsx:117-134`), which is the loop's saving grace — but nothing
routinely pulls the player into the deep systems (merchandise, staff,
facilities) after week 1.

**F12 · P1 · Passive screens with no verbs: Board and Finance.** Board's only
interaction is "Resign" (`BoardPage.tsx:403-422`); mid-season board reviews at
weeks 15/30 adjust expectations *silently* (`gameBalance.ts:322-325`), and
sacking is checked only at season end (`playoffs.ts:9`, `seasonEnd.ts:190`) —
so the "Under pressure" warning is tension without consequence, and the player
learns to dismiss it. Finance is a dashboard with breakdown sheets.
Merchandise — one of the most interactive systems in the game — is buried as a
sub-page of Finance (`navigation.ts:17`), invisible to anyone who doesn't
wander.

**F13 · P2 · Inbox trends toward noise.** Every message type maps to a
read-and-navigate button (`InboxPage.tsx:89-101`); the only in-place action is
the unhappy-player transfer talk. Match previews/results/development messages
accumulate weekly; nothing distinguishes "FYI" from "decision required."

### Phase 3 — Day 2–7 (return hooks)

**F14 · P0 · There are exactly two wall-clock reasons to come back, and both
are invisible.** (a) The daily streak — surfaced only in a once-daily modal;
dismiss it and the streak has no presence anywhere (known gap,
retention-audit §3.1, still unbuilt). (b) Free daily packs (1× bronze/silver/
gold, real-calendar-keyed) — surfaced only if the player visits PacksPage.
Everything else in the game paces on *game weeks*: objectives, board reviews,
storylines, Ballon d'Or, season-end. A day-3 player who closed the app
mid-season has no scheduled payoff waiting and nothing on their phone telling
them one exists.

**F15 · P1 · Notifications are generic and ask at the wrong moment.**
Local-notification infra is solid (`utils/notifications.ts`, scheduled on
background, cancelled on resume) but: off by default, opt-in buried in
Settings, and the three reminders are wall-clock generic ("Your squad is
waiting") — none reference actual game state ("Your cup final vs Arsenal is
waiting", "Transfer window closes in 2 weeks — 2 offers pending"). The
roadmap's own note — ask for permission *after the first win*, framed as value
— is unbuilt; today nothing ever prompts the player to enable reminders.

**F16 · P1 · Challenges mode is dead content.** 10 well-designed scenarios
(`challenges.ts`) whose completion grants… an inbox message
(`seasonEnd.ts:1162-1165`). No XP, no cosmetic, no unlock, no featured
rotation. This is a finished retention feature with the reward wire cut, on
the title screen of every player.

**F17 · P2 · Season-end — the strongest payoff beat — is ~46 advance-cycles
away** with only cliffhanger teasers (`Dashboard.tsx:1711-1734`) and objective
cycles as intermediate beats. The distance between a day-2 player and their
first board verdict / Ballon d'Or / prestige prompt is the structural reason
the daily hooks matter so much (F14).

### Missing-feedback inventory

| Channel | State | Gaps |
|---|---|---|
| **Sound** | **None exists** (F6) | Everything. Goal, whistle, pack reveal, UI, celebration stings. |
| **Haptics** | Good coverage (339 call sites, 7 primitives, global success/error-toast haptics) | WeeklyDigest open (the main weekly payoff — silent); league-title clinch; cup-final win; record transfer; dev milestone. |
| **Celebration** | CelebrationModal + drama triggers + SeasonSummary banners | No bespoke title-clinch moment (generic "Top of the Table" only); no cup-lift for domestic finals (WC got one in 1.2.0 — the pattern exists); no record-transfer or dev-milestone moment. |
| **Progress** | Advance button exemplary; objective bars; board card; XP bars | No persistent streak indicator (F14); no season-arc "on track for objectives?" glanceable outside the board card; Pro speed floor unexplained (F7). |

### What's already strong (calibration — don't break these)

Buy-side transfer negotiation (slider + live acceptance + counters + strike
lockouts) and contract renewal are genuinely deep. Dead-end handling is
excellent: no softlocks found — min/max squad guards, unemployed-manager nav,
"limited intel" fallback for virtual opponents, thorough empty states with
next-step hints. The onboarding checklist's over-explicit walkthroughs are
best-in-class copy. Skip-to-match now suppresses intermediate digests. The
notification lifecycle (schedule on pause, cancel on resume) is correct.
MatchPrep's intel density and the key-moment system are real differentiators.

---

## 2. FEATURE IDEAS (max 10, ranked by impact ÷ effort)

Constraint honored: every idea changes player *behavior or decisions* — none
is a pure reward-number layer. Monetization invariants respected throughout
(nothing touches sim parameters).

**I1 · Post-match tactical debrief — "Why you won." (Impact: High · Effort: S-M)**
Pitch: a 3-line card in PostMatchPopup/MatchReview: which tactical matchup
fired for/against you, what the opponent manager changed, one "next time"
hint. Why: closes the choice→outcome loop (F10); players start visiting
Tactics between matches because the game finally proves tactics matter —
that's new *decisions* every week, and a reason free users care about
familiarity/presets. Builds on: the engine already computes matchup bonuses
and `tacticalInsights` strings (`match/helpers.ts:179-183`, `match.ts:1060-1074`)
— this is surfacing, not new sim.

**I2 · True Instant Sim + honest speed tiers. (High · S-M)**
Pitch: a real "Sim to full time" for Pro that resolves the match and jumps to
an enriched result card; and when the pitch-view floor clamps a paid speed,
say so ("Pitch view caps at 2× — switch to Commentary for Instant"). Why:
repairs a paid feature that silently under-delivers (F7) — churn among exactly
the users who paid; also unlocks the "season in sittings" promise that is the
game's stated positioning. Builds on: `simulateMatch()` already produces the
full result; PostMatchPopup exists; the clamp site is one function
(`MatchDay.tsx:555`).

**I3 · State-aware comeback notifications. (High · S-M)**
Pitch: on app-background, schedule reminders from the actual save: "Cup final
vs Arsenal is waiting", "Transfer window closes soon — 2 offers pending",
"3 players' contracts expire this season." Ask for permission right after the
first win, framed as value. Why: F14/F15 — the D7 lever. A notification about
*your* save's cliffhanger changes behavior (return + act on the pending
decision); "your squad is waiting" doesn't. Builds on: notification infra +
lifecycle already shipped (`utils/notifications.ts`, `main.tsx:158-188`);
cliffhanger detection already exists (`Dashboard.tsx:1711-1734`) — reuse it as
the notification source.

**I4 · Pre-kickoff team talk. (High · S)**
Pitch: the existing half-time team-talk sheet, shown once before kickoff on
high-stakes matches (derby, cup tie, six-pointer), with the existing
morale/mentality effects. Why: F9 — gives the emotional peak a decision, makes
MatchPrep's intel *actionable* (you read the dossier to pick the talk), and
creates a repeatable ritual players associate with big matches. Builds on:
`config/teamTalk.ts` + the half-time sheet UI (`MatchDay.tsx:977-1091`) —
this is re-mounting an existing component at a second phase.

**I5 · Deadline Day: the appointment session. (High · M)**
Pitch: make the final window week a bounded live event — countdown banner,
3–5 rapid incoming/outgoing offers that expire *this week*, panic-price
badges. Why: creates the game's first appointment mechanic tied to the sim
(not wall-clock), forces genuine accept/reject decisions under time pressure,
and is a natural notification hook (I3). Builds on: deadline-day mechanics
already in config (panic offers, bargains, multi-bid — `transfers.ts:116-126`)
and the pulsing Deadline Day badge (`TransferPage.tsx:266-269`) — the sim
ingredients exist; this is orchestration + UI.

**I6 · Board meetings with asks and promises. (Med-High · M)**
Pitch: at the existing week-15/30 review points, an interactive board meeting:
board states its read; player can *ask* (transfer funds, patience, facility
co-funding) or *promise* (top-4, cup run) — promises tracked and settled at
season end with confidence/budget consequences. Why: F12 — converts the
game's most passive screen into its highest-stakes recurring decision, and
gives the confidence meter teeth without adding mid-season sackings. Builds
on: `BOARD_REVIEW_WEEKS` already fire (`gameBalance.ts:322-325`), board
confidence/objectives systems, the press-conference choice-modal pattern.

**I7 · Challenge rewards + featured weekly challenge. (Med · S)**
Pitch: give the 10 scenarios XP + a cosmetic badge each, show completion state
on the picker, and rotate one "Featured Challenge" weekly (deterministic by
real date, like the pack rotation). Why: F16 — converts finished dead content
into a replayable short-session mode; a featured rotation changes which mode
players open and gives lapsed players a bounded re-entry ("just one
scenario"). Builds on: `challenges.ts` + `checkChallengeFailed` + the
completion tracking that already exists; XP/achievement grant paths.

**I8 · Player promises. (Med-High · M-L)**
Pitch: extend the unhappy-player transfer talk into trackable promises
("you'll start 8 of the next 10", "we'll sign a winger", "sell you in
January"), with morale/dressing-room fallout on breach. Why: turns lineup
selection and window planning into commitments — the strongest possible
"decisions with consequences" mechanic, and the anti-FM26 "consequences stick"
thesis applied to the squad. Builds on: `PlayerTransferTalk` in-place actions,
morale system, storyline-chain effect plumbing (`storylineChains.ts` already
applies playerMorale/board effects from choices).

**I9 · Duplicate-aware pack economy. (Med · M)**
Pitch: when a pack pulls a player you already own (or a clear non-upgrade),
offer "Convert" into a soft pack-credit that funds bronze/silver opens or
cosmetic pack art — never sim boosts. Why: today dupes just silt up the squad
and quick-sell is the only sink; a convert-vs-keep choice makes every open end
in a decision and gives free players a reason to open daily (feeds F14).
Builds on: `releasePackedPlayer` path, the "+X OVR vs best at position"
badge shipped in 1.1.1 (upgrade detection exists), pack tier configs.
Guardrail: keep credits off the entitlement system entirely (consumable-style
device state), per the monetization invariants.

**I10 · "Continue where you left off" resume card. (Med · S)**
Pitch: on load, one card that deep-links into the highest-priority pending
decision (incomplete lineup → Tactics; pending offer → Transfers; cup final →
MatchPrep). Why: re-entry friction is where day-2 sessions die; landing a
returning player directly in a decision beats landing them on a dashboard of
tiles. Builds on: the quick-link badge logic already computes exactly these
states (`Dashboard.tsx:665-676`); this is a reordering of existing signals.
(Roadmap D1 item; endorsed and re-ranked here.)

Deliberately *not* on the list: Manager Pass, TopBar streak flame, richer
Dynasty Legacy, Create-a-Club — already planned and correctly sequenced in
`ROADMAP.md`/`docs/retention-audit-and-plan.md`; and audio, which is F6/QW
territory rather than a "feature idea."

---

## 3. QUICK WINS — top 3 under ~2 hours each

**QW1 · Move the paywall out of the cold open.** Change the routing decision
in `TitleScreen.tsx:124-127` so first-time players go straight to ModeSelect;
set the `SUBSCRIBE_ONBOARDING_SEEN` trigger to fire after the first match
result (or first week advance) instead. One flag-check relocation, no new UI.
Highest goodwill-per-line change available: every new player currently pays
this tax at minute zero (F1), and post-first-win is a strictly better
conversion moment.

**QW2 · Surface the tactical insight line in the post-match flow.** The match
already generates `tacticalInsights` strings and AI-reaction events
(`match.ts:1060-1074`); render the top one as a single line in
PostMatchPopup ("Your high press overwhelmed their slow build-up"). This is
the 2-hour version of I1 — it makes tactics visibly matter (F10) with zero new
sim work, and instantly upgrades every match's payoff.

**QW3 · Make the streak visible: flame + count in the TopBar.** Reads
`readDailyStreak()`, renders a flame icon + day count, pulses when today is
unclaimed. Already specced as "small" in `docs/retention-audit-and-plan.md`
§3.1; it's the missing half of the only daily mechanic the game has (F14) —
loss aversion doesn't work if the thing you'd lose is invisible.

Runner-up (~2h, do it with QW3): `hapticSuccess()` on WeeklyDigest open and a
bespoke title-clinch celebration variant — the two loudest silent moments in
the feedback inventory.

---

*Review method: four parallel code-exploration passes (first-launch funnel;
core loop + feedback channels; progression/retention; decision depth +
dead-ends) over `src/`, cross-checked against LEARNINGS.md, ROADMAP.md, and
the retention docs. No code was modified. TASK.md does not exist in this repo
(nothing was added to it, per the task rules).*
