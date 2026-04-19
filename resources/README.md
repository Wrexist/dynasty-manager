# Capacitor asset masters

Drop two master images here and run `npm run assets:generate`. The
`@capacitor/assets` tool generates every iOS AppIconSet entry, every
Android `mipmap-*dpi/ic_launcher.png`, and the PWA favicon set from
these two files.

## Required files

### `icon.png`

- **Resolution:** 1024×1024
- **Format:** PNG, sRGB, opaque (no transparency — App Store rejects
  transparent iOS icons)
- **Content:** centred trophy-and-monogram composition (see prompt #1
  in the asset doc). No rounded corners — iOS rounds at render time.

### `splash.png`

- **Resolution:** 2732×2732 (square master; Capacitor generates all
  device variants from this one file)
- **Format:** PNG, sRGB
- **Content:** centred wordmark over the dark floodlit gradient (see
  prompt #3 in the asset doc). Keep all critical content within the
  central 50% — devices crop aggressively.

## Commands

```bash
# One-off after dropping new masters
npm run assets:generate

# Then propagate to the native projects
npm run cap:sync
```

## Fallback behaviour

If these files don't exist, `npm run assets:generate` errors cleanly.
The existing hand-rolled `public/icon-*.png` set still serves the PWA
manifest, so the web app keeps working until you populate these.
