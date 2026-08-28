# Card Back — AI image generation brief

The asset: `public/player-cards/card-back.webp`. One universal back for every
pack, shown face-down before the flip on both the walkout hero (244px wide) and
the 5-card grid tiles (~110px wide).

**Read the "Alpha" section before you generate anything.** No image model
reliably outputs a transparent silhouette, so the generated image is a
full-bleed rectangle and the card shape is cut afterwards. Generating "a card
on a transparent background" wastes credits and produces a picture *of* a card
floating in space, which is not what the code needs.

---

## The prompt

Paste as-is. Works on Midjourney, DALL·E 3, Ideogram, Flux, Firefly.

```
A luxury trading card back design, viewed perfectly flat and face-on, filling
the entire frame edge to edge. Deep midnight navy background (#0c1017) with a
soft radial light bloom rising from the lower centre. Ornate antique-gold
engraving in #e6a605 and #fbc641 with darker #a66c07 shadowing: a symmetrical
heraldic crest at the exact centre — a stylised laurel wreath enclosing a
faceted geometric football — framed by fine guilloche linework in the style of
banknote and passport engraving, radiating outward in perfect bilateral
symmetry. A thin double-rule gold border inset from the edges, with small
ornamental corner flourishes. Subtle metallic foil sheen catching light from
the upper left, falling to deep shadow at the lower right. Rich, premium,
timeless — the back of a collector's card, not the front. Absolutely no text,
no letters, no numbers. Flat-on orthographic view, no perspective, no tilt, no
drop shadow, no background scene, no hands, no table.
```

### Negative prompt

For tools that take one (Flux, Stable Diffusion, Ideogram):

```
text, letters, numbers, typography, watermark, signature, logo, brand name,
player photo, face, portrait, person, hands, perspective, tilted, angled,
3/4 view, mockup, card floating in space, table, background scene, drop shadow,
reflection, torn edges, rounded corners, white background, cluttered, busy,
low contrast, blurry, asymmetrical
```

### Settings

| | |
|---|---|
| **Aspect** | `2:3` (Midjourney: `--ar 2:3`) |
| **Target size** | 1024 × 1536 — upscale if the tool outputs smaller |
| **Style** | Midjourney: `--style raw --stylize 250`. Raw keeps the symmetry; high stylize invents asymmetric flourishes |
| **Seed** | Fix a seed once you like a direction, then iterate the prompt against it |

---

## Alpha — the part that matters

The front of the card is a **scalloped shield** whose transparent alpha *is*
its edge: notched top corners, a pointed base. The back must be cut to that
identical outline, or the card visibly changes shape mid-flip. That is the
exact bug this asset was created to fix.

So the workflow is:

1. Generate a **full-bleed rectangular** design at 2:3. Let the artwork run off
   all four edges — the outer ~6% gets cut away by the silhouette.
2. Cut it to the shield outline. **Send me the flat image and I'll do this** —
   the exact alpha channel is already in the repo (`public/player-cards/legends.webp`),
   so the cut is pixel-perfect and takes a minute. Doing it by hand risks a
   1px halo that reads as a white fringe on a dark background.
3. Export `.webp`, quality ~88. A 1024×1536 PNG is ~3.2 MB; the webp is ~0.45 MB,
   and a test enforces the format.

If you want to cut it yourself, mask against the alpha of any file in
`public/player-cards/` — they all share the silhouette.

---

## Constraints the design has to survive

- **It is rendered at 110px in the grid.** Fine filigree turns to mud at that
  size. The central crest must read as one confident shape from across a room.
- **A shimmer sweeps across it**, masked to the card outline, and a tier-coloured
  glow + holographic ring sit just outside the edge. Keep the artwork's own
  contrast mid-range: a very bright or very busy back leaves the glow nothing to
  read against, and the glow is now the only tier signal (one back serves
  Champions through Legends).
- **It must not look like a card front.** No rating corner, no position label,
  no stat rows, no player art. If a viewer could mistake it for a face-up card,
  the flip loses its payoff.
- **Symmetry is doing real work.** The card is seen mid-rotation during the
  flip; an asymmetric design wobbles visibly as it turns.
- **No text.** Partly because image models garble lettering, but mainly because
  the pack name is already printed above the card in the UI.

---

## Acceptance checklist

Before it goes in the repo:

- [ ] 1024 × 1536, exactly 2:3
- [ ] Reads clearly when scaled to 110px wide
- [ ] Perfectly symmetrical about the vertical axis
- [ ] No text, no real-world logos, no player likeness
- [ ] Artwork runs to all four edges (no built-in border of empty background)
- [ ] Cut to the shield alpha, no white fringe at the edge
- [ ] Exported `.webp`, under ~600 KB

---

## Alternative directions

If the first pass feels wrong, swap the crest motif and keep everything else:

| Direction | Replace the crest line with |
|---|---|
| **Stadium** | "a stylised floodlit stadium bowl seen from directly above, concentric gold tiers radiating outward" |
| **Monogram** | "a single ornate interlocking monogram letter D, drawn as one continuous gold ribbon" |
| **Pitch** | "an abstract football pitch marking — centre circle and halfway line — rendered as fine gold inlay on dark lacquer" |
| **Trophy** | "a faceted art-deco trophy silhouette in gold, flanked by symmetrical laurel branches" |

Keep the colour, symmetry, engraving style and no-text rules constant across
all of them — those are what make it belong to this app rather than to a
generic card game.
