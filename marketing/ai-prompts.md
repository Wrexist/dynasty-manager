# AI Video Prompts — Runway / Veo / Sora

Ready-to-paste prompts for the major AI video generators if you'd rather
generate ad footage than screen-record. **Reality check first:**

- AI video in 2026 still struggles with: legible UI text (your in-app text
  will look garbled), specific player faces, and licensed brands. It's
  excellent at: cinematic crowd shots, stadium atmosphere, abstract motion
  graphics, b-roll between in-app captures.
- **Best use:** generate **establishing shots** (stadium exterior, crowd
  cheering, cup-lift cinematic) as bookends. **Don't** try to generate the
  in-app gameplay — that's what Cinematic Mode is for.
- Budget reality: ~$15-30 per 5-second clip across these tools at quality
  settings worth shipping. Don't generate 10 clips when one will do.

## Prompt-engineering rules across all three tools

1. **Specify aspect ratio:** "9:16, 1080×1920 vertical".
2. **Specify camera:** "shot on iPhone, handheld" reads more native; "cinematic 35mm" reads premium.
3. **Specify duration:** "5 seconds" or "10 seconds" — most tools cap at 10.
4. **Specify motion:** "slow push-in" / "subtle pan right" / "static handheld" — generic prompts produce drift.
5. **Avoid:** "show app UI", "screen recording", "text overlay" — these come out garbled. Generate the b-roll AROUND your screen recording, not the screen.

---

## Runway Gen-3 / Gen-4

URL: https://runwayml.com/

### Prompt 1 — Stadium cup-lift establishing shot (for Meta-01, Meta-05, TikTok-04)

> Cinematic wide shot of a football stadium at golden hour, packed crowd
> illuminated by stadium lights, gold and white confetti raining down from
> above, slow upward camera tilt revealing a trophy being lifted in the
> foreground (silhouetted, no face visible). Anamorphic lens, shallow
> depth of field, 35mm film grain. Warm golden tones. 9:16 vertical,
> 1080×1920, 5 seconds. Slow motion 60fps feel.

### Prompt 2 — Phone-in-hand POV close-up (for Meta-03, TikTok-03)

> POV close-up of hands holding an iPhone, soft natural window light,
> shallow depth of field, phone screen pixel-detailed but contents
> blurred/abstract (do NOT render specific UI). Background: cozy sofa,
> warm domestic lighting. Camera handheld with subtle shake. 9:16
> vertical, 1080×1920, 5 seconds.

### Prompt 3 — Trophy cabinet pan (for Meta-05, TikTok-05)

> Cinematic slow camera pan across a dark mahogany trophy cabinet, gold
> trophies lined up on glass shelves, soft rim-light from above, dust
> motes in the air. Trophies are abstract football-cup shapes (no specific
> league logos). Dark moody premium aesthetic, gold accents.
> 9:16 vertical, 1080×1920, 6 seconds.

### Prompt 4 — Manager celebration (for any "win" moment)

> Mid-distance shot of a man in a dark suit (back to camera, no face
> visible) on the touchline, fists raised, celebrating. Stadium crowd
> blurred in background. Rain falling lightly. Stadium floodlights bright.
> Slow motion. Premium dark-glass aesthetic. 9:16 vertical, 1080×1920,
> 5 seconds.

### Prompt 5 — Crowd reaction wave (for TikTok-04 promotion moment)

> Wide shot of a packed football crowd erupting in celebration, hands
> raised, scarves waving, slow-motion 120fps look, gold and silver foil
> falling from above, stadium lights flaring. Mixed faces in shadow (no
> specific people). Premium cinematic feel. 9:16 vertical, 1080×1920,
> 5 seconds.

---

## Google Veo 3

URL: https://deepmind.google/technologies/veo/

Veo 3 is stronger at physics (cloth, water, particles) and longer
sequences. Use it where Runway struggles.

### Prompt 1 — Football kicked into goal, slow motion

> A football is kicked from off-screen left, flies through the air in
> ultra-slow-motion (240fps look), the ball spins with realistic Magnus
> effect, deforms slightly on contact with the goal net which billows
> outward. Stadium floodlights flare. Crowd silhouettes in background.
> Premium cinematic 35mm look. 9:16 vertical, 1080×1920, 7 seconds.

### Prompt 2 — Confetti and gold foil shower (for any celebration moment)

> Slow-motion shower of gold and silver foil confetti falling against a
> dark background, individual pieces tumble realistically, catching
> stadium light. Pure visual asset, no people, no UI. 9:16 vertical,
> 1080×1920, 5 seconds.

### Prompt 3 — Manager office, intense lighting

> Mid-shot of a wooden manager's desk in a dimly lit office, tactical
> board on the wall behind (abstract magnetic markers, no specific names),
> single desk lamp creating dramatic shadows. Camera slowly pushes in.
> Empty chair in foreground. Moody premium aesthetic. 9:16 vertical,
> 1080×1920, 6 seconds.

---

## OpenAI Sora

URL: https://openai.com/sora/

Sora is strongest at longer narrative sequences and human reaction.

### Prompt 1 — Face-cam reaction (when you can't shoot it yourself)

> Realistic POV of a young man in his 20s, casual hoodie, sitting on a
> couch, holding a phone in landscape orientation. He reacts with surprise
> and joy at something on the screen — eyes widening, smile breaking out,
> phone slowly lowering. Soft warm domestic lighting. No specific phone UI
> visible — focus on the face. 9:16 vertical, 1080×1920, 6 seconds.

### Prompt 2 — Pub reaction shot (banter)

> POV across a pub table at two friends watching a phone screen, both
> reacting with shock and laughter. Cozy English pub atmosphere, pint
> glasses on the table, soft lighting. Authentic candid feel, slight
> camera shake. 9:16 vertical, 1080×1920, 7 seconds.

### Prompt 3 — Time-lapse of a stadium filling up (use as a metaphor for "growing your club")

> Time-lapse, low-angle shot of an empty football stadium gradually
> filling with crowd over 7 seconds, lights brightening, dusk to night.
> Premium cinematic feel. 9:16 vertical, 1080×1920, 7 seconds.

---

## How to integrate AI clips into the ad

1. Generate the AI clip (5-7 seconds typically).
2. Download as mp4 or mov.
3. Use it as **bookend footage** — the first 1-2 seconds or last 2-3 seconds
   of an ad, around your in-app captures.
4. ffmpeg-concat with your in-app footage:

```bash
# Concat AI clip → in-app capture → AI close
echo "file 'ai-opening.mp4'" > concat.txt
echo "file 'in-app-capture.mp4'" >> concat.txt
echo "file 'ai-closing.mp4'" >> concat.txt

ffmpeg -f concat -safe 0 -i concat.txt -c copy combined.mov

# Then run combined.mov through build-ad.sh as the --raw input
bash marketing/postproduction/build-ad.sh \
  --raw combined.mov \
  --captions captions.srt \
  --music music.mp3 \
  --out final-with-ai-bookends.mp4
```

## Cost estimate (per finished ad)

| Scenario | Cost |
|----------|------|
| Pure screen-recording + ffmpeg, self-shoot | $0 |
| + 1 AI bookend clip (Runway/Veo standard tier) | $5-15 |
| + 2-3 AI clips for full bookend bumpers | $15-45 |
| UGC creator + screen-record from them | $200-500 |

For a $500-1000 test budget, **stay in the $0-15 production range**. The
ad asset is not the bottleneck — testing rounds and creative iteration are.
