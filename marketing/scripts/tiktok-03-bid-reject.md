# TikTok-03 — Transfer Bid Reject ("£80M for my 17-year-old?")

**Format:** Spark Ad (UGC creator) or in-feed (self-shot)
**Length:** 12 seconds
**Effort:** UGC creator $200-500 OR self-shoot

## Pitch

Phone-in-hand POV. Bid notification slides in. Creator reads it out, scoffs,
rejects. 12 seconds, native, lowercase captions, no music.

## Creator brief

> Quick TikTok — 12 seconds, phone-vertical.
>
> 1. Hook (1s): "real madrid bid £80m for my 17-year-old" — say it like
>    you're reading a text.
> 2. Show the phone screen — Dynasty Manager inbox with the bid (we'll
>    provide a save file or you can mock the bid in app).
> 3. Hover finger on "Reject" for 2 seconds, slow tap.
> 4. End on you: "not for sale."
>
> Captions lowercase, no hashtags. Sponsored tag mandatory.

## Hook (0-1s) — 4 variants

| ID | Visual | Caption |
|----|--------|---------|
| A  | Face-cam, raised eyebrows, phone in hand | "real madrid bid £80m for my 17-year-old" |
| B  | Just the phone screen showing the bid notification slide-in | "£80,000,000 — real madrid" |
| C  | Split: face top, phone bottom | "what would you do" |
| D  | Black 0.3s → red "REJECTED" stamp slams in | "not for sale" |

## Body

| Time | Beat |
|------|------|
| 00:00-00:01 | Hook |
| 00:01-00:04 | Phone screen: bid notification banner sliding in, fee animating |
| 00:04-00:07 | Tap on bid → bid detail screen with Accept/Negotiate/Reject |
| 00:07-00:09 | Slow zoom on Reject button, finger trembles |
| 00:09-00:10 | Tap → red "REJECTED" stamp + haptic |
| 00:10-00:12 | Face-cam (if creator): "not for sale" — or just text: "mine." |

## Captions

- "real madrid bid £80m for my 17-year-old"
- "what do you do"
- "he's free signing. 92 potential."
- "REJECT"
- "mine."

## Music

- None ideal — the tap + reject is the audio moment.
- Optional: tense low-frequency drone, fade out at "mine" final caption.

## CTA — embedded in final caption, not a separate card

- Final on-screen text: **"search Dynasty Manager"** OR **"trying this now"**.
- DO NOT add a CTA card / app icon overlay — kills the native feel.

## Capture instructions

1. **Cinematic Capture → "Transfer Bid"** beat (when shipped).
2. Manual: load a save with a star (88+ player), wait for or trigger an inbox offer, screen-record on iPhone.
3. The bid notification banner animation is in `src/pages/InboxPage.tsx` — visually distinctive enough to be recognized in 1 second.

## ffmpeg recipe — minimal

```bash
# Spark route — no editing. Submit creator's raw post.
# Self-shoot route:
bash marketing/postproduction/build-ad.sh \
  --raw bid-reject-raw.mov \
  --captions bid-captions.srt \
  --no-music true \
  --out tiktok-03-bid-reject.mp4
```

## Why this should convert

- **Stakes-first hook** ("£80m for my 17-year-old") = high relevance signal in <1s for football fans.
- **Decision moment** makes viewer mentally play the game = pre-install commitment.
- **Banter close** ("mine") = highly memeable, drives organic comments.
- **No music + lowercase captions** = reads as a creator's actual TikTok, not an ad.

## Test plan

Run paired with TikTok-01 (wonderkid) on Spark. $200 each, 7 days. Compare CPI:
- Wonderkid wins → audience cares about player development
- Bid Reject wins → audience cares about decision drama
- Whichever wins, port the winning angle to Meta (Meta-03 or Meta-02 already covers).
