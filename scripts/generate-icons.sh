#!/usr/bin/env bash
# Gera os ícones do PWA a partir dos SVGs em public/.
# Requer: librsvg (rsvg-convert) e ImageMagick (magick).
set -euo pipefail

mkdir -p public/icons
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

rsvg-convert -w 192 -h 192 public/icon.svg -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 public/icon.svg -o public/icons/icon-512.png
rsvg-convert -w 192 -h 192 public/icon-maskable.svg -o public/icons/maskable-192.png
rsvg-convert -w 512 -h 512 public/icon-maskable.svg -o public/icons/maskable-512.png
rsvg-convert -w 180 -h 180 public/icon-maskable.svg -o public/apple-touch-icon.png

rsvg-convert -w 32 -h 32 public/icon.svg -o "$tmp/favicon-32.png"
rsvg-convert -w 48 -h 48 public/icon.svg -o "$tmp/favicon-48.png"
magick "$tmp/favicon-32.png" "$tmp/favicon-48.png" public/favicon.ico

echo "Ícones gerados em public/ (icon.svg -> favicon.ico, PNGs, maskable e apple-touch-icon)."
