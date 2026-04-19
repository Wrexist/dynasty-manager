# Player Pack — AI Art Prompt Sheet

Authoring guide for the six pack covers used by the Player Packs feature
(`Market → Packs`). Drop the generated PNGs into `public/packs/<key>.png`
and they appear automatically in the shop tile **and** in the cinematic
pack body during opening.

---

## Asset Specs

| What | Value |
|---|---|
| **Resolution** | **1024 × 1536** (2:3 portrait) |
| **Format** | PNG (lossless), optional alpha |
| **Color space** | sRGB |
| **Compression** | Run through TinyPNG or Squoosh after generation — target ≤ 400 KB per tier |
| **File path** | `public/packs/<key>.png` (e.g. `public/packs/bronze.png`) |
| **Filename keys** | `bronze` · `silver` · `gold` · `premium` · `rare` · `icon` |

### Why 1024 × 1536?

- Native size on the most common AI art tools (Midjourney `--ar 2:3`,
  DALL·E 3 portrait, SDXL portrait).
- The pack tile in the shop is **3:4 portrait** — a 2:3 image
  `object-fit: cover`s with only ~12 % top/bottom crop. Keep the focal
  motif **vertically centered** and you're safe.
- The featured hero card is **16:9 landscape** — same `object-fit: cover`
  reuses the portrait, cropping to the center band. Keep the focal motif
  **horizontally centered** too. One asset, two framings.

If you really want a separate landscape variant for featured tiles
later, name it `<key>-wide.png` at **1920 × 1080** and we'll wire a
second optional config field. Skip for v1.

---

## Universal Style Anchor

Prepend (or include) this in **every** prompt so the six covers feel
like one cohesive set:

> *Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports
> premium pack design, centered heraldic composition, dramatic studio
> lighting, cinematic 8K render, sharp focal motif, ornamental border
> framing, no text, no watermark, no human faces, no logos.*

## Universal Negative Prompt

> *text, letters, words, watermark, signature, faces, players,
> photographs, low quality, blurry, jpeg artifacts, flat lighting,
> amateur, cluttered, generic, stock photo.*

## Tool-Specific Tips

- **Midjourney v6:** append `--ar 2:3 --style raw --stylize 250 --quality 2 --v 6`
- **DALL·E 3:** add *"portrait orientation, 1024x1536"* and use the
  *vivid* style for richer color saturation.
- **Stable Diffusion XL:** use a portrait-oriented base model (e.g.
  `sdxl-1.0` portrait), CFG ≈ 7, 40 steps, `--width 1024 --height 1536`.
  Add a refiner pass for crisper edges on filigree.
- **Adobe Firefly:** *Photo* art type, *Cinematic* style, *Tone-mapped*
  lighting. Best for commercial-safe output.

---

## 🟫 Bronze Pack — `public/packs/bronze.png`

| Attribute | Value |
|---|---|
| **Mood** | Foundation tier. Rugged, weathered, earned not granted. Blue-collar pro. |
| **Palette anchor (HSL)** | `15 75% 28%` deep terracotta → `25 95% 61%` orange ember → `32 97% 83%` peach highlight |
| **Center motif** | Patinated bronze shield embossed with a laurel branch and a single five-pointed star |
| **Frame** | Riveted bronze plates around the border, geometric Roman shield trim |
| **Lighting** | Warm low-angle ember glow from beneath, drifting dust motes |
| **Materials** | Oxidized copper edges, worn dark leather inset, hammered bronze rivets |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: a battle-worn bronze shield medallion embossed with a laurel branch and a single bold star, mounted on dark patinated leather. Frame: riveted bronze plates with geometric Roman trim along all four edges. Background: deep terracotta brown blending into warm orange ember at the center, hammered bronze surface texture. Lighting: low-angle warm ember glow rising from beneath the shield, drifting dust motes catching the light. Materials: oxidized copper, patinated bronze, worn dark leather, hammered metal rivets. Cinematic 8K studio render, sharp focal motif, dramatic chiaroscuro, no text, no watermark, no faces, no logos.

---

## ⚪ Silver Pack — `public/packs/silver.png`

| Attribute | Value |
|---|---|
| **Mood** | Polished, technical, precise. Mid-tier signed pro. |
| **Palette anchor (HSL)** | `215 19% 34%` gunmetal → `213 27% 84%` cool chrome → `214 32% 91%` silver shine |
| **Center motif** | Brushed-steel diamond crest holding two crossed laurel branches and twin stars |
| **Frame** | Machined aluminum panels along the border with subtle engraved hex-grid pattern |
| **Lighting** | Top-down cool blue-white rim light, central reflective bloom, holographic foil specks |
| **Materials** | Brushed steel, polished chrome, frosted glass, anodized aluminum |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: a brushed-steel diamond-shaped crest holding two crossed laurel branches and twin stars, polished to a mirror finish. Frame: machined aluminum panels along all four edges with subtle engraved hex-grid pattern. Background: gunmetal grey at the corners gradating to cool chrome at the center, fine machined-metal texture. Lighting: top-down cool blue-white rim light skimming the crest, central reflective bloom, scattered holographic foil specks drifting in the air. Materials: brushed steel, polished chrome, frosted glass, anodized aluminum. Cinematic 8K studio render, sharp focal motif, sleek high-contrast lighting, no text, no watermark, no faces, no logos.

---

## 🟡 Gold Pack — `public/packs/gold.png`

| Attribute | Value |
|---|---|
| **Mood** | Opulent, prestigious. Star player territory. |
| **Palette anchor (HSL)** | `23 83% 31%` deep amber → `38 92% 50%` radiant gold → `46 96% 65%` bright gold |
| **Center motif** | Ornate gilded medallion ringed by a brilliant rising sunburst, three stars in a triangle above |
| **Frame** | Warm gold-leaf border with baroque filigree scrollwork; small amber gemstones at the corners |
| **Lighting** | Centered golden halo glow, warm directional light from above-left, drifting gold dust motes |
| **Materials** | 24-karat gold leaf, polished gold, ornate baroque filigree, faceted amber gems |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: an ornate gilded medallion ringed by a brilliant rising sunburst, three small five-pointed stars arranged in a triangle directly above. Frame: warm gold-leaf border with intricate baroque filigree scrollwork on all four sides, small amber gemstones inlaid at the corners. Background: deep amber at the edges blending into radiant gold at the center, soft sunlit haze. Lighting: centered golden halo glow, warm directional light from above-left, drifting golden dust motes. Materials: 24-karat gold leaf, polished gold, ornate baroque filigree, faceted amber gems. Cinematic 8K studio render, opulent and luxurious, sharp focal motif, no text, no watermark, no faces, no logos.

---

## 🟠 Premium Gold — `public/packs/premium.png`

| Attribute | Value |
|---|---|
| **Mood** | Royal-grade gold. Champion's tier. |
| **Palette anchor (HSL)** | `24 78% 26%` deep amber-bronze → `43 96% 56%` honey gold → `48 96% 76%` champagne |
| **Center motif** | Regal golden crown atop an ornate cartouche on a brilliant cushion-cut amber gem; four stars in a wreath above |
| **Frame** | Champagne-gold marble border veined with gold leaf, art-deco geometric metallic inlay |
| **Lighting** | Dramatic chiaroscuro from above, central gem refracting prismatic golden rays outward |
| **Materials** | Polished royal gold, champagne marble, faceted amber gemstone, art-deco metallic filigree |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: a regal golden crown sitting atop an ornate cartouche, centered on a large brilliant cushion-cut amber gem casting refracted golden light beams outward, four small stars arranged in a laurel wreath above the crown. Frame: champagne-gold marble border veined with gold leaf, art-deco geometric metallic inlay along all four sides. Background: deep amber-bronze at the corners blending to champagne gold at the center, polished marble surface. Lighting: dramatic chiaroscuro from above with rim light on the crown, central amber gem refracting prismatic golden rays. Materials: polished royal gold, champagne marble, faceted amber gemstone, art-deco metallic filigree. Cinematic 8K studio render, regal and luxurious, hyper-detailed, no text, no watermark, no faces, no logos.

---

## 🟣 Rare Gold — `public/packs/rare.png`

| Attribute | Value |
|---|---|
| **Mood** | Mystical, electric, otherworldly. Walkout-tier signing. |
| **Palette anchor (HSL)** | `262 67% 35%` deep violet → `271 95% 75%` vivid amethyst → `330 86% 70%` hot pink |
| **Center motif** | Faceted prismatic gem hovering above a crystal pedestal, refracting violet and pink light beams |
| **Frame** | Hexagonal crystal lattice along the border, polished obsidian rim |
| **Lighting** | Pulsing inner-gem glow casting chromatic rainbow rays outward, cosmic atmosphere |
| **Materials** | Iridescent prism crystal, opalescent gem facets, polished obsidian, rainbow holographic foil |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: a large faceted prismatic gem hovering above a crystal pedestal, refracting brilliant violet and hot-pink light beams outward in chromatic rays, surrounded by floating prism shards and a few scattered five-pointed stars. Frame: hexagonal crystal lattice border on all four sides, polished obsidian rim. Background: cosmic nebula gradient — deep violet at the edges blending to vivid amethyst and hot pink at the center, faint star field, drifting cosmic dust. Lighting: pulsing inner-gem glow at the center casting chromatic rainbow rays outward, soft purple-pink atmosphere. Materials: iridescent prism crystal, opalescent gem facets, polished obsidian, rainbow holographic foil. Cinematic 8K studio render, mystical and electric, hyper-detailed, no text, no watermark, no faces, no logos.

---

## 🌟 Icon Pack — `public/packs/icon.png`

| Attribute | Value |
|---|---|
| **Mood** | Apex. Hall-of-fame legend. The grail. |
| **Palette anchor (HSL)** | `242 47% 34%` midnight navy → `51 98% 64%` lemon-gold → `48 96% 76%` champagne gold |
| **Center motif** | Colossal golden Roman emperor bust silhouette wreathed in a laurel crown, set inside a circular halo medallion with a sunburst behind |
| **Frame** | Monumental Greek-temple columns rising along the left and right edges, brushed-gold filigree top/bottom |
| **Lighting** | Cinematic god-rays from directly above, dramatic high-contrast gold-on-black, divine atmospheric glow |
| **Materials** | Solid 24k gold high-relief sculpture, polished white marble, deep navy enamel, brushed gold |

**Final prompt:**

> Vertical pack-card cover art, FIFA Ultimate Team aesthetic, EA Sports premium pack design, centered heraldic composition. Hero element: a monumental golden Roman emperor bust silhouette wreathed in a laurel crown, set inside a large circular halo medallion with a brilliant sunburst radiating outward behind it. Frame: tall classical Greek-temple columns rising along the left and right edges, ornate brushed-gold filigree along the top and bottom. Background: deep midnight navy void scattered with a constellation of golden specks like a starfield. Lighting: cinematic god-rays descending from directly above the bust, dramatic high-contrast gold-on-black, divine atmospheric glow around the medallion. Materials: solid 24k gold high-relief sculpture, polished white marble columns, deep navy enamel background, brushed-gold filigree, constellation gold dust. Cinematic 8K studio render, legendary and immortal, hyper-detailed, awe-inspiring, no text, no watermark, no faces, no logos.

---

## Composition Checklist (for review before exporting)

Run each generation through this list before saving the PNG:

- [ ] **Focal motif is centered** vertically *and* horizontally (the
      featured hero card crops to the middle band).
- [ ] **No text, no letters anywhere** — UI overlays the pack name and
      "Dynasty Pack" line at runtime.
- [ ] **No human faces or recognisable players** — keeps it
      copyright-clean and on-brand.
- [ ] **Color palette matches the HSL anchors** — not strictly identical,
      but the dominant hue/saturation should read as that tier.
- [ ] **Border has visible frame elements** but doesn't push to the edge
      (~5 % safe area to allow for the pack's own border + corner chips).
- [ ] **High dynamic range** — strong central glow + dark periphery so
      the pack reads against the dark game UI.

## After Exporting

1. Drop into `public/packs/<key>.png`.
2. Optimise via TinyPNG / Squoosh (target ≤ 400 KB).
3. Hard-reload the dev server (`npm run dev`). The art appears in:
   - The shop tile (Market → Packs)
   - The cinematic pack body during arrival/charge beats
4. If a file is missing or 404s, the original letter-in-circle
   placeholder is rendered automatically — no breakage.
