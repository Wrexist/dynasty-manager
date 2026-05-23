# Meta-04 — Pack Walkout ("First Rare Gold pull")

**Platform:** Meta Reels / Feed
**Length:** 15 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** Self-shoot 20 min (the in-app animation does the heavy lifting)

## Pitch

The cheapest, fastest, highest-emotion ad to film. Open a Rare Gold pack
in Cinematic Mode, screen-record the walkout, slap a hook + CTA on it.
The pack animation IS the ad.

## Hook variants

| ID | Visual | Caption | Mechanism |
|----|--------|---------|-----------|
| A  | Pack tier name "RARE GOLD" fills screen in white-on-black | "First Rare Gold pull." | Anticipation |
| B  | Black for 0.3s → walkout reveal hits immediately | "No way." | Reaction |
| C  | Pack art shaking, energy arcs, half a second before reveal | "Hold on." | Suspense |
| D  | Face-cam reaction (creator UGC), eyes widening | "Lads. LADS." | Banter |

## Shot list

| Time | Shot | Caption |
|------|------|---------|
| 00:00-00:01 | **HOOK** | Hook caption |
| 00:01-00:02.5 | Pack art appears, gentle bob, gold tier glow | "Free daily pack." |
| 00:02.5-00:04 | Pack charges, shakes hard, energy arcs along seam (use existing PackOpeningOverlay "charge" phase) | "Come on." |
| 00:04-00:04.5 | **EXPLODE** — shockwave ring, white bloom flash, lens flare, foil shreds | (text: 💥) |
| 00:04.5-00:06 | Cards flip up one by one — silver, gold, gold, gold | "Three golds already." |
| 00:06-00:07 | Last card — **WALKOUT** animation triggers, hero card scale x1.11, name typewriter | "And then..." |
| 00:07-00:09 | Walkout reveal: legendary card, gold-on-black, name + 92 OVR | "Mbappé. 92." |
| 00:09-00:11 | Card holds, foil shred drift particles | "Free pack. Free game." |
| 00:11-00:13 | App icon + CTA | "Open packs free daily." |
| 00:13-00:15 | Hold | (silent) |

## VO (optional — minimal)

> "First Rare Gold pack. Three golds, a silver — and then this. Mate."

8 seconds, overlay 00:01-00:09. Could omit VO entirely; the animation + captions do the work. This is one of the few scripts where SILENT works.

## Music

- **Vibe:** EDM build, beat drop at the explode moment (00:04.5).
- **YouTube Audio Library:** "EDM build drop", "future bass build", "epic drop"
- **Specific tip:** time the beat-drop to the white bloom flash (00:04.5). This sync is what makes pack-opening ads addictive — every successful FC pack-opening TikTok in 2024-2026 does this.

## CTA card

- Visual: app icon + "DYNASTY MANAGER" + "Free on iOS" badge.
- Caption: "Open packs free daily."
- Critical: emphasize "free daily" — pack-fatigue from EA FC's $$$ packs is real, this is the differentiator.

## Capture instructions

1. **Cinematic Capture → "Pack Walkout"** beat (when shipped) — this is the v1 Cinematic Mode focus, perfectly captures this 9-second sequence.
2. Manual recipe (without Cinematic Mode):
   - Open a Rare Gold pack on a save with enough budget.
   - You may need to retry until you get a walkout (84+ guaranteed in Rare, so any pull works visually; 90+ legendary walkout is ideal but pity-locked).
   - Screen-record iPhone in QuickTime, vertical orientation.
   - Trim in iMovie / CapCut to the 9-second pack sequence.

## ffmpeg recipe

```bash
bash marketing/postproduction/build-ad.sh \
  --raw pack-walkout.mov \
  --captions pack-captions.srt \
  --music edm-build-drop.mp3 \
  --out meta-04-pack-walkout.mp4
```

## Why this should convert

- **Lowest production cost** of all 10 scripts — the in-app animation is the asset.
- **Highest emotion per second** — pack walkouts are designed to be addictive; the ad inherits all the FOMO.
- **EA FC ad fatigue is high** — players are sick of expensive packs. "Free daily" is the differentiator and the wedge.
- **Sound-off readable** — the walkout flash + captions land without audio.

## Test plan

This is the cheapest creative to run — file it under "evergreen" and let it
run alongside other concepts. $200 over 7 days, 4 hooks × shared body.

Note: pack ads have a known wear-out — viewers see them everywhere on TikTok
already. The "free daily" caption is the differentiator. If hold-rate < 8%
within 5K impressions, the pack-opening category itself is saturated for
your audience — switch to underdog/banter angles.
