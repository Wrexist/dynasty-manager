# Card backs — GPT image prompts

Thirteen backs, one per card front, with palettes **measured off the shipped
artwork** rather than guessed.

## Two rules, and everything else is flavour

**1. No border, no frame, no card shape.** The game crops every back to its
front's exact curved silhouette when it renders. The art only needs to be a
full-bleed design with its motif held inside the middle 70%. Anything drawn near
the edge is destroyed by the crop.

**2. The colours are given as hex, and they are not negotiable.** Earlier
versions of this file said things like "take the colour from the attached card",
which is not enough — GPT needs numbers. Worse, some of those prompts named
colours from the pack storefront gradients instead of the card art, which is why
Elite came out bronze when the real card is navy blue.

## Corrections in this version

Measured from `public/player-cards/*.webp`:

| Card | I previously wrote | It actually is |
|---|---|---|
| Bronze | "dark bronze, matte" | burnt copper and rust, bright gold highlights |
| Silver | dark slate #465a6d | a LIGHT pearl-grey card |
| Icon | white marble | correct, and it is pale — keep it light |
| Champions | amber gold | essentially GREYSCALE, silver-white on graphite |
| Elite | near-black bronze + gold | deep NAVY BLUE with icy white glints |
| World Class | violet and magenta | royal BLUE with warm gold |
| Legends | white marble | deep antique bronze-brown |
| Rise to Glory | bronze-to-silver dawn | near-black blue night, warm dawn accent only |

## How to run one

1. **New chat** per card — GPT drifts toward the previous image otherwise.
2. **Attach the front card** named in the block.
3. Paste the block **exactly as-is**. No flags, nothing to configure.
4. Save as the given filename, any format, send it to me. I crop and convert.

If a result comes back with a frame or a card shape:

```
Remove the border and the card outline completely. Fill the entire image edge to
edge with the material and the design. There must be no frame, no outline and no
card shape anywhere in the picture.
```

If the colour is off:

```
The colours are wrong. Use exactly these: <paste the BASE and ACCENT lines from
the prompt>. Match those values closely.
```

## Priority

**gold, icon, legends, silver, rise-to-glory** cover roughly 95% of every card a
player sees face-down. The three promo backs can wait for their featured weeks;
anything not yet drawn falls back to the universal back already shipping.

---

## Bronze — under 70

**Attach:** `bronze.webp`  ·  **Save as:** `card-back-bronze`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Burnt copper and rust. Deep oxidised brown-red in the corners (#3c1400 and #501400) warming through burnt orange (#8c3c14, #dd7125) toward the middle, with a finely pitted cast-metal surface.

ACCENT — All raised ornament and engraving is metallic, catching highlights of #ffc864 through #fff078.

CENTRE — A single plain laurel ring in raised relief encircling a small five-sided shield.

FIELD — Sparse engraved tooling marks radiating outward from behind the wreath, fading into the corroded metal.

LIGHT — Low warm light from the upper left; the corners fall away into deep rust shadow.

CHARACTER — Deliberately simple and workmanlike — this is the lowest tier and should look modest beside gold.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Silver — 70-79

**Attach:** `silver.webp`  ·  **Save as:** `card-back-silver`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Bright polished silver, LIGHT overall rather than dark: cool pearl greys and lavender-white (#b4b4c8, #c8c8dc) across a finely brushed metal grain.

ACCENT — All raised ornament and engraving is metallic, catching highlights of pure white #ffffff and #fffff0.

CENTRE — A polished silver roundel holding a minimal geometric football.

FIELD — Crisp machined chevron lines folding inward toward the roundel, tightening as they approach it.

LIGHT — Cold specular sheen raking across from the upper left, catching the brushed grain.

CHARACTER — Precise, cool and clinical — clearly above bronze and below gold. Keep it light and bright, NOT a dark card.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Gold — 80-89

**Attach:** `gold.webp`  ·  **Save as:** `card-back-gold`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Warm amber gold: deep #b46400 at the outside rising through #c88c28 and #dca028 toward the middle, on struck metal.

ACCENT — All raised ornament and engraving is metallic, catching highlights of brilliant #fff064 through #ffff78.

CENTRE — A bold gold laurel crest around a faceted football in raised relief.

FIELD — A sunburst of sharp golden fan rays exploding outward from directly behind the crest, reaching the edges.

LIGHT — A hot specular bloom at the centre falling off toward the corners.

CHARACTER — Rich and triumphant — unmistakably the gold tier.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Icon — 90 and above

**Attach:** `icon.webp`  ·  **Save as:** `card-back-icon`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Pale sculpted marble, LIGHT overall: soft warm whites and greys (#c8c8c8, #dcdcdc, #dcdcc8) with fine grey veining.

ACCENT — All raised ornament and engraving is metallic, catching highlights of warm ivory #fff0dc.

CENTRE — A carved marble wing sweeping upward inside a slim gold ring, with real bas-relief depth.

FIELD — Fine engraved guilloche filigree radiating outward from the centre across the marble.

LIGHT — Museum lighting from the upper left, soft shadows pooling inside the carving.

CHARACTER — Immaculate and exclusive — the very top of the game. Keep it pale and luminous, NOT a dark card.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Ballon d'Or — season award

**Attach:** `ballondor.webp`  ·  **Save as:** `card-back-ballondor`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Near-black with a warm cast (#141400, #281400), lit almost entirely by what sits at its centre.

ACCENT — All raised ornament and engraving is metallic, catching highlights of champagne gold #fff08c through #fff0a0.

CENTRE — A perfectly round golden football on a small pedestal.

FIELD — A blinding starburst of fine gold rays thrown outward from the ball, with tiny gold stars scattered through the dark field.

LIGHT — All light emanating from the centre outward; the corners fall to near black.

CHARACTER — Ceremonial and rare — a once-a-season honour.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Rise to Glory — free daily pack

**Attach:** `rise-to-glory.webp`  ·  **Save as:** `card-back-rise-to-glory`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Deep near-black with a cool blue cast (#141414, #141428, #282828) — a night sky just before sunrise, NOT a bright card.

ACCENT — All raised ornament and engraving is metallic, catching highlights of warm dawn cream #fff0c8 through #fff0dc.

CENTRE — A small rising sun disc low in the middle, with two minimal engraved pitch lines beneath it.

FIELD — Thin sunrise rays fanning upward and outward from the disc into the dark field.

LIGHT — Soft low-angle dawn light rising from below the centre; everything above stays dark.

CHARACTER — Hopeful and quiet rather than opulent — the beginning of a career.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Champions — $2.99 pack

**Attach:** `champions.webp`  ·  **Save as:** `card-back-champions`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Cool neutral graphite, essentially GREYSCALE: charcoal through mid grey (#141414, #282828, #3c3c3c) on brushed metal.

ACCENT — All raised ornament and engraving is metallic, catching highlights of clean silver-white #ffffff.

CENTRE — A proud engraved trophy cup flanked by two laurel branches in raised silver relief.

FIELD — Fine engraved rays radiating outward behind the trophy, with a cool bloom around it.

LIGHT — Bright directional light from above, glowing strongest just behind the cup.

CHARACTER — Victorious and classic — but SILVER-WHITE on graphite, not gold.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Elite — $4.99 pack

**Attach:** `elite.webp`  ·  **Save as:** `card-back-elite`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Deep navy blue: near-black blue in the corners (#001414, #001428) lifting through #14283c toward the middle, on dark lacquer.

ACCENT — All raised ornament and engraving is metallic, catching highlights of icy white-blue #dcffff through #ffffff.

CENTRE — A faceted diamond-cut emblem — an abstract gem cut in the shape of a shield.

FIELD — Sharp angular art-deco linework folding inward toward the gem, with generous empty lacquer between the lines.

LIGHT — Hard cold glints catching individual facets; the field stays dark.

CHARACTER — Sleeker and harder-edged than gold: fewer curves, more negative space. BLUE, not bronze.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## World Class — $6.99 pack

**Attach:** `world-class.webp`  ·  **Save as:** `card-back-world-class`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Rich royal blue: deepest #001428 at the corners rising through #00143c to #001450 toward the middle.

ACCENT — All raised ornament and engraving is metallic, catching highlights of warm gold #fff0a0 through #fff0c8.

CENTRE — A gold-lined globe etched with fine latitude lines, a small football at its core, ringed by a gold orbit band.

FIELD — Fine guilloche radiating outward from the globe, dissolving into the blue field.

LIGHT — Cool light across the blue with the gold ornament catching warm highlights.

CHARACTER — Rare and international — the world at this player's feet. BLUE and gold, not violet.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Legends — $9.99 pack

**Attach:** `legends.webp`  ·  **Save as:** `card-back-legends`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Deep antique bronze-brown: #141400 and #281400 in the corners warming through #643c14 toward the middle, aged like a monument.

ACCENT — All raised ornament and engraving is metallic, catching highlights of pale antique gold #ffdca0 through #fff0b4.

CENTRE — A grand gold laurel wreath enclosing a classical sculpted football in deep bas-relief.

FIELD — Banknote-fine gold engraving radiating outward from the wreath across the aged bronze.

LIGHT — Reverent low light from the upper left, deep shadow pooling in the carved recesses.

CHARACTER — Timeless and immortal — the best card in the game.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Dynasty — promo week

**Attach:** `dynasty.webp`  ·  **Save as:** `card-back-dynasty`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Very dark royal purple, almost black (#140014, #281414) with a velvet depth.

ACCENT — All raised ornament and engraving is metallic, catching highlights of pale gold #f0ffc8 through #ffffc8.

CENTRE — An ornate gold crown above a shield bearing an abstract interlocking knot motif — a pure ornament, never a letter.

FIELD — Gold scrollwork unfurling outward from the crest across the near-black purple.

LIGHT — Regal specular sheen from the upper left; the velvet drinks the light elsewhere.

CHARACTER — A ruling house's heirloom.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Golden Era — promo week

**Attach:** `golden-era.webp`  ·  **Save as:** `card-back-golden-era`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Warm sepia-black: #141400 and #281400 deepening at the corners, lifting to #502800 toward the middle, with aged patina in every recess.

ACCENT — All raised ornament and engraving is metallic, catching highlights of buttery gold #fff0b4 through #ffffc8.

CENTRE — A central medallion holding a classic leather football, drawn with 1930s poster geometry.

FIELD — A grand sunburst of alternating polished and matte gold rays spreading from the medallion toward every edge.

LIGHT — Warm nostalgic glow, like a lithograph poster under lamplight.

CHARACTER — The golden age of the game, remembered.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Royal Reserve — promo week

**Attach:** `royal-reserve.webp`  ·  **Save as:** `card-back-royal-reserve`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

BASE COLOURS — Dark olive-bronze, quiet and expensive: #141400 and #282814 in the corners lifting to #604818 toward the middle.

ACCENT — All raised ornament and engraving is metallic, catching highlights of old gold #ffdca0 through #fff0b4.

CENTRE — A formal royal wax-seal medallion — an embossed football ringed by a fine rope-and-laurel border — in raised relief.

FIELD — Quiet diamond-pattern engraving running across the dark field behind the seal.

LIGHT — Discreet light from the upper left; nothing glares.

CHARACTER — Private-cellar exclusivity, understated wealth.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Checklist when they come back

No border, no frame, no card shape · design reaches all four edges · motif inside
the middle 70% · colours match the BASE and ACCENT values · symmetrical ·
readable when small · no text · doesn't resemble a card front.

Cropping, conversion and wiring is my side — the files need no masking,
transparency or trimming from you.
