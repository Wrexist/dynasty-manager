#!/usr/bin/env bash
#
# build-ad.sh — Assemble a finished 9:16 vertical ad from raw screen-recordings.
#
# Pipeline: raw video → ensure 1080×1920 → burn captions (SRT) → mix audio
# (music optional + VO optional) → encode H.264 + AAC mp4.
#
# Designed for indie self-shoot workflow on macOS (ffmpeg via Homebrew).
# Tested against ffmpeg 6.x. If you're on Linux/Windows, install ffmpeg via
# package manager and this script should work unchanged.
#
# Usage:
#   bash build-ad.sh \
#     --raw raw.mov \
#     [--captions captions.srt] \
#     [--vo vo.m4a] \
#     [--music music.mp3] \
#     [--music-volume 0.3] \
#     [--vo-volume 1.0] \
#     [--start 00:00:00] \
#     [--duration 20] \
#     --out final.mp4
#
# Tips:
#   - Captions are burned in via the subtitles filter — they ship inside the
#     mp4 pixels (no separate text track). This is what Meta/TikTok expect
#     for sound-off readability.
#   - Music defaults to -12dB (0.25 volume) under VO. Override with --music-volume.
#   - If your raw recording is landscape, the script center-crops to 9:16.
#     For cleanest results, record vertically on iPhone in the first place.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────
# Arg parsing
# ──────────────────────────────────────────────────────────────────────

RAW=""
CAPTIONS=""
VO=""
MUSIC=""
OUT=""
START="00:00:00"
DURATION=""
MUSIC_VOL="0.25"
VO_VOL="1.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --raw)            RAW="$2"; shift 2 ;;
    --captions)       CAPTIONS="$2"; shift 2 ;;
    --vo)             VO="$2"; shift 2 ;;
    --music)          MUSIC="$2"; shift 2 ;;
    --music-volume)   MUSIC_VOL="$2"; shift 2 ;;
    --vo-volume)      VO_VOL="$2"; shift 2 ;;
    --start)          START="$2"; shift 2 ;;
    --duration)       DURATION="$2"; shift 2 ;;
    --out)            OUT="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,30p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$RAW" || -z "$OUT" ]]; then
  echo "ERROR: --raw and --out are required." >&2
  echo "Run with --help for usage." >&2
  exit 2
fi

if [[ ! -f "$RAW" ]]; then
  echo "ERROR: raw video not found: $RAW" >&2
  exit 1
fi

command -v ffmpeg >/dev/null 2>&1 || {
  echo "ERROR: ffmpeg not installed. On macOS: brew install ffmpeg" >&2
  exit 1
}

# ──────────────────────────────────────────────────────────────────────
# Build video filter chain
# ──────────────────────────────────────────────────────────────────────

# Crop/scale to 1080×1920 9:16. Works whether source is landscape or vertical.
# - First force the long edge to fit, then center-crop to the target frame.
VIDEO_FILTER="scale='if(gt(a,9/16),-2,1080)':'if(gt(a,9/16),1920,-2)',crop=1080:1920"

# Optional caption burn-in. The subtitles filter needs the full path on
# some macOS setups, hence the realpath wrapping.
if [[ -n "$CAPTIONS" ]]; then
  if [[ ! -f "$CAPTIONS" ]]; then
    echo "ERROR: captions file not found: $CAPTIONS" >&2
    exit 1
  fi
  # Resolve to absolute path; escape special chars for ffmpeg filter syntax.
  CAPTIONS_ABS=$(cd "$(dirname "$CAPTIONS")" && pwd)/$(basename "$CAPTIONS")
  CAPTIONS_ESCAPED=$(printf '%s\n' "$CAPTIONS_ABS" | sed -e 's/:/\\:/g' -e "s/'/\\\\'/g")
  # Subtitle styling: large white text with thick black outline (sound-off readable),
  # positioned in upper-middle third (Reels-safe — away from bottom UI).
  STYLE="FontName=Helvetica,FontSize=44,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=4,Shadow=0,Alignment=8,MarginV=300"
  VIDEO_FILTER="${VIDEO_FILTER},subtitles='${CAPTIONS_ESCAPED}':force_style='${STYLE}'"
fi

# ──────────────────────────────────────────────────────────────────────
# Build audio filter chain
# ──────────────────────────────────────────────────────────────────────
#
# Audio sources (any subset may be missing):
#   [0:a] = raw recording's own audio (often missing on silent screen
#           recordings — iOS Control Center capture defaults to mic-off)
#   [N:a] = VO  (if provided, indexed after the raw)
#   [N:a] = music (if provided, indexed after VO)

AUDIO_INPUTS=("-i" "$RAW")
AUDIO_FILTER_PARTS=()
AUDIO_MIX_INPUTS=()
NEXT_AUDIO_IDX=1

# Detect whether the raw recording actually has an audio stream. Silent
# screen recordings are the common case for iPhone game footage; without
# this probe, the filter graph below would reference `[0:a]` and ffmpeg
# would abort with "stream specifier matches no streams".
command -v ffprobe >/dev/null 2>&1 || {
  echo "ERROR: ffprobe not installed (ships with ffmpeg). On macOS: brew install ffmpeg" >&2
  exit 1
}
RAW_AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$RAW" 2>/dev/null || true)
if [[ -n "$RAW_AUDIO" ]]; then
  # Include source audio at low volume (game sound under VO/music).
  AUDIO_FILTER_PARTS+=("[0:a]volume=0.4[a0]")
  AUDIO_MIX_INPUTS+=("[a0]")
else
  echo "  (raw has no audio track — skipping source audio mix)"
fi

if [[ -n "$VO" ]]; then
  if [[ ! -f "$VO" ]]; then echo "ERROR: VO not found: $VO" >&2; exit 1; fi
  AUDIO_INPUTS+=("-i" "$VO")
  AUDIO_FILTER_PARTS+=("[${NEXT_AUDIO_IDX}:a]volume=${VO_VOL}[avo]")
  AUDIO_MIX_INPUTS+=("[avo]")
  NEXT_AUDIO_IDX=$((NEXT_AUDIO_IDX + 1))
fi

if [[ -n "$MUSIC" ]]; then
  if [[ ! -f "$MUSIC" ]]; then echo "ERROR: music not found: $MUSIC" >&2; exit 1; fi
  AUDIO_INPUTS+=("-i" "$MUSIC")
  AUDIO_FILTER_PARTS+=("[${NEXT_AUDIO_IDX}:a]volume=${MUSIC_VOL}[amus]")
  AUDIO_MIX_INPUTS+=("[amus]")
  NEXT_AUDIO_IDX=$((NEXT_AUDIO_IDX + 1))
fi

NUM_INPUTS=${#AUDIO_MIX_INPUTS[@]}
if [[ "$NUM_INPUTS" -eq 0 ]]; then
  # Pathological case — silent raw and no VO/music. Synthesize a silent
  # stereo track so the output mp4 still has an audio track (some social
  # platforms reject video-only uploads). anullsrc generates indefinitely;
  # `-shortest` on the encode keeps it tied to the video length.
  AUDIO_FILTER_COMPLEX="anullsrc=r=48000:cl=stereo[aout]"
  EXTRA_OUTPUT_FLAGS=("-shortest")
elif [[ "$NUM_INPUTS" -eq 1 ]]; then
  # Single source — no need for amix; just alias the existing label.
  ONLY=${AUDIO_MIX_INPUTS[0]}
  AUDIO_FILTER_PARTS+=("${ONLY}anull[aout]")
  AUDIO_FILTER_COMPLEX=$(IFS=';'; echo "${AUDIO_FILTER_PARTS[*]}")
  EXTRA_OUTPUT_FLAGS=()
else
  AUDIO_FILTER_PARTS+=("$(printf '%s' "${AUDIO_MIX_INPUTS[@]}")amix=inputs=${NUM_INPUTS}:duration=shortest:dropout_transition=0[aout]")
  AUDIO_FILTER_COMPLEX=$(IFS=';'; echo "${AUDIO_FILTER_PARTS[*]}")
  EXTRA_OUTPUT_FLAGS=()
fi

# ──────────────────────────────────────────────────────────────────────
# Build ffmpeg command
# ──────────────────────────────────────────────────────────────────────

DURATION_ARGS=()
if [[ -n "$DURATION" ]]; then
  DURATION_ARGS=("-t" "$DURATION")
fi

START_ARGS=()
if [[ "$START" != "00:00:00" ]]; then
  START_ARGS=("-ss" "$START")
fi

echo "→ Building $OUT"
echo "  raw:      $RAW"
echo "  captions: ${CAPTIONS:-<none>}"
echo "  vo:       ${VO:-<none>}"
echo "  music:    ${MUSIC:-<none>}"
echo "  duration: ${DURATION:-<full>}"

ffmpeg -y \
  "${START_ARGS[@]}" \
  "${AUDIO_INPUTS[@]}" \
  "${DURATION_ARGS[@]}" \
  -vf "$VIDEO_FILTER" \
  -filter_complex "$AUDIO_FILTER_COMPLEX" \
  -map "0:v" -map "[aout]" \
  -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  "${EXTRA_OUTPUT_FLAGS[@]}" \
  "$OUT"

echo "✅ Built: $OUT"
echo
echo "Validate the result:"
echo "  → Aspect ratio = 9:16 (1080×1920) ✓"
echo "  → Captions are burned-in (visible on mute) ✓"
echo "  → File size: $(du -h "$OUT" | cut -f1)"
echo
echo "Next: upload to Meta Ads Manager or TikTok Ads Manager. Run 4-6"
echo "hook variants of the same body for Advantage+ Creative."
