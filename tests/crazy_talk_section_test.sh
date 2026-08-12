#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

assert_contains() {
  local file="$1"
  local pattern="$2"

  if ! rg -F -q -- "$pattern" "$file"; then
    echo "断言失败: $file 不包含: $pattern" >&2
    exit 1
  fi
}

assert_file_exists() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "断言失败: 文件不存在: $file" >&2
    exit 1
  fi
}

assert_contains "$ROOT_DIR/hugo.toml" 'name = "疯言疯语"'
assert_contains "$ROOT_DIR/hugo.toml" 'url = "/crazy-talk/"'

assert_file_exists "$ROOT_DIR/content/crazy-talk/_index.md"
assert_contains "$ROOT_DIR/content/crazy-talk/_index.md" 'title: "疯言疯语"'

assert_file_exists "$ROOT_DIR/layouts/crazy-talk/list.html"
assert_contains "$ROOT_DIR/layouts/crazy-talk/list.html" '.Content'
assert_contains "$ROOT_DIR/layouts/crazy-talk/list.html" '疯言疯语'

if rg -F -q -- '.RelPermalink' "$ROOT_DIR/layouts/crazy-talk/list.html"; then
  echo "断言失败: crazy-talk 列表页不应依赖标题跳转入口" >&2
  exit 1
fi

for file in "$ROOT_DIR"/content/crazy-talk/20??-??-??.md; do
  filename="$(basename "$file" .md)"

  awk -v filename="$filename" '
    NR == 1 && $0 != "---" { exit 1 }
    NR == 2 && $0 != "title: \"" filename "\"" { exit 1 }
    NR == 3 && $0 != "draft: false" { exit 1 }
    NR == 4 && $0 != "date: " filename "T00:00:00+08:00" { exit 1 }
    NR == 5 && $0 != "description: \"疯言疯语。\"" { exit 1 }
    NR == 6 && $0 != "tags: [疯言疯语]" { exit 1 }
    NR == 7 && $0 != "---" { exit 1 }
    NR == 8 && $0 != "" { exit 1 }
    NR == 9 && $0 !~ /^### [0-9][0-9]:[0-9][0-9]$/ { exit 1 }
    NR > 8 && /^### / && $0 !~ /^### [0-9][0-9]:[0-9][0-9]$/ { exit 1 }
    NR > 8 && /^- \*\*[0-9][0-9]:[0-9][0-9]\*\*/ { exit 1 }
    NR > 8 && $0 == "" && previous == "" { exit 1 }
    NR > 8 && previous ~ /^### / && $0 != "" { exit 1 }
    NR > 9 && before_previous ~ /^### / && previous == "" && $0 == "" { exit 1 }
    NR > 8 && /^### / && previous_time != "" && substr($0, 5) > previous_time { exit 1 }
    NR > 8 && /^### / { previous_time = substr($0, 5) }
    { before_previous = previous; previous = $0 }
  ' "$file" || {
    echo "断言失败: $file 未遵循 crazy-talk 统一格式" >&2
    exit 1
  }
done

echo "crazy-talk 栏目契约检查通过"
