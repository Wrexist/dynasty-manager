# Dynasty Manager — eight feature-led App Store compositions

This revision replaces the repetitive five-image campaign with eight different stories and 24 device-sized JPEGs. Numbered filenames define the proposed order. These are review assets; the existing player/data rights gate in `APP_STORE_LISTING.md` remains unresolved by this work. No App Store upload or submission has been performed.

| Order | Image | What it shows |
| --- | --- | --- |
| 01 | Your dream team. Your dynasty. | Approved six-player illustration plus the actual market controls |
| 02 | Eleven players. One vision. | A full Liverpool 4–3–3 illustration, eleven distinct roster players, and an actual mentality control capture |
| 03 | The big moments. Your decisions. | Match score, commentary, tactical controls and opponent comparison |
| 04 | Find the missing piece. | Transfer market, player attributes, make-offer action and budget |
| 05 | Great teams are developed. | Training categories, weekly schedule and individual drills |
| 06 | Build beyond the pitch. | Transfer budget, income, expenses and sponsorships |
| 07 | Your club. Your story. | Club dashboard, match preparation, coach checklist and management shortcuts |
| 08 | A club. A country. A legacy. | National team, tournament timing and formation selection |

![Eight-image overview](preview.jpg)

| Export folder | Portrait pixels | Images |
| --- | --- | --- |
| iphone-6.5 | 1242 × 2688 | 8 |
| iphone-6.9 | 1320 × 2868 | 8 |
| ipad-13 | 2064 × 2752 | 8 |

All exports are opaque sRGB JPEGs. iPad compositions reflow into two columns with full-bleed artwork; they do not stretch or pad the phone image. Interface excerpts remain phone UI captures, not evidence of the native iPad interface.

## Why eight

The first three communicate squad building, a complete XI and match-day management. The following five each add a different benefit. Eight is an editorial starting point, not a proven conversion optimum. Apple permits up to ten screenshots and recommends showing the app's UI, prioritising the first one to three, then focusing subsequent images on main benefits. Filling ten slots with repetition is not the goal. After release, test the first-three order using App Store product page optimization and measure conversion against the control before claiming an improvement.

## Capture and artwork provenance

- Interface excerpts are unretouched crops of the existing `public/ingame/` captures: `01-dynasty`, `03-minute`, `05-dominate`, `06-matters`, `07-battle`, `08-stars`, `09-books`, and `10-nation`. The exporter scales inspected crop coordinates to their actual 1284-pixel source width. It does not synthesize UI, rename players inside captures or alter game balances.
- The national-team crop excludes the duplicate goalkeeper rows in the older source image. Capture dates/build provenance were not available here; compare the excerpts against the shipping build before submission. The browser blocked a fresh local capture in this session.
- Image 02 is visibly labelled **Illustrated XI**. Its player names, natural positions and overall ratings are checked against `src/data/squads/england.ts` during export. Gakpo and Salah have LW/RW as alternate positions; Wirtz and Gravenberch have CM as an alternate position, fitting the illustrated 4–3–3. Alisson Becker is displayed as Alisson. The pitch graphic uses the repository's Gold and World Class artwork. It is not a fabricated screenshot of the lineup editor.
- Image 01 retains the owner's approved generated player illustration. All active players use blue World Class or purple Dynasty artwork; none uses ivory Icon artwork. This is promotional art, not a claim of player endorsement, guaranteed pack contents or exact paid-edition attributes. Names, portraits and dataset rights still need the owner's clearance before public use.
- Three text-free photographic backgrounds were created with built-in image generation: a charcoal/emerald night stadium, an ivory training clubhouse, and a black-marble gallery with an original generic gold cup. These are atmospheric promotional backgrounds, not in-game 3D graphics. No new player portraits were generated in this revision.
- Exact headlines, icons, formation labels and composition geometry are rendered separately from generated imagery. Source raster detail is limited by the existing captures and artwork; output dimensions do not imply newly captured native-device detail.
- No online play, guaranteed rewards, invented download results, endorsements, prices or ratings/reviews are claimed.

## Re-export and validate

Use Node and the **Sharp production image tool** (with SVG support and DejaVu Sans fonts available in the authoring environment):

```sh
node marketing/appstore-2026-09/export.mjs
```

Sharp is an external authoring prerequisite, not added to the app's package dependencies. The assets work without running the exporter. Keep the device-specific `masters/` and the referenced repository card artwork available when re-rendering. Seven completed designs are preserved as composition masters. The three lineup masters contain a cleared pitch; the exporter renders Liverpool’s exact roster labels and premium frames onto it.

The script verifies eleven distinct roster players, all 24 image dimensions, sRGB and absence of alpha. It removes obsolete JPEG filenames only within the three generated export folders, checks exact folder membership, and writes `manifest.json` and `preview.jpg`. It does not delete unrelated file types. The obsolete five-image campaign and its old masters have been removed. The eight-image campaign was recovered from its saved download after workspace maintenance; its device-specific composition masters are now included so it can be regenerated without relying on temporary files.

## Background prompt set (original composition artwork)

Built-in image generation produced these three text-free plates, followed by exact compositing of the genuine UI excerpts:

1. **Stadium:** premium football stadium at night, pitch-level view, emerald grass, charcoal architecture, restrained gold floodlights, central negative space; no people, text, cards, logos or UI.
2. **Clubhouse:** immaculate modern training centre, warm ivory plaster, brass trim, emerald practice pitches through glass, morning light and uncluttered central space; no people, text, logos, cards or UI.
3. **Trophy room:** black-marble gallery, emerald-black shadows, original generic polished gold bowl trophy in the lower-right quarter, subtle world-map relief and empty space; no branded trophy, people, text, logos, cards or UI.

Apple references checked 2026-09-08: [Product page guidance](https://developer.apple.com/app-store/product-page/), [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [Product page optimization](https://developer.apple.com/app-store/product-page-optimization/).
