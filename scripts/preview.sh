#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
preview_port="${PORT:-1313}"
export SITE_BASE_URL="http://127.0.0.1:${preview_port}/"
node "$site_root/scripts/build.mjs"
exec python3 "$site_root/scripts/preview.py" --port "$preview_port"
