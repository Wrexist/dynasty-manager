# Card backs — GPT image prompts

Thirteen backs, one per card front. Written for **ChatGPT image generation**.

## The rule that makes these work

**The artwork must contain no card shape and no border.**

The game crops every back to its front's exact curved silhouette when it renders.
So the art only ever needs to be a full-bleed, edge-to-edge design — texture,
a central motif, something radiating outward. The crop then produces a perfectly
shaped card every time, for every tier and every pack frame.

Two earlier attempts failed for opposite reasons, and both were my briefing error:

| Brief said | GPT drew | Result after crop |
|---|---|---|
| "fill the frame edge to edge" | a rounded rectangle | fine, but a rectangular frame got sliced |
| "border traces the card outline" | the outline as a line on a rectangle | border fragments stranded at the edges |

Neither asked for the right thing. The right thing is simply: **no border at all.**

## How to run one

1. **New chat** for each card — GPT drifts toward the previous image otherwise.
2. **Attach the front card** named in the block; GPT reads its palette and material off it.
3. Paste the block **exactly as-is**. Nothing to configure, no flags.
4. Save as the given filename, any format, and send it to me.

If a result comes back with a frame or a card shape in it, reply in that same chat:

```
Remove the border and the card outline completely. Fill the entire image edge to
edge with the material and the design. There must be no frame, no outline and no
card shape anywhere in the picture.
```

## Priority

If you would rather not run all thirteen, these five cover roughly 95% of every
card a player sees face-down: **gold, icon, legends, silver, rise-to-glory**.
The three promo backs can wait for their featured weeks; anything not yet drawn
falls back to the universal back already shipping.

---

## Bronze — under 70

**Attach:** `bronze.webp`  ·  **Save as:** `card-back-bronze`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Hammered dark bronze, matte and workmanlike, with a finely pitted cast surface — an apprentice's card: humble but honestly made.

CENTRE — A single plain laurel ring in raised bronze relief encircling a small five-sided shield.

FIELD — Sparse tooling marks radiating outward from behind the centre, fading into the metal.

LIGHT — Dim warm light from the upper left, deep shadow at the lower right.

Take the bronze colour and pitted texture from the attached card. Keep it deliberately simple — this is the lowest tier and should look modest beside gold.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Silver — 70-79

**Attach:** `silver.webp`  ·  **Save as:** `card-back-silver`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Brushed steel and cool slate blue: deep #465a6d in the shadows rising to bright #dde6f0 highlights, with a fine machined grain.

CENTRE — A polished silver roundel holding a minimal geometric football.

FIELD — Crisp machined chevron lines folding inward toward the centre, tightening as they approach it.

LIGHT — Cold, faint specular sheen raking from the upper left.

Take the silver colour and brushed-metal finish from the attached card. Precise, cool and professional — clearly above bronze and below gold.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Gold — 80-89

**Attach:** `gold.webp`  ·  **Save as:** `card-back-gold`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Radiant metallic gold, deep amber #91400d at the outside rising to brilliant #fbd350 toward the middle — the same radiance as the attached card.

CENTRE — A bold gold laurel crest around a faceted football in raised relief.

FIELD — A sunburst of sharp golden fan rays exploding outward from directly behind the crest, reaching the edges of the image.

LIGHT — A hot specular bloom at the centre, falling off toward the outside.

Rich and triumphant, unmistakably the gold tier.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Icon — 90 and above

**Attach:** `icon.webp`  ·  **Save as:** `card-back-icon`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Sculpted white Carrara marble with fine grey veining and polished antique-gold inlay (#fde587, shadowed #a66c07) — the same white-marble material as the attached card.

CENTRE — A carved marble wing sweeping upward inside a gold ring, with real bas-relief depth.

FIELD — Fine gold guilloche filigree radiating outward from the centre across the marble.

LIGHT — Museum lighting from the upper left, soft shadows inside the carving.

Immaculate and exclusive — the very top of the game.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Ballon d'Or — season award

**Attach:** `ballondor.webp`  ·  **Save as:** `card-back-ballondor`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Deep midnight-black lacquer, glassy and dark, lit almost entirely by what sits at its centre.

CENTRE — A perfectly round golden football on a small pedestal, gold #e6a605 to #fbc641 with deep #a66c07 shadows, matching the attached card.

FIELD — A blinding starburst of fine gold light rays thrown outward from the ball, with tiny gold stars scattered evenly through the dark field.

LIGHT — All light emanating from the centre outward; the corners fall to near black.

Ceremonial and rare — a once-a-season honour.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Rise to Glory — free daily pack

**Attach:** `rise-to-glory.webp`  ·  **Save as:** `card-back-rise-to-glory`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — A modest metallic finish washed in a warm bronze-to-silver gradient, like dawn light on brushed metal.

CENTRE — A small sun disc low in the middle of the image, with two minimal engraved pitch lines beneath it.

FIELD — Thin sunrise rays fanning upward and outward from the disc, spreading to the top corners.

LIGHT — Soft low-angle dawn light rising from below the centre.

Take the palette from the attached card. Hopeful and fresh rather than opulent — the beginning of a career.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Champions — $2.99 pack

**Attach:** `champions.webp`  ·  **Save as:** `card-back-champions`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Deep amber-gold metal, #91400d deepening at the outside and rising to #f59f0a toward the middle.

CENTRE — A proud engraved trophy cup flanked by two laurel branches in raised gold relief.

FIELD — Fine engraved rays radiating outward behind the trophy, with a warm stadium-glow bloom around it.

LIGHT — Warm golden light from above, glowing strongest just behind the cup.

Take the colour and metal finish from the attached card. Victorious, classic, earned.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Elite — $4.99 pack

**Attach:** `elite.webp`  ·  **Save as:** `card-back-elite`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Near-black bronze lacquer with bright gold detailing: #78400f in the depths, #fde9a6 in the highlights.

CENTRE — A faceted diamond-cut emblem — an abstract gem cut in the shape of a shield.

FIELD — Sharp angular art-deco linework folding inward toward the gem, with generous empty lacquer between the lines.

LIGHT — Controlled hard glints catching individual facets; the field stays dark.

Take the palette from the attached card. Sleeker and harder-edged than the gold tier: fewer curves, more negative space.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## World Class — $6.99 pack

**Attach:** `world-class.webp`  ·  **Save as:** `card-back-world-class`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Royal violet deepening into magenta — #481d94 through a #f477c1 glow with #b775fb accents — with polished gold detailing and a cool iridescent sheen.

CENTRE — A gold-lined globe etched with fine latitude lines, a small football at its core, ringed by a gold orbit band.

FIELD — Fine guilloche radiating outward from the globe, dissolving into the violet field.

LIGHT — Cool iridescent light shifting across the surface, brightest around the orbit ring.

Take the palette from the attached card. Rare, electric, international — the world at this player's feet.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Legends — $9.99 pack

**Attach:** `legends.webp`  ·  **Save as:** `card-back-legends`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — White Carrara marble aged like a monument, inlaid with antique gold (#e6a605, shadowed #a66c07).

CENTRE — A grand gold laurel wreath enclosing a classical sculpted football in deep bas-relief.

FIELD — Banknote-fine gold engraving radiating outward from the wreath across the marble.

LIGHT — Reverent museum light from the upper left, deep shadow pooling in the carved recesses.

Take the white-marble-and-gold material from the attached card. Timeless and immortal — the best card in the game.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Dynasty — promo week

**Attach:** `dynasty.webp`  ·  **Save as:** `card-back-dynasty`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Deep royal purple velvet-lacquer with rich gold detailing.

CENTRE — An ornate gold crown above a shield bearing an abstract interlocking knot motif — a pure ornament, never a letter — in raised relief.

FIELD — Gold scrollwork unfurling outward from the crest across the purple field.

LIGHT — Regal specular sheen from the upper left, the velvet drinking the light elsewhere.

Take the palette from the attached card. It should feel like a ruling house's heirloom.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Golden Era — promo week

**Attach:** `golden-era.webp`  ·  **Save as:** `card-back-golden-era`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Vintage art-deco gold on warm sepia-black, with an aged patina settled into every recess.

CENTRE — A central medallion holding a classic leather football, drawn with 1930s poster geometry.

FIELD — A grand sunburst of alternating polished and matte gold rays spreading from the medallion to every edge.

LIGHT — Warm nostalgic glow, like a lithograph poster under lamplight.

Take the palette from the attached card. The golden age of the game, remembered.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Royal Reserve — promo week

**Attach:** `royal-reserve.webp`  ·  **Save as:** `card-back-royal-reserve`

```
Create the back of a collectible football trading card. Portrait orientation, 2:3 ratio, 1024x1536.

MATERIAL — Deep emerald-green lacquer with polished gold, quiet and expensive.

CENTRE — A formal royal wax-seal medallion in gold — an embossed football ringed by a fine rope-and-laurel border — in raised relief.

FIELD — Quiet diamond-pattern engraving running across the emerald field behind the seal.

LIGHT — Discreet specular light from the upper left; nothing glares.

Take the palette from the attached card. Private-cellar exclusivity, understated wealth.

CRITICAL — FILL THE WHOLE IMAGE. The artwork must run right off all four edges. Do NOT draw a border, a frame, an outline, an edge line, a corner ornament, or the shape of a card. Do not place the design on a backdrop. The image is cropped to a curved shield silhouette afterwards, so anything drawn near the edge is destroyed — keep every important element inside the middle 70% and let only texture reach the edges.

NEVER — no text, letters, numbers, signatures or logos anywhere. No player, face or person. No perspective, tilt or 3D angle. No drop shadow, no table, no room, no scene behind it. Perfectly symmetrical left to right. Must not resemble the FRONT of a card: no rating corner, no stat rows, no name plate.
```

---

## Checklist when they come back

Per image: no border, no frame, no card shape · design reaches all four edges ·
main motif inside the middle 70% · symmetrical · readable when small · no text ·
doesn't resemble a card front.

Conversion and wiring is my side — the files need no masking, no transparency
and no cropping from you.
