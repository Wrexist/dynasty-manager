# Dynasty Manager — approved eight-image campaign

Owner-approved charcoal, emerald and gold promotional compositions. Images 01 and 03 are preserved byte-for-byte. The six replacements include portraits, the requested custom XI, packs and the Ballon d’Or feature. No gameplay code or App Store submission is included.

| Order | Theme | Content |
| --- | --- | --- |
| 01 | Dream team | Original approved player showcase, unchanged |
| 02 | Starting eleven | Barcola LW, Isak ST, Salah RW; Araújo replaces Konaté |
| 03 | Match day | Original approved match capture composition, unchanged |
| 04 | Transfer market | Owner-supplied Lamine Yamal portrait, 89 RM, Spain |
| 05 | Player development | Wirtz, training categories and weekly schedule |
| 06 | Club management | Budgets, sponsorships, income and expenses |
| 07 | Pack opening | Example Haaland reveal, World Class frame and card backs |
| 08 | Ballon d’Or | In-game Top 10 award card, seasonal rankings and temporary boost |

![Phone overview](preview.jpg)

| Folder | Pixels | Count |
| --- | --- | --- |
| iphone-6.5 | 1242 × 2688 | 8 |
| iphone-6.9 | 1320 × 2868 | 8 |
| ipad-13 | 2064 × 2752 | 8 |

The six new compositions are proportionally contained on a charcoal canvas, preserving all approved content without cropping or stretching. iPad exports therefore have side margins, not newly designed tablet UI. Images 01 and 03 retain their previous device-specific layouts. Export dimensions do not imply native source resolution.

## Provenance and limits

These are **promotional concepts**, not untouched gameplay captures. The new imagery was created with built-in image generation using supplied game screenshots and repository artwork as references. The small concept labels remain. Yamal uses the owner's supplied photograph with background removal and card compositing. Other portraits are generated representations. No active player uses the Icon background; the Ballon d’Or artwork is the separate award frame.

The XI follows the owner's saved-game reference and requested transfers, not a claim about Liverpool's current real-world roster. Existing player ratings reflect that reference, including Alisson 81 and Wirtz 86. Barcola 84 LW, Araújo 83 CB and Yamal 89 RM came from the repository roster. The old exporter’s claim to verify the entire XI against the base roster has been removed, because saved-game values differ. Generated text and likenesses are artwork, not data verification.

The pack image is an example reveal, not guaranteed Haaland contents. The Ballon d’Or benefits are backed by `src/pages/BallonDor.tsx`. New transfer, training and finance panels are promotional adaptations, not pixel-preserved UI. The existing player/data/photo rights gate in `APP_STORE_LISTING.md` remains unresolved by this work. Before submission, confirm rights and replace/adapt concepts as needed to accurately represent the shipping app. This PR does not claim App Store approval or release readiness.

## Re-export

Use Node with Sharp available as an external authoring tool (no new app dependency):

```sh
node marketing/appstore-2026-09/export.mjs
```

`masters/approved/` holds the six approved replacement masters. The other master directories retain only 01 and 03. The exporter verifies dimensions, sRGB, opacity and exactly eight JPEGs per device folder, removes obsolete JPEG filenames only in those output folders, and produces both previews and `manifest.json`.

## Prompt record

Built-in image edits/generation used these briefs, refined with the owner in conversation:

- XI: preserve charcoal/emerald campaign and game pitch structure; eleven gold cards with portraits; Barcola–Isak–Salah attack and Araújo at CB; readable names, ratings and three stats.
- Transfers: retain “Find the missing piece” campaign; remove the supplied Yamal photograph’s background and integrate into gold card; 89 RM and Spanish flag; retain market feature copy.
- Development: “Talent is the start. You shape the player.”; Wirtz portrait, reference training categories and weekly schedule; no invented numerical growth claims.
- Club: “Build more than a team.”; dark gold-edged budget, sponsor and income/expense feature panels; no fabricated money or profit figures.
- Packs: “Your next star. One reveal away.”; World Class Haaland example reveal with four face-down cards; no guaranteed player, odds or price claims.
- Award: “Greatness deserves gold.”; repository Ballon d’Or Top 10 card, Salah portrait, seasonal rankings and temporary stat boost; no real-world winner or endorsement claim.
