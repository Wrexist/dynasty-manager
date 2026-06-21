# 🎨 World Cup — AI Asset Prompts

Ready-to-paste prompts for generating **better-looking World Cup marketing art** in
Midjourney / DALL·E / Ideogram / Leonardo (images) and Runway / Veo / Sora (video).
Drop the outputs behind the App Store / social creatives in `marketing/world-cup/`
to replace the flat gradient background and add a real hero element.

**Brand palette (paste into prompts):** deep navy `#0c1526`, premium gold
`#f2b50c` / `#ffd24a`, pitch green `#16a34a`, with white. Dark, cinematic,
premium — *not* cartoonish.

**Tip:** Ideogram/DALL·E render legible text; Midjourney is best for atmosphere
but bad at text — generate backgrounds/objects there and add the "WORLD CUP"
type in the HTML templates (or Figma) on top.

---

## 1. Hero background — World Cup stadium atmosphere (9:16)
> Cinematic football stadium at night during a **World Cup** final, packed roaring
> crowd as soft bokeh, dramatic stadium floodlights, faint gold confetti drifting,
> deep navy-to-black gradient sky, volumetric light, premium and moody, dark
> negative space in the upper third for a headline, subtle pitch-green glow rising
> from the bottom. Color palette deep navy #0c1526, gold #f2b50c, pitch green.
> Ultra-detailed, photoreal, 9:16. --ar 9:16
>
> Negative: text, watermark, logos, players' faces, cartoon, low detail, clutter.

Use as the panel background; keep the top third dark for the country ribbon + headline.

## 2. Hero background — square + landscape variants
Same prompt as #1 with `--ar 1:1` (Instagram feed) and `--ar 16:9` (YouTube/web).
Generate all three so the set is consistent across placements.

## 3. The World Cup trophy — isolated hero object (transparent)
> A golden football **World Cup**-style championship trophy, studio product shot,
> dramatic rim lighting, glints of gold, sitting in soft volumetric haze, isolated
> on a transparent / pure black background, ultra-detailed, photoreal, centered,
> premium. --ar 2:3
>
> Negative: text, brand marks, real FIFA trophy likeness, background scene, people.

> ⚠️ Make it a **generic** gold trophy (a stylised cup), **not** a replica of the
> real FIFA World Cup trophy — that mark is protected. Keep it generic.

Composite this trophy beside/behind the headline on panel 3 ("Win the World Cup").

## 4. Confetti & light FX overlay (transparent)
> Falling gold and green confetti and glittering light particles over a transparent
> background, celebratory **World Cup** victory moment, motion blur on some pieces,
> high detail, no background. --ar 9:16
>
> Negative: text, people, solid background.

Layer at low opacity over any panel for a "trophy lift" celebration feel.

## 5. Atmospheric pitch / tunnel walkout
> View from the players' tunnel walking out onto a floodlit pitch on **World Cup**
> final night, lush green grass with mowing stripes, blazing stadium lights, lens
> flare, shallow depth of field, cinematic, dark and premium. --ar 9:16
>
> Negative: text, faces, logos, cartoon.

Great for a Reels/Story bookend or an "Out Now" panel background.

## 6. App icon concepts
> A premium mobile game app icon for a football management game called Dynasty
> Manager, featuring a stylised gold trophy and a subtle pitch-green field motif on
> a dark navy rounded-square background, gold accents, clean, iconic, high contrast,
> readable at small sizes, no text. --ar 1:1
>
> Negative: text, words, busy detail, realistic photo, clutter.

Generate 4–6, pick the most legible at 60px.

## 7. Flag/country motif backdrop
> An abstract elegant backdrop made of softly blurred national flag colours of the
> world's top football nations (Brazil green-yellow, Argentina sky-blue, France/
> Netherlands/Germany), flowing like silk banners on a dark navy field, premium,
> subtle, lots of dark negative space, **World Cup** energy. --ar 9:16
>
> Negative: text, recognizable flag shapes stacked, clutter, cartoon.

A richer alternative to the flat gradient behind the country ribbon.

---

## 8. Video — Reels / TikTok bookend (Runway / Veo / Sora)
**Open (3s):**
> Slow cinematic push-in across a packed **World Cup** stadium at night, floodlights
> blazing, gold confetti beginning to fall, crowd as glowing bokeh, dramatic and
> premium, dark navy and gold palette, no text. 9:16.

**Trophy reveal (3s):**
> A golden championship trophy rises into a spotlight through drifting confetti,
> slow motion, rim-lit gold, dark background, **World Cup** victory energy,
> cinematic, no text. 9:16.

Bookend your in-game screen-recording (the live World Cup match) with these for a
high-production Reel; add the "WORLD CUP" type + CTA in post (see
`marketing/postproduction/`).

---

## 9. How these slot into the existing creatives

| Asset | Replaces / adds to |
|-------|--------------------|
| #1/#2 hero background | the flat gradient in `build-appstore.mjs` / `build.mjs` (swap the `background:` for an `<img>` layer) |
| #3 trophy | a hero object beside the headline on the "Win the World Cup" panel |
| #4 confetti FX | overlay the CSS confetti for a richer celebration |
| #5/#7 backdrops | alternate panel backgrounds |
| #6 icon | App Store icon refresh |
| #8 video | Reels/TikTok bookends around the gameplay capture |

Keep the **country ribbon** (`marketing/world-cup/appstore/country-ribbon-*.png`)
and the "WORLD CUP" gold type on top — generate the *atmosphere* with AI, keep the
*text + flags* crisp in the templates.
