#!/bin/sh
# usage: scripts/shot.sh <out.png> <url-suffix> [width] [height]
# Headless Chrome screenshot of the dev server (animations advance on virtual time).
OUT="$1"; SUFFIX="$2"; W="${3:-1440}"; H="${4:-900}"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu-sandbox --hide-scrollbars \
  --user-data-dir="$TEMP/ignuz-shot" --window-size="$W,$H" --virtual-time-budget=6000 \
  --screenshot="$OUT" "http://localhost:5326/$SUFFIX" >/dev/null 2>&1
echo "$OUT"
