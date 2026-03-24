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

echo "crazy-talk 栏目契约检查通过"
