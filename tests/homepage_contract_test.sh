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

assert_file_exists "$ROOT_DIR/layouts/index.html"
assert_file_exists "$ROOT_DIR/layouts/blog/list.html"
assert_file_exists "$ROOT_DIR/content/blog/_index.md"
assert_file_exists "$ROOT_DIR/assets/css/homepage.css"
assert_file_exists "$ROOT_DIR/static/js/homepage.js"

assert_contains "$ROOT_DIR/hugo.toml" 'enableGitInfo = true'
assert_contains "$ROOT_DIR/hugo.toml" 'name = "Blog"'
assert_contains "$ROOT_DIR/hugo.toml" 'url = "/blog/"'
assert_contains "$ROOT_DIR/hugo.toml" 'customCSS = ["css/homepage.css"]'
assert_contains "$ROOT_DIR/hugo.toml" 'customJS = ["js/homepage.js"]'

assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-running-root'
assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-crazy-talk'
assert_contains "$ROOT_DIR/layouts/index.html" '/blog/'

assert_contains "$ROOT_DIR/layouts/blog/list.html" '.Site.RegularPages'
assert_contains "$ROOT_DIR/layouts/blog/list.html" 'Read more ⟶'

assert_contains "$ROOT_DIR/static/js/homepage.js" '/running/'
assert_contains "$ROOT_DIR/static/js/homepage.js" '150'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '.homepage-grid'

echo "homepage 改造契约检查通过"
