#!/usr/bin/env bash
set -euo pipefail
local_head="$(git rev-parse HEAD)"
remote_line="$(git ls-remote --exit-code origin refs/heads/main)"
remote_head="${remote_line%%[[:space:]]*}"
if [[ "$local_head" == "$remote_head" ]]; then
  printf 'current=true\n'
else
  printf 'current=false\n'
  echo 'Skipping a build superseded on main' >&2
fi
