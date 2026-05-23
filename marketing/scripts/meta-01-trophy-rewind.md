# Meta-01 — Trophy Rewind ("Started in Div 4")

**Platform:** Meta Reels / Stories / Feed (Advantage+ Creative)
**Length:** 20 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** Self-shoot 45 min with iPhone QuickTime + iMovie / CapCut

## Pitch

A trophy lift on a phone screen, then hard-cut backwards through the saga
— the late winner, the wonderkid debut, the board threat — landing on
the empty starting squad. Underdog rise, captured in 20 seconds.

## Hook variants (0.0-1.5s — film all four, A/B as 4 Advantage+ creatives)

| ID | Visual | Caption (big white text, top third) | Mechanism |
|----|--------|-------------------------------------|-----------|
| A  | Close-up of cup-lift animation, fingers in frame | "Promoted to the Premier League." | Stakes-first |
| B  | Same cup-lift, but a smash-cut to it from black | "Started in div 4." | Curiosity-gap |
| C  | Black for 0.3s → cup-lift hits | "This took 5 saves." | Authority |
| D  | Cup-lift but the phone is being held by a face-cam human | "Lads. We did it." | UGC banter |

## Shot list

| Time | Shot | Caption (sound-off readable) |
|------|------|------------------------------|
| 00:00-00:01.5 | **HOOK** — pick one from above | Hook caption |
| 00:01.5-00:04 | Trophy lift continues, particles, gold flash | "From this..." |
| 00:04-00:04.3 | **CUT** — match-day scoreboard, 1-1, 89:50, your sub-bench highlighted | (text-only: "←") |
| 00:04.3-00:06 | Sub-on animation: wonderkid number flips up, runs onto pitch | "...the late winner" |
| 00:06-00:06.3 | **CUT** — wonderkid first-team debut animation | "←" |
| 00:06.3-00:08 | First goal cinematic + crowd reaction | "...his debut" |
| 00:08-00:08.3 | **CUT** — Inbox: "BOARD: Last chance to deliver" | "←" |
| 00:08.3-00:10 | Camera holds on board threat email | "...and the sack threat" |
| 00:10-00:10.3 | **CUT** — Squad screen showing 24-man starter squad, ratings 55-68 | "←" |
| 00:10.3-00:13 | Camera pans across grim-looking lower-league squad | "...started here." |
| 00:13-00:15 | Hard cut to title-card black with logo + "DYNASTY MANAGER" in Oswald | (text-only) |
| 00:15-00:18 | App icon zoom-in + "Free on iOS" badge | "Build your dynasty. Free." |
| 00:18-00:20 | Hold on CTA frame | (silent — let the viewer process) |

## VO (optional — record once on iPhone Voice Memos, normalize in Audacity)

> "Premier League. Started in div four. This is what football management's actually meant to feel like."

Read it conversational, English/Scottish/UK accent works best. 6.5 seconds long, overlay between 00:13-00:20.

## Music

- **Vibe:** dramatic-build-with-soft-piano-to-orchestral-hit. Beat-drop at 00:13 (cut to logo).
- **Royalty-free options:** YouTube Audio Library searches: "epic build", "cinematic underdog", "orchestral piano build"
- **Specific tracks (verify rights before use):** "Reflective" by Aakash Gandhi, "Heart of the Ocean" by DivKid, "Cinematic Triumph" by Music Unlimited (Pixabay)
- **Loud parts:** the trophy-lift moment (00:00) + the title card (00:13). Quiet in the middle so captions read.

## CTA card (last 2-3s)

- Visual: app icon (centered, scaled up), "DYNASTY MANAGER" in Oswald Bold, "Free on iOS" badge below.
- Caption: "Build your dynasty. Free."
- Safe zone: keep all text in the middle 1080×1400 box. Avoid bottom 250px (Reels UI) and top 200px (Stories UI).

## Capture instructions (Dynasty Manager footage)

1. Open Dynasty Manager on an iPhone.
2. **Settings → Cinematic Capture → Enable** (when shipped — see `src/pages/CinematicCapturePage.tsx`).
3. Choose **"Trophy Lift"** beat → start iPhone screen recording → let it play.
4. For the "starter squad" shot: start a new career in any div-4 club (Stamford in this build), screen-record the squad screen scrolling.
5. For the "wonderkid debut": load any save with a young player, screen-record their first match-day overlay.

If you don't want to set up Cinematic Mode, manual recipe:
- Open a Rare Gold pack on any save → screen-record the walkout (captures the gold-flash frame perfect for the hook).
- Use season-summary trophy modal as the hero shot.

## ffmpeg recipe

```bash
# Save raw screen-recording as raw.mov (5+ minutes is fine — we'll trim).
# Save VO as vo.m4a (record on iPhone Voice Memos).
# Save music as music.mp3 (YouTube Audio Library download).
# Save captions as captions.srt (use marketing/postproduction/captions.template.srt).

bash marketing/postproduction/build-ad.sh \
  --raw raw.mov \
  --captions captions.srt \
  --vo vo.m4a \
  --music music.mp3 \
  --out meta-01-trophy-rewind.mp4
```

## Why this should convert

- **Hook works** because cup-lifts are instantly recognizable to football fans (high relevance signal in <1s).
- **Curiosity-gap structure** — shows the *outcome* first, then earns the install with the journey. Highest-converting structure for sports/sim genre per FM22 case study (TikTok Business).
- **20-second length** is the sweet spot for Reels — long enough for the rewind narrative, short enough to maintain hold-rate.
- **Banter-leaning UGC variant (D)** opens the door to a creator port without re-shooting.

## Test plan

| Setting | Value |
|---------|-------|
| Platform | Meta Advantage+ Creative |
| Spend | $50/day, 10 days = $500 |
| Variants | 4 hooks (A/B/C/D) × shared body |
| Targeting | Broad — let A+AC route |
| Kill | Any hook variant CPI > $6 after 5K impressions |
| Scale | Variant CPI < $4 AND hold-rate > 10% → bump to $150/day |
| Cross-port | Winning hook → port to TikTok via Spark Ad |
