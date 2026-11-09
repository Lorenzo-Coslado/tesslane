#!/usr/bin/env bash
set -euo pipefail
tesslane_repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v ffmpeg >/dev/null || { echo 'FFmpeg is required to build README media.' >&2; exit 1; }
tesslane_media_tmp="$(mktemp -d)"
trap 'rm -rf -- "$tesslane_media_tmp"' EXIT
tesslane_index=0
for tesslane_view in feature agents inspector; do
  ffmpeg -hide_banner -loglevel error -y \
    -i "$tesslane_repo/docs/assets/$tesslane_view.png" \
    -vf 'scale=960:-1:flags=lanczos' \
    -frames:v 1 "$tesslane_media_tmp/frame-$tesslane_index.png"
  tesslane_index=$((tesslane_index + 1))
done
ffmpeg -hide_banner -loglevel error -y \
  -framerate 1/4 -i "$tesslane_media_tmp/frame-%d.png" \
  -vf 'fps=2,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' \
  -loop 0 "$tesslane_repo/docs/assets/tesslane-tour.gif"
echo 'Built docs/assets/tesslane-tour.gif'
