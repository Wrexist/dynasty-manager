# Game Audit — July 2026

> Five parallel audits (notification noise, UX clarity, weekly-loop depth,
> late-game progression, feature-fit) run 2026-07-17. Findings are grounded in
> code as of `main` @ a7704f9. The "shipped now" section lists what this
> branch already fixes; everything else is the backlog.

## Headline diagnosis

1. **Noise:** the game reports the same weekly facts through four channels
   (inbox, WeeklyDigest, blocking modal queue, toasts). The digest was the
   right batching mechanism, but the inbox duplicated it, the unread badge
   counted everything equally, and a press conference fired after **every**
   match (~40 blocking 3-option modals per season).
2. **Confusion:** not a lack of help content — an attention-budget problem.
   S1W1 fired 4–5 competing "do this next" systems at once; the Board screen
   (sacking risk) was collapsed away for exactly the players who need it; the
   sacking threshold was stated as 40/35/25/10 in four different places while
   the real numbers are 20 (season end) and 18 (ultimatum).
3. **Depth:** the interactive match is genuinely deep, but between matches the
   optimal play is tapping Advance. Training is a week-1 set-and-forget
   (streaks punish change), transfers are closed ~70% of the season, and
   press/team-talk "decisions" have dominant options.
4. **Late game:** every progression bar fills and freezes. Talent tree done by
   ~season 7–8 with zero XP sink after; 33 one-shot achievements exhausted by
   ~season 5; facilities/reputation/legacy all cap; prestige (the only NG+
   loop) is destructive-only and gated behind winning the league.

## Shipped in this branch (noise + clarity quick wins)

- Press conferences gated to notable matches (derby, cup tie, 3+ goal margin,
  drama beat, else 15% chance; never for friendlies) — cuts ~70% of the
  highest-frequency interruption. `PRESS_NOTABLE_MARGIN` /
  `PRESS_ROUTINE_CHANCE` in `gameBalance.ts`.
- Deleted inbox duplicates of WeeklyDigest facts (players improved/declining,
  training injuries, injury recoveries).
- Removed the manufactured "Steady Week"-style filler message on quiet weeks.
- Contract warnings batched to one message per warning week instead of one
  per player per week (up to 16/season for the same players).
- Sacking-risk copy unified: Dashboard tile, HELP_TEXTS, and Game Guide now
  all derive from `BOARD_SACKING_THRESHOLD` (20) / `CONFIDENCE_CRITICAL_THRESHOLD` (35).
- "Fam" chip spelled out (Familiarity) with InfoTip; ChemistryBar gained an
  InfoTip; Board screen no longer collapsed in the More drawer for new
  players; "Skip to Next Match" states it advances several weeks; Coach
  Checklist + Manager Tips suppressed on S1W1 so the OnboardingChecklist is
  the single first-week guide.

## Backlog: remaining audit findings (not yet implemented)

| Finding | Severity | Effort |
|---|---|---|
| Collapse non-decision overlays (celebration/achievement/gemReveal) into WeeklyDigest — post-advance tap gauntlet is still 2–4 modals on busy weeks | high | large |
| `Message.priority` tier (`action`/`info`/`log`) + badge counts only action items + per-category mute in Settings (needs save-schema bump) | medium | medium |
| Dashboard attention hierarchy beyond S1W1 (30 conditional panels; gate secondary panels behind "Show More Details") | high | medium |
| Quick Links vs BottomNav duplication (Squad/Tactics/Transfers tiles duplicate tabs; Staff/Youth/Scouting have no top-level entry) | high | medium |
| Training: taper streak bonus / add weekly load tradeoff so the Training page is a live decision | high | medium |
| Out-of-window squad actions (renewals, loan recalls, youth promotions surfaced as prompts) so ~27 closed-window weeks keep decisions | high | medium |
| Press conference answers get remembered consequences (media narrative state) instead of transient morale | medium | small |
| Team talks read player state (morale/fitness) instead of scoreline; widen `demand` risk | medium | small |
| Key-moment aggressive packages get a sticky cost (concede-risk window, fitness drain) | medium | small |

## Ranked feature list (top 10)

Full pros/cons in the PR/chat deliverable. Ranked by impact-per-effort and
fit with existing scaffolding:

1. **Endless progression pack** — tiered achievements (wins 100/250/500,
   titles 3/5/10…), talent-tree Mastery ranks as a permanent XP sink,
   legacy tiers past Immortal.
2. **Captaincy & the armband** — leadership stat + armband art already exist.
3. **Named nemesis rival** — dramatize the existing `rivalries`/grudgeLevel data.
4. **Youth Intake Day** — annual reveal event reusing pack-walkout tech +
   academy-level arc so intake quality grows across seasons.
5. **Dynasty Pass** — free seasonal reward track cloning the offline festival
   pattern (sim-neutral, optional premium tier later).
6. **"Cement the Legacy" prestige path** — non-destructive NG+ at your club;
   unlocks prestige perks without wiping the save; offered from top-3 finishes.
7. **Pre-season friendlies & summer tour** — offseason choice with
   income/chemistry/injury tradeoffs.
8. **Player promises** — tracked commitments from contract/transfer talks
   with kept/broken consequences.
9. **Squad numbers & retired shirts** — persistent squad identity, composes
   with testimonials/legends wall.
10. **Opposition dossier** — scout-powered match-day intel; honest
    `advanced_analytics` Pro surface (info-only, never sim params).

Dropped from the candidate list: "Tactical Familiarity" (already shipped —
`training.tacticalFamiliarity` feeds the match engine), Fan Zone feed,
set-piece routines, mentor pairings UI, testimonials (all good, below the
line on impact-per-effort).
