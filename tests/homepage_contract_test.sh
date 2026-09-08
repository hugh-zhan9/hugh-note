#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node --check "$ROOT_DIR/static/js/homepage.js"
node --test "$ROOT_DIR/tests/homepage_test.mjs"
