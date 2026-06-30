#!/usr/bin/env bash
#
# render-all.sh — Rasterise every generated screenshot to PNG at its exact
# App Store pixel size (1x — Apple requires precise dimensions, not @2x):
#
#   *.iphone.html → 1290×2796   (Apple 6.9" iPhone — 15/16 Pro Max class)
#   *.ipad.html   → 2048×2732   (Apple 12.9" iPad Pro)
#
# A single 6.9" set + a single 12.9" set is all App Store Connect needs;
# it downscales each to fill the smaller device slots.
#
# Regenerate the HTML first if you edited gen.mjs:  node gen.mjs
#
# Usage:  bash marketing/app-store/render-all.sh
# Output: marketing/app-store/dist/*.png
#
# Renders with the Chromium that ships in this environment. Falls back to a
# system `google-chrome`/`chromium` on the PATH if the bundled one is absent.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

# Locate a Chromium binary.
CHROME=""
for c in \
  /opt/pw-browsers/chromium-*/chrome-linux/chrome \
  "${CHROME_BIN:-}" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v chromium 2>/dev/null || true)" \
  "$(command -v chromium-browser 2>/dev/null || true)"; do
  if [[ -n "$c" && -x "$c" ]]; then CHROME="$c"; break; fi
done
if [[ -z "$CHROME" ]]; then
  echo "ERROR: no Chromium binary found." >&2
  exit 1
fi
echo "Using $CHROME"

render() { # file W H
  local f="$1" w="$2" h="$3" out="dist/${1%.html}.png"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="${w},${h}" --virtual-time-budget=4000 \
    --screenshot="$out" "file://$PWD/$f" >/dev/null 2>&1
  echo "  → $out (${w}×${h})"
}

echo "Rendering iPhone 6.9\" (1290×2796)…"
for f in shot-*.iphone.html; do render "$f" 1290 2796; done

echo "Rendering iPad 12.9\" (2048×2732)…"
for f in shot-*.ipad.html; do render "$f" 2048 2732; done

echo "✅ Done. ${#} Outputs in marketing/app-store/dist/"
ls dist/*.png | wc -l | xargs echo "PNG count:"
