# App Store trailer — research, script, shot list

The deliverable: a 30-second App Preview for the iPhone 6.9" slot, plus a
60-second cutdown for YouTube and a 15-second cut for paid.

Everything below is measured against the shipped app: the beat timings are read
out of `PACK_ANIM` in `src/config/packs.ts`, the players named are real entries
in the pool at their real ratings, and every shot is marked with whether the
capture rig can already film it.

---

## 1. Research — the constraints that actually shape the script

### Apple's rules, and what they cost you

| Rule | Consequence for the script |
|---|---|
| 15–30 seconds | 30s is the ceiling. Use all of it — there is no bonus for brevity here, unlike a TikTok. |
| 886×1920 portrait, ≤30fps | Everything is shot vertical. No landscape inserts. |
| Device-captured footage only | No motion-graphics title cards, no stock stadium b-roll, no logo stings from After Effects. Text overlays are permitted; scenes that are not the app are not. |
| **Autoplays MUTED in search results** | This is the big one. The first 3 seconds must land with no sound at all. Anything carried by audio is wasted. |
| First frame is the poster | Frame 1 is what a browsing user sees frozen. It must be the single most attractive frame in the whole video, not a fade-in from black. |

**Consequence:** open on the strongest static image in the app, silent, with no
build-up. A conventional "logo → fade → gameplay" opening throws away the only
three seconds you are guaranteed.

### Why the pack opening is the hook, not the closer

The instinct is to save the walkout for the finale. That is wrong for this
surface, for a reason worth stating precisely:

Anticipation is the strongest part of a reward loop. Dopamine responds to the
*prediction* of reward more than the reward itself — which is why the charge and
the held breath in `PACK_ANIM` do more work than the card that follows, and why
this app already spends 1.7s building before it spends 340ms bursting.

A trailer can only borrow that feeling if the viewer is still watching when it
pays off. So the structure is:

1. **Open on the peak** (a 95 walkout mid-explosion) — steals attention in the
   muted 3-second window.
2. **Then earn it again slowly** — the full open, charge and all, in the middle.
3. **Close on the thing that keeps people** — the squad, the season, the career.

The pack sells the install. The management sells the retention. A trailer that
is only pack-opening installs people who churn on day two, which at **D7 1.71%**
is the last thing this app needs.

### What the store visitor is actually deciding

They are not deciding "is this fun". They are deciding **"is this for me"** in
under five seconds. So every shot must answer one of three questions:

- *Are the players real?* → named cards, flags, real ratings
- *Is there a real game here, or just packs?* → pitch, tactics, transfer drama
- *Does it look expensive?* → the walkout, the card art, the new backs

---

## 2. The 30-second App Preview — shot list

Timings are cumulative. Every shot is real app footage.

| # | Time | Shot | Text overlay | Rig |
|---|---|---|---|---|
| 1 | 0.0–2.5 | **Legends walkout at full burst.** Open ON the explosion — spotlights, confetti, the card mid-flip. No build. This is the poster frame. | *(none — let the image work)* | ✅ `icon` plan |
| 2 | 2.5–5.0 | Card settles: **Mbappé 95**, stat pills counting up, LEGENDARY badge. | `REAL PLAYERS.` | ✅ `icon` |
| 3 | 5.0–8.0 | **Pack tear, slowed.** Sealed Legends pack, the charge shake, the held breath, the side-tear. Cut on the burst. | `REAL PACKS.` | ✅ `pack` |
| 4 | 8.0–11.0 | **Five cards land**, four gold backs and one white-marble icon back among them. Tap-reveal: **Yamal 92**, **Koundé 90**. | `£204M IN ONE PACK` | ✅ `pack` |
| 5 | 11.0–14.5 | **The XI on the pitch.** Mbappé, Haaland, Salah across the front. Chemistry bar hits Excellent. | `NOW BUILD THE TEAM.` | ✅ `squad` |
| 6 | 14.5–17.5 | **Transfer drama.** £150M bid for Mbappé from Real Madrid, +60% over value, counter-offer slider live. | `SELL? OR BUILD?` | ✅ `transfer` |
| 7 | 17.5–21.0 | **Match day.** Minute-by-minute, a goal event firing, the scoreline turning. | `45 LEAGUES. 756 CLUBS.` | ⚠️ needs `match` scene |
| 8 | 21.0–24.0 | **Trophy / season end.** The lift, or the league table with your club first. | `WIN IT ALL.` | ⚠️ needs `season` scene |
| 9 | 24.0–27.0 | **Career.** Job market offer, or the Hall of Managers with your record. | `ONE CLUB, OR TWENTY.` | ⚠️ needs `career` scene |
| 10 | 27.0–30.0 | Return to a **hero card** — Bellingham 94 — holding still. App name only. | `DYNASTY MANAGER` | ✅ `icon` |

### Copy rules for the overlays

- **Two or three words per card.** They are read in peripheral vision while the
  footage does the work.
- **No player names in the text.** Real names in *footage* are the product;
  in marketing copy they imply an endorsement that does not exist. This rule
  is already in the kit and it holds here.
- Set in the app's own display face, bottom third, behind a feathered scrim.
  The crop eats the outer edges and the store chrome sits low.

---

## 3. The pack-opening showcase — a separate 60-second cut

For YouTube, the store's secondary slot, and organic. Here the pack opening is
allowed to be the whole thing, because the audience already chose to watch.

The shipped open runs, beat by beat (from `PACK_ANIM`):

```
loading    220ms   dim + ring, covers first paint
portal     260ms   the pack arrives
arrival    520ms   it settles
charge    1700ms   escalation — haptics accelerate 260ms → 70ms apart
breath     240ms   everything stops dead, glow spikes
explode    340ms   side-tear, cards arrive at the peak of the bloom
```

Then the walkout, for a legendary pull:

```
slit       700ms   a line of light opens
silhouette 900ms   shape only, no name yet
enter      600ms   the card rises
name         —     typewriter, 45ms per character
breath     280ms   held
flip       800ms   3D turn — the new back turns into the face
ovr roll   420ms   the rating tickers up
stats     1500ms   stat pills stagger in, 200ms apart
hold      2400ms   it breathes
```

**Why this is watchable and most gacha openings are not:** the charge is a
genuine ramp, not a constant rattle, and the held breath before the burst is
what makes the burst land. The 240ms of *nothing* is the most important frame
in the sequence. The walkout repeats the trick — 280ms of stillness between the
name and the flip.

### Structure of the 60s cut

| Time | Beat |
|---|---|
| 0–4 | **Cold open on a burst.** Same trick as the trailer: peak first. |
| 4–14 | **One full open, uncut, real speed.** Sealed pack → charge → breath → tear → five cards. Let the tension run; do not cut inside the charge. |
| 14–26 | **Reveal all five**, ending on the icon back turning into a 92. |
| 26–38 | **A second open at a different tier** — the £9.99 Legends single. One card, guaranteed walkout, the full seven-beat sequence. |
| 38–50 | **Card backs on parade.** The five-card grid face-down, four gold and one marble. Slow push-in. This is the anticipation shot — it says *you can see what is coming before it flips.* |
| 50–60 | **The squad it built.** Cut from cards to the XI on the pitch. Ends on the thing that keeps them. |

**Do not add music with a drop synced to the burst.** Everyone does it and it
flattens the app's own pacing, which is already tuned. Use a low bed and let the
tear and the flip carry the rhythm.

---

## 4. What needs building before this can be shot

Three of the ten trailer shots have no capture scene yet. Honest estimate: they
are the same pattern as `SquadScene` — craft store state, mount the real
component — and all three are store-driven with no required props.

| Scene | Component | Notes |
|---|---|---|
| `match` | `MatchDay` / `PostMatchPopup` | `PostMatchPopup` takes only `onContinue`; the rest is store state. The heavier lift is a live minute-by-minute shot rather than the result popup. |
| `season` | `SeasonSummary` or `KnockoutBracket` | `KnockoutBracket` takes props directly — likely the quickest of the three. |
| `career` | `JobMarket` or `HallOfManagers` | Job-market offer card is the most legible at phone size. |

Shots 1–6 and 10 can be filmed today with the existing `icon`, `pack`, `squad`
and `transfer` plans. **That is 22 of the 30 seconds.**

### Suggested order of work

1. Cut a **v1 trailer from existing scenes only** — shots 1–6 + 10, retimed to
   fill 30s. Ships this week, and is already stronger than the current preview.
2. Build the `match` scene. It is the single biggest gap: nothing in the current
   preview shows a match, which is the actual game.
3. Add `season` and `career` and recut to the full ten-shot version.

---

## 5. Named players to feature

Measured from the shipped pool. All appear at these ratings.

**Walkout heroes (Legends tier, +4 issue):** Salah 95 · Mbappé 95 · Bellingham 94 · Haaland 94 · Rodri 94 · van Dijk 94 · Dembélé 94

**Pack pulls (Rare/World Class):** Yamal 92 · Vinícius Júnior 92 · Wirtz 92 · Pedri 92 · Valverde 92 · Koundé 90

**Squad XI:** Mbappé 91 · Salah 91 · Haaland 90 · Bellingham 90 · Rodri 90 · van Dijk 90 · Vinícius Júnior 89 · Yamal 89 · Kane 89 · Alisson Becker 89 · Pedri 89

**Transfer drama:** Mbappé 91, £150M bid from Real Madrid, +60% over market value.

---

## 6. Poster frame

The single frame Apple freezes in search results. Candidates, best first:

1. **The walkout at full burst** — spotlights, confetti, a 95 mid-air. Highest
   contrast, most colour, reads at thumbnail size.
2. The five-card grid face-down, four gold and one marble — intriguing, but
   requires a beat of thought, which a thumbnail does not get.
3. The XI on the pitch — informative but visually busy at 200px.

Go with 1. It is also shot 1, so the video opens on its own poster and there is
no jump.
