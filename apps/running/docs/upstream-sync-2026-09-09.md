# 2026-09-09 上游同步

本次把工作区从 `a52cfea816609d56300a0cc384880e53090b3f4b` 更新到上游 `1639f8b270fa2f74af0a9122dcf37bf110e2971a` 的代码。上游地址为 https://github.com/yihong0618/running_page，已添加 `upstream` remote。首次交付为未提交工作区；随后用户明确授权将本次更新提交并推送到 `origin/master`。未单独执行部署命令。

上次同步提交 `c502cca` 的通用代码与上游 `32286c2` 一致，但没有保留上游祖先关系。因此本次以 `32286c2` 做内容三方比对，在工作区整合；没有改写 Git 历史。后续同步应参考本文记录的上游版本，不能仅凭共同祖先重复导入旧改动。

## 更新与保留

引入上游 3.0 Classic/Dashboard 主题、React 19、Vite 8、地图和室内轨迹展示、Intervals.icu 同步、Garmin 修复、TUI、依赖和工作流更新。默认仍为 Classic，可在 `config.yml` 选择主题。

本地保留项：

- 首页、`/summary`、`/summary/:year` 和 404 页面；年度总结默认链接仍优先指向最近完整年度。
- 共享的活动类型筛选、单条记录展示修正、地图视野和动画行为。
- 免费 OpenFreeMap + MapLibre，无须新增 Mapbox token。Classic 地图设置位于 `src/themes/classic/utils/const.ts`。
- 个人 metadata、头像、博客链接，Keep 数据源、每日调度、运动员名称、生日和 GitHub Pages 配置。
- Keep 时间戳归一化、异常轨迹校验及异常传播修复。
- 2363 个个人数据、图片和生成产物文件逐字节与更新前相同。`assets/index.tsx` 是上游源码索引，按新版更新。

Classic 的页面、筛选状态和地图组件迁入 `src/themes/classic/`；两个主题从现有 `src/core/hooks/useActivities.ts` 加载数据，原有展示修正在该入口应用。年度计算保持为共享纯函数 `src/utils/yearSummary.ts`。

## 明确排除的上游行为

没有引入 `Generator.load()` 中新增的自动室内推断及借用上一条户外路线生成坐标的逻辑。独立审查用个人 JSON 的副本运行该纯函数，发现会改写 2252 条已有记录，并给 117 条无轨迹记录生成坐标；普通 Keep 同步还会持久化部分改动。这不符合本 fork 保留历史记录的要求。

保留已明确标注室内活动的上游展示支持，但数据读取不会推断或补造活动类型、轨迹。`run_page/test_generator.py` 使用内存 SQLite 验证占位坐标、缺失 GPS 和跑步机记录；测试在修复前失败、修复后通过。

## 验证

本机 Node 25.9.0、Python 3.12.13。Python 验证环境为 `/tmp/running-upstream-venv`。

| 检查 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过 |
| `pnpm test` | 23 项通过 |
| `pnpm exec tsc --noEmit` | 通过；更新前已有类型错误 |
| `pnpm check` | 通过 |
| `pnpm exec eslint src` | 0 错误、57 条告警，主要为上游及迁移代码的 React 规则提示 |
| `pnpm build` | 通过；仍有大 chunk 提示 |
| `PATH_PREFIX=/running pnpm build` | 通过，已用该产物验证子路径路由 |
| `python -m pytest run_page test_tui_app.py -q` | 18 项通过、1 条 SQLAlchemy 弃用提示 |
| `python -m unittest discover -s . -p 'test_*.py'` | 上游 Makefile 所用命令，10 项通过 |
| `black . --check --target-version py312` | 通过 |
| `ruff check --isolated --select E4,E7,E9,F .` | 通过 |
| `ruff check .` | 未通过：基线 342 条，更新后 397 条；未混入整仓风格、异常处理等批量重写 |
| 工作流 YAML 与个人 env 对比 | 解析通过，原有 env 值与调度全部保留 |
| 数据完整性 | 2363 个受保护文件与 HEAD 完全一致 |
| diff 空白检查 | 通过，按 `core.whitespace=cr-at-eol` 接受上游地图 JSON 的 CRLF |

独立 Chrome 测试浏览器验证了首页底图与轨迹、点击记录后 URL 定位、深浅主题切换、跨页面活动筛选状态、汇总页日/月/Life 切换、年度总结键盘翻页、无效年份跳转、404 和 390px 手机布局；无页面 JavaScript 异常，年度总结手机页无横向溢出。没有登录外部账户或执行线上同步。

独立 reviewer `/root/review` 审查源代码树 `7a4b4c8b77dd8194f9e37ea7304fd8ed483a1fe9`，确认自动改写历史数据的问题已关闭，无剩余发现。此 tree 仅为审查快照，不是 Git commit。之后仅补充本说明、计划完成状态和用户的提交推送授权。
