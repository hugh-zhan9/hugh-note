#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root"
[[ "$(git branch --show-current)" == main ]] || { echo 'Data sync requires main' >&2; exit 1; }
git diff --cached --quiet || { echo 'Data sync requires a clean index' >&2; exit 1; }
for generated in apps/running/run_page/data.db apps/running/src/static/activities.json apps/running/imported.json apps/running/GPX_OUT apps/running/TCX_OUT apps/running/FIT_OUT; do
  if [[ -e "$generated" ]]; then git add -- "$generated"; fi
done
git add -- ':(glob)apps/running/assets/*.svg'
if ! git diff --cached --quiet; then
  git -c user.name='GitHub Action' -c user.email='action@github.com' commit -m 'Update running data'
  git push origin HEAD:main
fi
# Emit only after a successful push. A conflict must stop the dependent publish job.
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'commit=%s\n' "$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
fi
