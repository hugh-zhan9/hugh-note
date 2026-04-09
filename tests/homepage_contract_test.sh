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
assert_file_exists "$ROOT_DIR/layouts/partials/head.html"
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
assert_contains "$ROOT_DIR/layouts/index.html" 'data-crazy-talk-item'
assert_contains "$ROOT_DIR/layouts/index.html" '/blog/'
assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-running-cell level-0'
assert_contains "$ROOT_DIR/layouts/index.html" '0.0 / 150 km'
assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-hero-grid'
assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-hero-aside'
assert_contains "$ROOT_DIR/layouts/index.html" 'homepage-hero-stat'
assert_contains "$ROOT_DIR/layouts/index.html" 'data-homepage-theme="light"'
assert_contains "$ROOT_DIR/layouts/index.html" 'localStorage.getItem("theme-storage")'
assert_contains "$ROOT_DIR/layouts/index.html" '.RawContent'
assert_contains "$ROOT_DIR/layouts/index.html" '^###\\s+'
assert_contains "$ROOT_DIR/layouts/index.html" '统计区间'
assert_contains "$ROOT_DIR/layouts/partials/head.html" 'replaceRE "/+$" ""'
assert_contains "$ROOT_DIR/layouts/partials/head.html" '.RelPermalink'
assert_contains "$ROOT_DIR/layouts/partials/head.html" '.IsHome'
assert_contains "$ROOT_DIR/layouts/partials/head.html" 'if not .IsHome'

assert_contains "$ROOT_DIR/layouts/blog/list.html" '.Site.RegularPages'
assert_contains "$ROOT_DIR/layouts/blog/list.html" 'Read more ⟶'

assert_contains "$ROOT_DIR/static/js/homepage.js" '/running/'
assert_contains "$ROOT_DIR/static/js/homepage.js" '150'
assert_contains "$ROOT_DIR/static/js/homepage.js" 'DOMContentLoaded'
assert_contains "$ROOT_DIR/static/js/homepage.js" 'theme-storage'
assert_contains "$ROOT_DIR/static/js/homepage.js" 'data-crazy-talk-item'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '.homepage-grid'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '[data-homepage-theme="light"]'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '--homepage-accent: #2563eb'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '.homepage-hero-grid'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '.homepage-hero-aside'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '.homepage-hero-stat'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '@media (prefers-reduced-motion: reduce)'
assert_contains "$ROOT_DIR/assets/css/homepage.css" 'grid-auto-flow: column'
assert_contains "$ROOT_DIR/assets/css/homepage.css" '#9be9a8'

echo "homepage 改造契约检查通过"
