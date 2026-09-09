# 跑步与博客的同仓维护

Hugo 位于仓库根目录，React/Vite 与 Python 同步程序位于 `apps/running`。跑步入口保持 `/running/`，活动汇总保持 `/running/summary/`，年度总结保持 `/running/summary/:year`。默认使用 Classic，Dashboard 入口保留。

## 安装、构建和预览

需要 Node.js 24 或更新版本、pnpm、Hugo Extended 0.165.0；本地预览另需 Python 3。跑步子目录的 packageManager 固定为 pnpm 8.9.0。

```sh
git submodule update --init --recursive
pnpm --dir apps/running install --frozen-lockfile
node scripts/build.mjs
bash scripts/preview.sh
```

构建产物为 `dist/site/`，其中 `dist/site/running/` 是 Vite 应用。预览默认 `http://127.0.0.1:1313`；设置 `PORT=1315` 可换端口。`HUGO_BIN` 可指定 Hugo 二进制，`SITE_BASE_URL` 可为单独构建指定域名。`preview.sh` 自动设置本地域名并重新构建；改代码后重新运行。生产构建不设置 `SITE_BASE_URL`，使用 hugo.toml 的正式域名。

根仓库仍跟踪旧的 `public/` 文件，新构建使用独立输出目录，避免改写这些历史产物。

构建先完成两个应用和数据导出，再替换 `dist/site/`；Hugo/Vite 任一步失败，现有产物保留。构建锁防止两个本地构建同时替换输出。进程被强制终止后如遗留 `.site-build.lock`，先确认没有构建进程，再移除该目录。

开发跑步组件也可执行 `pnpm --dir apps/running dev`，Vite 会在 `/running/` 提供页面与数据接口。全站跳转和 Hugo 页面验收使用组合预览。

## 数据与外观的所有权

Python 继续维护 `apps/running/run_page/data.db`、`GPX_OUT` 和 `src/static/activities.json`。导入保留了这些历史文件和原有清洗规则；构建不回写数据、不推断室内活动、不补造路线。

`apps/running/plugins/activity-data.ts` 复用现有展示修正和活动类型规范化，生成只读 `/running/data/activities.json`，并检查必需字段、日期、时长、非负距离/速度与重复 ID。主页和跑步共用这一接口，失败时显示原有错误状态，不把失败当作空月。类型为 `running/cycling/walking/...`，距离为米；原始日期、轨迹和附加字段保留。Dashboard 在自己的入口把规范类型转换为其既有图表显示标签，转换不修改公共数据缓存。

外观源文件：

- `assets/css/site-tokens.css`：共享配色。
- `assets/css/appearance-controls.css`、`layouts/partials/appearance.html`：仅在 Hugo 主页显示的外观图标与面板。
- `static/js/themetoggle.js`：唯一偏好控制器，使用 `theme-storage`。
- `apps/running/src/site/`：React 挂载、订阅、导航及页面颜色适配。

博客偏好优先；没有 `theme-storage` 时，迁移旧跑步 `theme` 的 light/dark 选择。两个应用的布局 CSS 各自维护，跑步不加载 Archie 全局样式。普通跑步页面与地图明暗状态跟随共享选择；年度总结保留源仓库的深色渐变、橙色强调、字体和全屏翻页，不显示站点导航或外观入口，也不改变已保存的主题。普通跑步导航中的「年度总结」复用 metadata 的默认年度逻辑。

## 验证

```sh
bash tests/homepage_contract_test.sh
bash tests/crazy_talk_section_test.sh
node --test tests/skin_test.cjs tests/site_build_test.mjs tests/running_route_test.cjs tests/site_workflow_test.mjs
pnpm --dir apps/running test
pnpm --dir apps/running exec tsc --noEmit
```

Python 离线测试在独立虚拟环境安装 `apps/running/requirements-dev.txt`、pytest 和 textual，然后在 `apps/running` 执行：

```sh
python -m pytest test_tui_app.py run_page/test_keep_sync.py run_page/test_generator.py run_page/gpxtrackposter/test_track.py -q
```

浏览器检查需要 Playwright 和 Chromium；先启动组合预览，再执行：

```sh
SITE_TEST_URL=http://127.0.0.1:1313 node tests/site_browser_test.cjs
SKIN_TEST_URL=http://127.0.0.1:1313 node tests/skin_browser_test.cjs
```

可以设置 `CHROMIUM_EXECUTABLE_PATH` 使用本机 Chromium。`site_browser_test.cjs` 的成功路径使用真实导出数据，覆盖月份/路线/地区切换、活动筛选、预设和自定义颜色、跨标签同步、深链接、年度总结键盘操作、存储受限及窄屏。`skin_browser_test.cjs` 使用隔离数据检查博客外观，不能代替前者。测试截图写入系统临时目录。

## 发布与定时同步

唯一发布入口是根 `.github/workflows/depoly.yml`：检查同一源提交、构建两个应用、确认仍为当前 main，然后发布到原目的仓库 `hugh-zhan9/hugh-zhan9.github.io` 的 main。PR 只测试和构建。发布串行，过期构建跳过。Python 测试与前端构建均使用调用者指定的同一提交。

根 `.github/workflows/running-sync.yml` 保留每日 UTC 00:00 的 Keep 同步，工作目录改为 `apps/running`，SVG 生成参数沿用原任务。只暂存 DB、原始 JSON、GPX/TCX/FIT、导入记录及顶层生成 SVG。同步和 push 失败直接终止；不吞掉错误或自动处理冲突。成功后通过 reusable workflow 发布该源提交，避免 GITHUB_TOKEN 提交不触发 push workflow 导致页面未更新。

新同步任务默认关闭，只有仓库变量 `RUNNING_SYNC_ENABLED=true` 才运行。运行需要本仓库的 `KEEP_MOBILE`、`KEEP_PASSWORD` secrets；发布沿用 `ACCESS_TOKEN`。Keep 登录凭据不进入前端产物。若选择上游 Dashboard，其 Mapbox 地图沿用 `MAPBOX_TOKEN`（公开地图访问 token）构建配置；默认 Classic 使用 OpenFreeMap，不需要该 token。

线上切换需单独执行：

1. 完成代码审查、提交与合入后，在新仓库配置所需 secrets。
2. 停止旧 running 仓库的同步任务，检查是否有导入基线之后的新活动；有则先同步最新数据，避免漏记录。
3. 关闭旧 running 的 project Pages。旧项目站可能优先占用 `/running/`，仅发布主站子目录不足以完成切换。
4. 发布组合站点，确认 `/running/data/activities.json`、主页月份/路线、`/running/summary/2025` 刷新和跨页外观。
5. 开启 `RUNNING_SYNC_ENABLED`，手动运行一次新任务并确认数据提交、统一发布成功。

切回旧站时先关闭新同步，再恢复旧任务/Pages，并显式执行旧站部署和验收；保留新产生的活动，不能用旧数据库覆盖新数据。仅恢复旧项目站会再次遮蔽 `/running/data/activities.json`，使新主页的跑步区域失效。健康回滚必须同时使用接口匹配的主页与跑步版本。

### GitHub 配置迁移状态（2026-09-09）

已通过 GitHub API 核对源 `hugh-zhan9/running` 与目标 `hugh-zhan9/hugh-note`。目标的 `RUNNING_SYNC_ENABLED` 最初配置为 `false`，随后按用户明确要求改为 `true`，并回读确认。用户自行补填 `KEEP_MOBILE`、`KEEP_PASSWORD`。源仓库没有 Actions variables；两仓库的 Actions 启用状态、允许使用的 Actions 与工作流默认权限一致，无需改动。

目标已有 `ACCESS_TOKEN`，保留原值；本次仅确认存在，未执行发布验证。源仓库有 `KEEP_MOBILE`、`KEEP_PASSWORD`、`COROS_ACCOUNT`、`COROS_PASSWORD`，目标初次核对时缺 Keep 两项凭据；用户自行配置后，提交前已通过 API 确认 `KEEP_MOBILE` 与 `KEEP_PASSWORD` 均已存在（未验证登录）。GitHub API 不返回 Secret 值，当前进程环境及源项目根目录的配置文件也未提供 Keep 凭据，需要从用户提供的本机凭据文件写入，或由用户在目标仓库的 Actions Secrets 页面补填。当前同步方式为 Keep，未使用 COROS；源仓库也没有 `MAPBOX_TOKEN`。

源仓库的 `github-pages`、`Preview`、`Production` environments 均没有 secrets 或 variables。组合站点沿用既有跨仓库发布流程，不复制这些环境。目标同步开关已开启，Keep 凭据名称已确认，尚未手动验证 Keep 登录。组合站点已通过 Actions 构建并发布；旧站切换记录见下。

## 后续同步上游

导入基线为个人仓库 `0e2c77a`，其上游同步至 `1639f8b`。来源和许可证见 `apps/running/UPSTREAM.md`；上次同步的历史数据保护规则见该应用的 `docs/upstream-sync-2026-09-09.md`。

后续以这两个明确基线进行内容三方比较，把上游源码变化应用到 `apps/running`，单独核对本仓库 `plugins/`、`src/site/`、数据/主题 hooks、Classic 页面外观和根 CI 接线。不要整体覆盖目录或导入上游个人数据。`apps/running/.github` 仅保留原始仓库记录；GitHub 只执行根目录 `.github/workflows`。

## 本次验证记录（2026-09-09）

77 项自动化测试通过（主页 13、皮肤/路由/构建/工作流 19、跑步 27、Python 18），类型检查、组合构建与独立代码复审通过。两套浏览器回归验证了跨页/跨标签外观、真实数据月份和路线、年度总结及 320–1440px 布局；Dashboard 使用真实活动数据、测试 Mapbox 底图做补充检查。原始受保护文件 2419 个逐字节一致，完整导入 2566 个版本控制文件。测试不调用真实 Keep 同步，不操作生产发布。

本次外观修订验证：恢复年度总结入口及独立样式，移除主页之外的外观控件；77 项测试、类型检查、组合构建及两套浏览器回归通过。浏览器检查新增图标可访问名称/键盘开关/44px 点击区域、年度入口导航、六页翻页、原渐变和字体、跨皮肤及跨标签视觉不变、直接访问与刷新、移动端翻页。

## 旧项目站切换（2026-09-09）

组合站点发布后，旧 `hugh-zhan9/running` project Pages 仍占用 `/running/`，导致已存在于发布仓库的 `/running/data/activities.json` 返回 404；主页按数据加载失败处理，月份和路线按钮未显示。定位时浏览器已复现。

已禁用旧仓库 `run_data_sync.yml` 和 `gh-pages.yml`，确认所有未完成任务（含 queued/waiting）为空后移除旧 Pages 配置；仓库、代码和数据均保留。重新核对旧 master 相比导入基线只多 9 个派生 SVG 改动，DB、GPX 与原始 JSON 无新增差异。随后请求主站 Pages 重建以刷新路由；数据接口已返回 200、2415 条记录，年度总结直接入口可用。旧站配置备份位于执行机器 `/tmp/hugh-note-running-pages-cutover`；恢复旧 workflow 型 Pages 需要重新部署，且不能单独作为新主页的健康回滚。

线上验收：`SITE_TEST_URL=https://hugh-zhan9.github.io node tests/site_browser_test.cjs` 全部通过，覆盖真实活动数据、月份/路线/地区、跨页配色、年度翻页和 320–1440px 布局。另直接操作主页，确认 2026 年 8 月显示 13.0 / 150 km，月份与两种路线视图均可切换。
