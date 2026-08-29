# Card backs — one AI prompt per card type

Thirteen backs, one per front in `public/player-cards/`. Copy a block, **attach
the matching front card image**, generate at `2:3`.

## What went wrong in v1 of this file

The prompts said "filling the entire frame edge to edge", which produced
rounded rectangles. The fronts are not rectangles — they are a heraldic plaque
with arched, scooped shoulders and a pointed base. Every prompt below now
describes that outline explicitly.

## The one rule that makes these work

The game cuts each back to its front's exact silhouette at render time. So the
artwork must do two things at once:

1. **Trace the plaque outline with its decorative border**, at about 76% width
   / 78% height — so the ornament follows the card's real shape.
2. **Still bleed the background material off all four edges** — so the runtime
   cut passes through plain material, never through ornament, and never leaves
   a transparent gap.

That combination is why these prompts do NOT ask for a transparent or flat
black backdrop. A shape floating on flat black gets its corners cut into
emptiness; a full-bleed rectangle gets its border sliced. The border traces the
shape, the material fills the frame.

## Settings for every generation

- Aspect `2:3` (Midjourney: `--ar 2:3 --style raw --stylize 250`)
- Deliver 1024x1536 or larger, any format. No transparency needed.
- Negative prompt, for tools that take one:

```
text, letters, numbers, typography, watermark, logo, player, face, portrait,
person, hands, perspective, tilted, 3/4 view, mockup, card floating in space,
table, drop shadow, transparent background, flat black backdrop, plain border
around the artwork, rectangle, rounded rectangle, square corners, cluttered,
asymmetrical, blurry
```

## File names

`card-back-<type>` using the type ids below — makes the registry wiring
mechanical.

---

## Bronze (under 70)

Attach `bronze.webp` · save as `card-back-bronze`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Hammered dark bronze metal, matte and workmanlike — an apprentice's card, humble but honestly crafted. At the exact centre a single plain laurel ring in raised bronze relief encircling a small five-sided shield. Sparse radial tooling marks in perfect bilateral symmetry. A thin single-rule bronze border traces the plaque outline. Dim warm light from the upper left, deep shadow lower right. Match the bronze palette and pitted metal texture of the attached card front. Deliberately simple — this is the lowest tier and must look it.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Silver (70-79)

Attach `silver.webp` · save as `card-back-silver`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Brushed steel and cool slate blue — #465a6d deepening at the edges, #dde6f0 highlights. Crisp machined chevron lines fold inward toward the centre in perfect bilateral symmetry. At the exact centre a polished silver roundel holding a minimal geometric football. A thin double-rule steel border traces the plaque outline. Faint cold specular sheen from the upper left. Match the silver palette and brushed-metal material of the attached card front. Precise, cool, professional.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Gold (80-89)

Attach `gold.webp` · save as `card-back-gold`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Radiant metallic gold: a sunburst of sharp golden fan rays exploding symmetrically from a centre point, deep amber #91400d at the edges rising to brilliant #fbd350 at the core — the same radiance as the attached card front. At the exact centre a bold gold laurel crest around a faceted football in raised relief. A thin double-rule gold border traces the plaque outline. Hot specular bloom at the middle. Rich and triumphant.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Icon (90+)

Attach `icon.webp` · save as `card-back-icon`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Sculpted white Carrara marble with fine grey veining and polished antique-gold inlay (#fde587, shadowed #a66c07) — the same white-marble material as the attached card front. At the exact centre a carved marble wing sweeping upward inside a gold ring, bas-relief depth, perfect bilateral symmetry. Fine gold guilloche filigree radiates outward. A thin double gold rule traces the plaque outline. Museum lighting from the upper left, soft shadows in the carving. Immaculate and exclusive — the top of the game.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Ballon d'Or

Attach `ballondor.webp` · save as `card-back-ballondor`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Deep midnight black lacquer with a blinding golden starburst at the centre: a perfectly round golden football on a small pedestal radiating fine gold light rays in perfect bilateral symmetry, gold #e6a605 to #fbc641 with deep #a66c07 shadows, matching the attached card front. Tiny gold stars scattered symmetrically across the dark field. A thin double gold rule traces the plaque outline. Ceremonial, once-a-season prestige.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Rise to Glory (free daily pack)

Attach `rise-to-glory.webp` · save as `card-back-rise-to-glory`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Dawn breaking over a stylised pitch horizon: a warm bronze-to-silver gradient sky, thin sunrise rays fanning upward from a central sun disc in perfect bilateral symmetry, the pitch rendered as two minimal engraved lines low in the field. Modest metallic finish — hopeful and fresh rather than opulent, a career beginning. A thin single-rule border traces the plaque outline. Match the palette of the attached card front.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Champions ($2.99 pack)

Attach `champions.webp` · save as `card-back-champions`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Deep amber-gold metal (#91400d rising to #f59f0a) with a proud engraved trophy cup at the exact centre, flanked by two symmetrical laurel branches in raised gold relief. Fine engraved rays radiate behind the trophy in perfect bilateral symmetry. A thin double-rule gold border traces the plaque outline. Warm stadium-glow bloom at the centre. Match the palette and material of the attached card front. Victorious, classic, earned.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Elite ($4.99 pack)

Attach `elite.webp` · save as `card-back-elite`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Near-black bronze lacquer with bright gold detailing (#78400f depths, #fde9a6 highlights). At the exact centre a faceted diamond-cut emblem — an abstract gem cut like a shield — surrounded by sharp angular art-deco linework folding inward in perfect bilateral symmetry. Sleeker and harder-edged than a classic gold card: fewer curves, more negative space. A thin double gold rule traces the plaque outline. Controlled specular glint on the facets. Match the palette of the attached card front.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## World Class ($6.99 pack)

Attach `world-class.webp` · save as `card-back-world-class`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Royal violet deepening to magenta (#481d94 into #f477c1 glow, #b775fb accents) with polished gold detailing. At the exact centre a gold-lined globe etched with fine latitude lines, a small football at its core, ringed by a gold orbit band — the world at this player's feet. Fine symmetrical guilloche radiates outward. A thin double gold rule traces the plaque outline. Cool iridescent sheen. Match the palette of the attached card front. Rare, electric, international.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Legends ($9.99 pack)

Attach `legends.webp` · save as `card-back-legends`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

White Carrara marble aged like a monument, with antique gold inlay (#e6a605, shadowed #a66c07). At the exact centre a grand gold laurel wreath enclosing a classical sculpted football in deep bas-relief, perfect bilateral symmetry. Banknote-fine gold engraving radiates outward, with small symmetrical flourishes where the border turns at the shoulders and the base point. A thin double gold rule traces the plaque outline. Match the white-marble-and-gold material of the attached card front. Timeless and immortal — the best card in the game.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Dynasty (promo week)

Attach `dynasty.webp` · save as `card-back-dynasty`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Deep royal purple velvet-lacquer with rich gold. At the exact centre an ornate gold crown above a shield bearing an abstract interlocking dynasty knot (no letters), in raised relief and perfect bilateral symmetry. Gold scrollwork folds inward from the border. A thin double gold rule traces the plaque outline. Regal specular sheen from the upper left. Match the palette of the attached card front. A ruling-house heirloom.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Golden Era (promo week)

Attach `golden-era.webp` · save as `card-back-golden-era`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Vintage art-deco gold on warm sepia-black: a grand symmetrical sunburst of alternating polished and matte gold rays from a central medallion holding a classic leather football, 1930s poster geometry, perfect bilateral symmetry. Stepped deco frame lines trace the plaque outline. Aged patina in the recesses, warm nostalgic glow. Match the palette of the attached card front. The golden age of the game, remembered.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## Royal Reserve (promo week)

Attach `royal-reserve.webp` · save as `card-back-royal-reserve`

```
The back of a football trading card, viewed perfectly flat and face-on. Draw the card as a HERALDIC PLAQUE SHAPE, not a rectangle. Its outline: perfectly straight vertical left and right sides; the top edge is a broad gentle arch across the centre that sweeps down and outward at each shoulder into a small concave scoop before meeting the side; the bottom edge sweeps inward from each corner in a long concave curve, the two curves meeting at a soft downward point at the centre. The decorative border must trace this exact outline all the way round, occupying about 76% of the image width and 78% of the image height, centred. Beyond that border the background material continues and bleeds off all four edges of the image — do NOT put the shape on a plain flat backdrop and do NOT leave empty margins.

Deep emerald green lacquer with polished gold. At the exact centre a formal royal wax-seal medallion in gold — an embossed football ringed by a fine rope-and-laurel border — in raised relief and perfect bilateral symmetry. Quiet diamond-pattern engraving across the emerald field. A thin double gold rule traces the plaque outline. Discreet specular light from the upper left. Match the palette of the attached card front. Private-cellar exclusivity, understated wealth.

Perfect bilateral symmetry — the card is seen mid-rotation when it flips, and any asymmetry wobbles. One bold central motif that still reads when the card is only 110 pixels tall. Absolutely no text, no letters, no numbers. No perspective, no tilt, no drop shadow, no scene behind the card. This is the BACK of a card and must never resemble a card front.
```

---

## When the images come back

Per image: 2:3 · plaque outline traced by the border · background bleeding off
all four edges · symmetrical · motif readable at 110px · no text · does not
resemble a card front.

Drop them here named as above. Conversion to webp and the front-to-back
registry (with the universal back as fallback for any type not yet drawn) is
my side — the files themselves need no masking.
