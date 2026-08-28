# Card backs — one AI prompt per card type

Thirteen backs, one per front in `public/player-cards/`. Every block below is
self-contained: copy the prompt, **attach the matching front card image** (the
model reads its palette and material from the attachment), generate, done.

**How these get used:** since the runtime-mask fix, a back needs NO
transparency — deliver plain full-bleed rectangles and the game cuts each
card's silhouette itself. Deliver at 2:3 (1024×1536 or larger). I convert to
webp and wire the registry (front type → back art, universal fallback) when
the files land.

**Name the files like this** so wiring is mechanical:
`card-back-bronze`, `card-back-silver`, `card-back-gold`, `card-back-icon`,
`card-back-ballondor`, `card-back-rise-to-glory`, `card-back-champions`,
`card-back-elite`, `card-back-world-class`, `card-back-legends`,
`card-back-dynasty`, `card-back-golden-era`, `card-back-royal-reserve`.

**Settings for every generation**
- Aspect `2:3` (Midjourney: `--ar 2:3 --style raw --stylize 250`)
- One negative prompt for tools that take one:

```
text, letters, numbers, typography, watermark, logo, player, face, portrait,
person, hands, perspective, tilted, 3/4 view, mockup, card floating in space,
table, background scene, drop shadow, rounded corners cut out, transparent
background, white background, cluttered, asymmetrical, blurry
```

**The rules baked into every prompt (don't edit them out):**
flat-on view · fills the frame edge to edge · perfect bilateral symmetry
(the card is seen mid-flip; asymmetry wobbles) · one bold central motif that
survives 110px · no text · must read as a BACK, never a front.

---

## Tier shields (rating-based cards)

### 1 · Bronze (under 60–69)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Hammered dark bronze metal with a matte, workmanlike
finish — an apprentice's card, humble but crafted. At the exact centre, a
single plain laurel ring in raised bronze relief around a small five-sided
shield. Sparse tooling marks radiating in perfect bilateral symmetry, a thin
single-rule border inset from the edge. Dim, warm light from the upper left.
Match the bronze palette and material of the attached card front. Simple and
uncluttered — this is the lowest tier and must look it. Absolutely no text,
no numbers, no perspective, no background scene.
```

### 2 · Silver (70–79)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Brushed steel and cool slate blue (#465a6d deepening at
the edges, #dde6f0 highlights), with crisp machined chevron lines folding
toward the centre in perfect bilateral symmetry. At the exact centre, a
polished silver roundel holding a minimal geometric football. A thin
double-rule steel border inset from the edge, faint cold specular sheen from
the upper left. Match the silver palette and material of the attached card
front. Precise, cool, professional — a step above bronze, below gold.
Absolutely no text, no numbers, no perspective, no background scene.
```

### 3 · Gold (80–89)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Radiant metallic gold, a sunburst of sharp golden fan
rays exploding symmetrically from a centre point, deep amber #91400d at the
edges rising to brilliant #fbd350 at the core — the same radiance as the
attached card front. At the exact centre, a bold gold laurel crest around a
faceted football, in raised relief. Thin double-rule gold border inset from
the edge, hot specular bloom at the middle. Rich and triumphant. Absolutely
no text, no numbers, no perspective, no background scene.
```

### 4 · Icon (90+)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Sculpted white Carrara marble with fine grey veining and
polished antique-gold inlay lines (#fde587, shadowed #a66c07) — the same
white-marble material as the attached card front. At the exact centre, a
carved marble wing sweeping upward inside a gold ring, in perfect bilateral
symmetry, bas-relief depth. Fine gold guilloche filigree radiating outward,
thin double gold rule inset from the edge. Museum lighting from the upper
left, soft shadows in the carving. Immaculate, exclusive, the top of the
game. Absolutely no text, no numbers, no perspective, no background scene.
```

### 5 · Ballon d'Or

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Deep midnight black lacquer with a blinding golden
starburst at the centre: a perfectly round golden football on a small
pedestal, radiating fine gold light rays in perfect bilateral symmetry,
gold #e6a605 to #fbc641 with deep #a66c07 shadows — matching the attached
card front. Tiny gold stars scattered symmetrically in the dark field, thin
double gold rule inset from the edge. Ceremonial, once-a-season prestige,
the award card. Absolutely no text, no numbers, no perspective, no
background scene.
```

---

## Pack frames (earned by pulling at or above a pack's floor)

### 6 · Rise to Glory (free Daily pack)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Dawn breaking over a stylised football pitch horizon:
warm bronze-to-silver gradient sky, thin sunrise rays fanning upward from a
centre sun disc in perfect bilateral symmetry, the pitch rendered as two
minimal engraved lines at the base. Modest metallic finish, hopeful and
fresh rather than opulent — the free daily card, a career beginning. Match
the palette of the attached card front. Thin single-rule border inset from
the edge. Absolutely no text, no numbers, no perspective, no background
scene beyond the abstract horizon.
```

### 7 · Champions ($2.99 pack)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Deep amber-gold metal (#91400d rising to #f59f0a) with a
proud engraved trophy cup at the exact centre, flanked by two symmetrical
laurel branches in raised gold relief. Fine radiating engraved rays behind
the trophy in perfect bilateral symmetry, thin double-rule gold border inset
from the edge, warm stadium-glow bloom at the centre. Match the palette and
material of the attached card front. Victorious, classic, earned. Absolutely
no text, no numbers, no perspective, no background scene.
```

### 8 · Elite ($4.99 pack)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Near-black bronze lacquer with bright gold detailing
(#78400f depths, #fde9a6 highlights): at the exact centre a faceted
diamond-cut emblem — an abstract gem cut like a shield — surrounded by
sharp, angular art-deco line-work folding inward in perfect bilateral
symmetry. Sleeker and more modern than the Champions back: fewer curves,
harder edges, more negative space. Thin double gold rule inset from the
edge, controlled specular glint on the facets. Match the palette of the
attached card front. Absolutely no text, no numbers, no perspective, no
background scene.
```

### 9 · World Class ($6.99 pack)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Royal violet deepening to magenta (#481d94 into #f477c1
glow, #b775fb accents) with polished gold detailing: at the exact centre, a
gold-lined globe etched with fine latitude lines, a small football at its
core, ringed by a gold orbit band — the world at this player's feet. Fine
symmetrical guilloche radiating outward, thin double gold rule inset from
the edge, cool iridescent sheen. Match the palette of the attached card
front. Rare, electric, international. Absolutely no text, no numbers, no
perspective, no background scene.
```

### 10 · Legends ($9.99 pack)

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. White Carrara marble aged like a monument, with antique
gold inlay (#e6a605, shadowed #a66c07): at the exact centre, a grand gold
laurel wreath enclosing a classical sculpted football, in deep bas-relief
and perfect bilateral symmetry. Banknote-fine gold engraving radiating
outward, small symmetrical corner flourishes, thin double gold rule inset
from the edge. Match the white-marble-and-gold material of the attached card
front. Timeless, immortal — the best card in the game. Absolutely no text,
no numbers, no perspective, no background scene.
```

---

## Weekly promo frames (featured-week issues)

### 11 · Dynasty

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Deep royal purple velvet-lacquer with rich gold: at the
exact centre, an ornate gold crown above a shield bearing an abstract
interlocking dynasty knot (no letters), in raised relief and perfect
bilateral symmetry. Gold scrollwork borders folding inward, thin double gold
rule inset from the edge, regal specular sheen from the upper left. Match
the palette of the attached card front. A ruling-house heirloom. Absolutely
no text, no numbers, no perspective, no background scene.
```

### 12 · Golden Era

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Vintage art-deco gold on warm sepia-black: a grand
symmetrical sunburst of alternating polished and matte gold rays from a
centre medallion holding a classic leather football, 1930s poster geometry,
perfect bilateral symmetry. Stepped deco frame lines inset from the edge,
aged patina in the recesses, warm nostalgic glow. Match the palette of the
attached card front. The golden age of the game, remembered. Absolutely no
text, no numbers, no perspective, no background scene.
```

### 13 · Royal Reserve

```
The back of a football trading card, flat and face-on, filling the entire
frame edge to edge. Deep emerald green lacquer with polished gold: at the
exact centre, a formal royal wax-seal medallion in gold — an embossed
football ringed by fine rope-and-laurel border — in raised relief and
perfect bilateral symmetry. Quiet diamond-pattern engraving across the
emerald field, thin double gold rule inset from the edge, discreet specular
light from the upper left. Match the palette of the attached card front.
Private-cellar exclusivity, understated wealth. Absolutely no text, no
numbers, no perspective, no background scene.
```

---

## When the images come back

Checklist per image: 2:3 full-bleed · symmetrical · motif reads at 110px ·
no text · doesn't look like a card FRONT. Drop them here (any format), named
as above — I mask nothing into the files; conversion to webp and the
front→back registry with the universal fallback is my side.
