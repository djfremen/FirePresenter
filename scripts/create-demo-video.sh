#!/usr/bin/env sh
# Original geometric animation and synthesized tone; no third-party media.
set -eu
cd "$(dirname "$0")/.."
mkdir -p app/src/main/assets/bundled
ffmpeg -y -f lavfi -i 'color=c=0x101827:s=1280x720:r=30:d=6' \
  -f lavfi -i 'color=c=0xff943d:s=160x160:r=30:d=6' \
  -f lavfi -i 'sine=frequency=220:sample_rate=48000:duration=6' \
  -filter_complex '[0:v]drawgrid=w=80:h=80:t=1:c=0x405370[grid];[grid][1:v]overlay=x=80+(W-w-160)*t/6:y=(H-h)/2,fade=t=in:d=0.8,fade=t=out:st=5.2:d=0.8,format=yuv420p[v];[2:a]volume=0.05,afade=t=in:d=0.8,afade=t=out:st=5.2:d=0.8[a]' \
  -map '[v]' -map '[a]' -c:v libx264 -crf 26 -preset medium -c:a aac -b:a 64k \
  -movflags +faststart -shortest app/src/main/assets/bundled/demo.mp4
ffmpeg -y -ss 2 -i app/src/main/assets/bundled/demo.mp4 -frames:v 1 \
  -update 1 app/src/main/assets/bundled/video-poster.png
