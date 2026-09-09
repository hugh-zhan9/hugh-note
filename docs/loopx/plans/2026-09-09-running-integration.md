---
schema: loopx-plan/v1
source: docs/loopx/design/2026-09-09-running-integration/需求设计文档.md
status: ready
slices:
  - id: P-001
    status: done
    depends: []
  - id: P-002
    status: done
    depends: [P-001]
  - id: P-003
    status: done
    depends: [P-002]
---
# 跑步同仓整合

## Goal And Boundaries

执行用户认可的同仓独立应用方案。保留 Hugo、React、Python 各自职责与已有跑步交互。整合在 site-skins 工作树的 5f27dd6 上进行，源 running 为 0e2c77a。源码导入不包含 .git/依赖/缓存；不更改历史数据、不执行真实同步、提交或发布。

## P-001 跑步模块与共享数据接口

完整导入受版本控制文件并记录来源；现有展示规范化逻辑生成固定 JSON，两个前端均读取该接口。空/单条/非法数据、月份跨界和没有轨迹得到正确处理；原记录及数据库哈希不变。

> writes: apps/running/**, static/js/homepage.js, tests/homepage_test.mjs, tests/skin_browser_test.cjs, .gitignore
> anchors: D-001, D-003
> architecture: 复用 running Python 数据与 src/utils/activity.ts，构建导出只读投影；Hugo 经公开 JSON 依赖跑步数据，不访问 DB；验证哈希及消费错误边界。
> verify: pnpm --dir apps/running test; pnpm --dir apps/running exec tsc --noEmit; bash tests/homepage_contract_test.sh; 跑步构建及导出/源数据哈希比较；新增 plugins 测试必须纳入 pnpm test 收集
> review: 导出字段、历史数据完整性及客户端错误边界

## P-002 全站外观与导航

抽取既有主题 tokens、面板样式和 HTML，React 通过共享控制器接入；主页、博客和跑步的预设/自定义/默认一致。保留地图明暗切换、年度页面、原有筛选。按用户后续修订：外观图标与面板仅由 Hugo 主页挂载；React 只订阅配色。年度总结恢复原独立样式和入口，排除在共用配色之外。窄屏面板无溢出，年度路由保留原全屏翻页。

> writes: assets/css/**, static/js/themetoggle.js, layouts/partials/**, hugo.toml, apps/running/src/**, apps/running/vite.config.ts, tests/skin_test.cjs, tests/skin_browser_test.cjs
> anchors: D-002
> architecture: 全站外观归已有控制器，两个应用只消费 tokens 和偏好；React hook 为适配器而非新 store，页面 CSS 各自维护；订阅可清理并验证。
> verify: node --test tests/skin_test.cjs; pnpm --dir apps/running test; pnpm --dir apps/running exec tsc --noEmit; Hugo/Vite 构建；浏览器跨页/跨标签/自定义/明暗/移动端检查
> review: 偏好迁移优先级、存储受限、CSS 隔离及地图主题订阅

## P-003 组合构建、预览与发布接线

根脚本生成一致的 Hugo 和 /running 产物，提供不依赖线上代理的预览；保留深链接查询与 hash。根工作流合并发布并承接独立同步，严格限定同步文件和凭据用途，默认不开启新定时写入。文档覆盖安装、验证、上游更新和上线切换。

> writes: scripts/**, tests/**, .github/workflows/**, layouts/404.html, static/js/running-route.js, apps/running/index.html, apps/running/vite.config.ts, apps/running/plugins/**, docs/appearance.md, docs/running-integration.md, README.md, .gitignore
> anchors: D-004, D-005
> architecture: 组合脚本只消费两个构建，唯一根发布任务写目标仓库；Python 从原模块工作目录运行，仅写历史既有生成文件；构建失败不替换产物，过期版本不覆盖新发布。
> verify: 根组合构建、Node/博客/跑步原测试与类型检查、Python 离线测试、工作流静态解析、浏览器真实数据/深链接/404/查询/移动端检查；离线命令替身验证 Hugo/Vite 失败不替换已有产物，main 门禁与串行发布关系；模拟同步失败和 push 冲突，断言不会继续提交/发布
> review: 发布并发、凭据、路径限定、重定向与旧站切换边界

## Integration And Final Verification

- 真实组合站点验证主页月份、路线、地区，跑步筛选与年度总结，以及预设/自定义跨页和标签同步。
- 全部 D-001 至 D-005 由上述切片及最终 diff 评审覆盖；源码导入与适配差异分开评审，确认没有第二份可写数据或主题控制器。
- 独立叶子评审公开接口与安全相关工作流的最终改动，修复重要问题后重验。

## Handoff And Residual Risks

- Review evidence: 前一轮整合基线评审：/root/plan_review fresh ready；当时路径修订评审计划 SHA256 a811da3c69c1c60c5de551c7e7ffc08056f3914944dcd38c544e4228741b71ac、需求 6c6d0912bab30f7cffbe5c0edfa31689687b436a5d9820a23295aaaeec0680e4、概要 c5d66b929c7a92bb2df1ee75d9480aa5266674bcd7b6d890c787bc5ccae667a7。最终代码独立复审通过，57 文件清单 SHA256 a6f6411648bc21c033c8a3fe660e6f387a4941aa0aaab5bc55c727b7b2847298（/tmp/hugh-note-running-code-review-release.sha256）。
- Blockers: none.
- Residual risks: 线上切换需要 secrets、停止旧同步和关闭旧 project Pages；本轮不操作外部状态。
- Resume note: 实施完成，尚未提交/合并/上线。使用 `site-skins` 工作树；组合预览运行于 http://127.0.0.1:1315。原 running 仓库未改变，旧 public 受跟踪文件无 diff。

最终验证（2026-09-09）：主页 13 项、皮肤/路由/构建/工作流 19 项、跑步 27 项、Python 18 项，共 77 项自动化测试通过，crazy-talk 契约检查及 tsc 通过。Hugo 131 页与 Vite 组合构建成功。真实导出 JSON 驱动的跨应用浏览器检查及独立皮肤回归通过，覆盖 320–1440px；备用 Dashboard 使用真实活动数据和测试底图验证显示与外观。2419 个受保护原始文件逐字节比较无变化，2566 个导入文件无缺失。独立评审发现的类型标签、测试提交一致性与时长验证问题均已修复并复验。

外观修订复审（2026-09-09）：独立复审 /root/plan_review 核对本轮 10 个文件精确 diff 与 SHA256 清单（/tmp/hugh-note-summary-appearance.sha256），未发现需要修复的问题。上述原整合基线的 SHA 不代表本次修订后的设计文件。线上年度链接经原站 404 脚本恢复后可正常显示；本地年度页的渐变、字体、字号及行高与线上对照一致。
