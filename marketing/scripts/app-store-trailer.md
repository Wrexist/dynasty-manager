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

## 3b. What was actually shot — `app-preview-v8.3` (28.8s)

The v1 plan above opened on the walkout at full burst. It was reworked after a
read of the surface: a preview autoplays MUTED in search and frame 1 is frozen
as the poster, so the opening has to create anticipation with no sound and no
spoiler. Opening on a 95 gives the reward away in the poster; opening on black
makes the poster black. **The sealed pack at peak charge does both jobs** — it
is the brightest, most saturated frame in the app, it is visibly mid-motion,
and it withholds the card.

| # | In | Shot | Source |
|---|---|---|---|
| 1 | 0.00 | **Pack at peak charge → tear.** Poster frame. | `icon` |
| 2 | 1.25 | Card back rises out of the bloom, face-down | `icon` |
| 3 | 1.95 | Name lands → flip → **OVR counts 15 → 87 → 94** | `icon` |
| 4 | 3.38 | The finished 94, stats in, potential bar | `icon` |
| 5 | 4.68 | Five cards land face-down — four gold, one marble | `pack` |
| 6-8 | 5.52 | Reveal escalation: **80 → 81 → 83**, marble still down | `pack` |
| 9 | 7.46 | The marble walks out | `pack` |
| 10 | 8.24 | Summary: 92 / 89 / £125.6M | `pack` |
| 11-12 | 10.44 | **£150M bid, +60% over value**, counter at £157.5M | `transfer` |
| 13-16 | 13.44 | **The XI fills: 4 → 7 → 9 → 11** | `squad&fill=N` |
| 17 | 19.29 | Pan down the card wall | `tall` |
| 18-23 | 22.19 | Payoff montage, 0.5–0.7s cuts | mixed |
| 24 | 25.89 | Hold on the hero card | still |

Two captions only, both placed in measured dead space (`NOW BUILD THE XI` under
the chemistry bar, `DYNASTY MANAGER` in the dark band above the hero card).
Everything else the app already says better than an overlay would.

**The squad-building beat is real app state, not a mask trick.** `SquadScene`
takes `?fill=N` and puts N of the XI on the pitch; the empty slots are the
app's own placeholders. Faking the fill in the edit would have been quicker and
would have shown an animation the app does not have.

**The OVR count-up did not exist on screen until this cut.** See
`WalkoutReveal.tsx` — the overlay was declared above the hero card in the tree
and the card painted straight over it, so it had never once reached a screen.
It is now the strongest muted-autoplay beat in the video, and in the app.

---


### v6 → v7

Five changes, all precision rather than concept.

- **The OVR climb starts at a plausible rating.** It rolled from 0, which meant
  a viewer read the 27 it passed through as a rating. A walkout only fires at
  84+, so the roll now starts just under that floor and reads
  79 → 84 → 87 → 90 → 92 → 94 → 95. See `OVR_ROLL_FLOOR`.
- **The card section escalates.** The old take dealt 80 / 81 / 83 — three cards
  that look the same at a glance. The take used now runs
  **79 → 83 → 87 → two 92s, £270.2M combined**, and each reveal is a punch-in
  on the card that just flipped rather than another shot of the same grid.
  Re-rolling is the only lever here: a pack's floor guarantees ONE card, not
  the fillers, so a flat spread is re-shot, not fixed in the edit.
- **The market punches in twice** — wide, then 1.3x, then 1.8x onto the
  figures. Small right-aligned values are not read on an App Store preview;
  the shot has to hand over BIG PLAYER → BIG NUMBER → BIG ACTION. Note the
  crops are right-anchored: a centred punch clips exactly the numbers the shot
  exists to show.
- **The squad fills in four steps** (3 → 6 → 9 → 11), not two.
- **Everything is captured at `CAP_SCALE=3`** — 1170x2532 instead of 780x1688.
  The delivery is 886 wide, so a 2x capture was already at 1:1 and every
  punch-in was upscaling into render pixels. At 3x the crops are downsamples.
  Set it as an env var on `capture-ad.mjs`; it costs capture fps, so raise
  `SLOW` to compensate and never run two captures in parallel (measured: two
  at once dropped a take to 20fps page-time, below the 30fps delivery).

Two captions only, both in measured dead space. There is no clear band over the
market panel or the pack summary — the app's own chrome fills the frame — and a
caption laid over it reads as a mistake, so those sections carry none.

---


### v7 → v8

- **Four overlays, and only four.** `DISCOVER RARE PLAYERS` · `BUY. SELL.
  PROFIT.` · `BUILD YOUR XI` · `BUILD YOUR DYNASTY` → `DYNASTY MANAGER`. The
  visuals carry excitement on their own; what they do not carry is *what the
  system is*. A viewer three seconds into the market panel does not know they
  are watching an economy. Nothing over the pack open — it needs no caption and
  a caption there would only cheapen it.
- **They sit ON the footage, never instead of it.** No cut to black, no full
  slide. Captions that overlap app chrome get a tight box behind the text
  (`boxborderw`, not a full-width band); the two that land in genuine dead
  space get none. Earlier versions refused any caption that could not find
  clear space, which is why v6 carried two — a box solves it better.
- **A 7-frame hold on the OVR at its final value**, before the card settles.
  The climb is the anticipation; letting it land and rest makes the payoff read
  bigger and costs a quarter of a second.
- **Rhythm, not uniform speed.** Fast open → slower market (it is the hardest
  thing to read) → the squad given room → fast payoff. Cutting everything fast
  makes the middle unreadable.
- **The card wall lost a second** and now pans across the strongest rows only.

---


### v8 → v8.1 — micro-polish only, structure frozen

- 94 payoff held ~0.2s longer before the card settles.
- `BUY. SELL. PROFIT.` lands word by word inside 0.56s — one persistent box
  sized to the full line (an invisible copy of the text carries it), the words
  drawn boxless on top at measured x-offsets so the line never re-centres as it
  grows.
- The cuts into the market and the squad arrive with a slight settle
  (zoompan 1.05 → 1.0) instead of a static frame, so the transition inherits
  motion from the cut before it.
- 0.6s trimmed from the densest middle (F11 zoom, card-wall pan).
- Final branding on screen ~0.3s earlier and holds to the last frame.
- The DISCOVER caption now ends before the walkout starts — it was overlapping
  the walkout's own nameplate.

**Iteration stops here** pending real store data. The poster frame is chosen in
App Store Connect (frame 1 is only the default), so pick the pack-at-peak-charge
frame there.

---


### v8.1 → v8.2 — the DISCOVER hero was being skipped by the rig itself

The DISCOVER section's walkout (Florian Wirtz, 92) was barely on screen — a
fraction of a second of nameplate, no card. Root cause was in the capture
plan, not the edit: the `pack` plan's blind tap loop kept tapping after the
last reveal, **and a tap on a running walkout means SKIP**. Every 5-card take
ever filmed had its hero walkout skipped by its own rig. The plan now stops
tapping the moment the SKIP pill exists.

With real walkout footage to cut, DISCOVER gets its own mini-payoff:
82 → 84 → 87 reveals, then the full beat — silhouette, FLORIAN WIRTZ types
out, the OVR spins to 92, the card holds — into the £269M summary. The
caption ends before the walkout starts, so the app's own nameplate is the
only text on the reveal. +1.3s total, still under 30.

The harness also takes `hero=<name>` (case-insensitive substring, e.g.
`hero=Wirtz`) so a take can pin WHO walks out instead of re-rolling captures
until the right name appears.

---


### v8.2 → v8.3 — one climax, not five

The payoff montage was recapping features: pack → walkout → OVR → a market
punch → a squad punch → a giant 92 → then the 94. Every shot was good and the
sequence was wrong. By 22s the viewer already knows what the app does, so a
market flash there reads as "remember this too", not as an ending — and a
giant 92 landing three seconds before the giant 94 makes the eye ask which
one is the climax.

The last six seconds are now a single line: **pack callback → the OVR climbs
78 · 85 · 92 · 94 → a 0.35s hold on the 94 → the card → BUILD YOUR DYNASTY →
DYNASTY MANAGER.** No other interface after the second pack callback, and no
competing number.

The climb is the whole climb — 6.02→6.92 in the take, which is where the roll
actually runs. v8.2's ending opened at 6.35 and so began already at 94, which
is the same failure as the original bug in a different costume: the count was
there and nobody saw it.

The card-wall shot gets +0.25s (premium visuals need a beat to register as
premium), and `DYNASTY MANAGER` no longer fades out — it is on screen when the
last frame freezes.

---


## 3c. Encoding for App Store Connect — the audio spec is a rejection risk

ASC rejected `app-preview-v8.3` with **"Your app preview contains unsupported
or corrupted audio."** The video was fine; the audio track was **mono, 44.1 kHz,
88 kb/s**, written by a plain `ffmpeg -c:a aac` with no channel or rate flags.

Two things were wrong, and the second is the one that is easy to miss:

1. **Mono.** App Preview audio must be **stereo**. A mono track is the most
   likely single cause of that message.
2. **A non-zero start offset.** ffmpeg's AAC encoder has ~2048 samples of
   priming delay and the mp4 muxer writes an **edit list** to compensate, so
   the file reports `start: 0.045000`. Strict validators read a leading edit
   list as a malformed track. `-avoid_negative_ts`, `-muxdelay 0` and
   `-muxpreload 0` do NOT remove it — the only reliable removal is to re-open
   the finished file with `-ignore_editlist 1` and stream-copy it.

Settings that produce an accepted file:

```bash
# 1. bed: stereo, 48 kHz, exactly the video's duration (frames / fps)
ffmpeg -f lavfi -i "aevalsrc=exprs='<expr>':s=48000:d=28.766667" \
  -af "highpass=f=28,alimiter=limit=0.9,pan=stereo|c0=c0|c1=c0" \
  -c:a aac -profile:a aac_low -b:a 256k -ar 48000 -ac 2 bed.m4a

# 2. mux, with explicit colour tags (the capture's mjpeg frames carry
#    bt470bg otherwise) and an exact frame count
ffmpeg -i cut.mp4 -i bed.m4a -map 0:v:0 -map 1:a:0 -frames:v 863 \
  -c:v libx264 -profile:v high -level 4.2 -preset slow -crf 17 \
  -pix_fmt yuv420p -r 30 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -profile:a aac_low -b:a 256k -ar 48000 -ac 2 \
  -movflags +faststart -video_track_timescale 30000 out.mp4

# 3. strip the AAC priming edit list — nothing else removes it
ffmpeg -ignore_editlist 1 -i out.mp4 -c copy -movflags +faststart final.mp4
```

Verify with `ffmpeg -i final.mp4` before uploading: **`start: 0.000000`**,
`886x1920`, `30 fps`, and `48000 Hz, stereo`.

**A silent preview is also valid**, and it is the zero-risk option: an App
Preview autoplays muted in search anyway, so the audio only ever reaches
someone already on the product page. `-an` on the final copy produces it, and
it cannot fail this check. Ship silent unless the bed is genuinely earning
something.

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
