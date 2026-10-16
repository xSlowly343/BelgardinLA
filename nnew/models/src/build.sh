#!/usr/bin/env bash
# Build one boss: GLB + .blend + preview contact sheet.  Usage: bash src/build.sh belgardin|kragma
set -e
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-/c/Users/fixadmin/Documents/blender/blender.exe}"
name="$1"
rm -f preview/${name}_*.png
"$BLENDER" -b --factory-startup --python "src/$name.py" -- . 2>&1 | grep -E "TRIS|Error|Traceback|line [0-9]+|^ +[A-Za-z]" || true
seq="$(mktemp -d)"
i=0
# only the numbered clip frames go into the sheet; extra views (_front, _back) stay as separate files
for f in preview/${name}_[0-9]*.png; do cp "$f" "$seq/$(printf %02d $i).png"; i=$((i + 1)); done
ffmpeg -y -loglevel error -i "$seq/%02d.png" -vf "scale=300:-1,tile=5x$(((i + 4) / 5))" -frames:v 1 "preview/${name}_sheet.jpg"
rm -rf "$seq"
echo "sheet: preview/${name}_sheet.jpg"
