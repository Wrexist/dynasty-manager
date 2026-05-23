# Meta-03 — Transfer Drama ("£80M for Ødegaard?!")

**Platform:** Meta Reels / Feed
**Length:** 18 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** UGC creator $200-500 (face-cam reaction works best here)

## Pitch

A phone-screen incoming bid notification, face-cam reacts, hovers Accept/Reject,
slams Reject. The "what would you do" interactive frame in 18 seconds.

## Hook variants

| ID | Visual | Caption | Mechanism |
|----|--------|---------|-----------|
| A  | Phone-style notification banner slides in: "BID: £80,000,000 — Real Madrid" | "Real bid £80m for my 17-year-old." | Problem |
| B  | Face-cam, raised eyebrow, finger pointing at phone | "Tell me what you'd do." | POV question |
| C  | Split screen: face-cam top, phone screen bottom — both reacting | "Eighty. Million. Pounds." | Stakes |
| D  | Big text "WOULD YOU?" over a frozen bid screen | "Would you?" | Cliffhanger |

## Shot list

| Time | Shot | Caption |
|------|------|---------|
| 00:00-00:01 | **HOOK** | Hook caption |
| 00:01-00:03 | Phone-in-hand POV, scrolling through Inbox | "Sunday morning. Inbox check." |
| 00:03-00:05 | Notification banner slides in: "BID: £80,000,000 — Real Madrid for Ødegaard" (use a fake player name; real player IP risk) | "And then this happens." |
| 00:05-00:08 | Tap on bid → bid details screen with Accept (green) / Negotiate (amber) / Reject (red) buttons | "What do you do?" |
| 00:08-00:10 | Face-cam (if creator), thinking face, scrolling through your squad | "He's 17. Free signing. 92 potential." |
| 00:10-00:12 | Hover on "Reject" — finger trembles, slow zoom | "Mate." |
| 00:12-00:13 | Tap "Reject", red flash, "REJECTED" overlay | (text: ❌) |
| 00:13-00:15 | Face-cam smiling, satisfied | "Not for sale." |
| 00:15-00:18 | App icon + CTA card | "Run your club. Free." |

## VO (optional)

> "Sunday morning. Real Madrid offer eighty million pounds for my seventeen-year-old. Question is: what do you do? ... Not for sale, mate."

15 seconds. Banter UK English, casual delivery. Overlay 00:01-00:15.

## Music

- **Vibe:** suspenseful percussion building, beat drops at "Reject" tap (00:12).
- **YouTube Audio Library:** "tense build", "dramatic percussion", "suspense low strings"
- **Specific:** "Cinematic Tension" (Bensound), "Pressure" type tracks from Pixabay Music.

## CTA card

- Visual: app icon + "DYNASTY MANAGER" wordmark + "Free on iOS" badge.
- Caption: "Run your club. Free."

## Capture instructions

1. **Cinematic Capture → "Transfer Bid"** beat (when shipped).
2. Manual recipe:
   - Need a save with a 88+ player and an active offer in the inbox.
   - If no organic offer: edit the save manually OR mock the bid notification in CapCut (the inbox UI is consistent enough that a 5-second mock looks authentic).
3. For face-cam: shoot vertically on iPhone front camera, natural light, phone held arm's length. NO ring light, NO studio — it'll read as ad.

## ffmpeg recipe

```bash
# Split-screen variant (C):
bash marketing/postproduction/build-ad.sh \
  --raw transfer-screen.mov \
  --face-cam transfer-facecam.mov \
  --split-screen true \
  --captions transfer-captions.srt \
  --vo transfer-vo.m4a \
  --music suspense-build.mp3 \
  --out meta-03-transfer-drama.mp4
```

## Why this should convert

- **Phone-in-phone format** mirrors the user's actual experience — psychological priming for the install.
- **Decision moment** ("what would you do?") makes the viewer mentally play the game, which is conversion gold for sim/strategy ads (per Pilothouse 2025 creative testing data).
- **Banter close** ("Not for sale, mate.") lands the brand voice and is highly shareable.

## Test plan

Best paired with UGC creator (variant B or C). Face-cam reactions outperform polished by 25-40% on Meta. $500 over 10 days, 4 hooks × 1 body. Watch hold-rate carefully — if viewers drop before the Reject tap, the build is too slow; cut 2 seconds from middle.
