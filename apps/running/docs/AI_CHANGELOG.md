# AI Change Log

## 2026-03-13

Change:
合并 upstream `running_page_main` 的新功能与修复，并保留晚青在工作流、站点元数据与展示常量上的定制意图。

Risk Analysis:
主要回归风险在于上游前端结构与本地配置的兼容边界，尤其是地图提供方切换、首页交互状态、GitHub Actions 工作流参数，以及依赖升级后在真实安装环境中的构建行为。

Risk Level:
S2-中

Changed Files:
.github/workflows/run_data_sync.yml, src/utils/const.ts, src/pages/index.tsx, src/static/site-metadata.ts, src/components/RunMap/index.tsx, package.json, pnpm-lock.yaml
## [2026-03-13 14:16] [Bugfix]
- **Change**: 迁移地图到 MapLibre 兼容链路并统一活动类型规范化，修复轨迹渲染与步行被误标为跑步的问题
- **Risk Analysis**: 主要风险在于地图 SDK 从 Mapbox 运行时切到 MapLibre 后，部分旧样式或控件兼容性可能还有边角问题；另外活动类型规范化会影响依赖旧 type 值的展示逻辑，但已通过单测和浏览器点击单条记录验证核心路径。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `imported.json`
- `package.json`
- `pnpm-lock.yaml`
- `src/components/ActivityList/index.tsx`
- `src/components/RunMap/index.tsx`
- `src/utils/const.ts`
- `src/utils/utils.ts`
- `src/utils/activity.test.ts`
- `src/utils/activity.ts`
- `src/utils/map.test.ts`
- `src/utils/map.ts`
----------------------------------------
## [2026-03-13 14:38] [Bugfix]
- **Change**: 新增活动展示规则：将指定步行覆盖为清晨跑步、隐藏剩余步行，并放大地图高度与默认开启底图显示
- **Risk Analysis**: 主要风险在于展示层过滤步行后，年度汇总和总量会显著下降，这是预期但会改变历史统计口径；另外地图默认高度翻倍会影响小屏滚动体验，不过已通过本地页面预览确认主页面可正常展示。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/data/activities.ts`
- `src/hooks/useActivities.ts`
- `src/components/ActivityList/index.tsx`
- `src/utils/activity.ts`
- `src/utils/activity.test.ts`
- `src/utils/const.ts`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-13 14:42] [Bugfix]
- **Change**: 将地图高度从双倍恢复为默认尺寸
- **Risk Analysis**: 风险较低，仅影响页面布局高度；地图加载、轨迹渲染和活动过滤逻辑未改动，但小屏与大屏的可视区域会回到原始水平。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `src/utils/const.ts`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-13 16:51] [Feature]
- **Change**: 新增统一活动类型筛选层，首页与汇总页共享同一份活动过滤结果
- **Risk Analysis**: 主要风险在于筛选状态改为全局共享后，会影响首页地图、统计和 summary 页面原有默认口径；已通过测试、格式检查和构建验证基础回归，但未做浏览器端交互截图回归。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/utils/activity.ts`
- `src/utils/activity.test.ts`
- `src/hooks/useActivities.ts`
- `src/contexts/ActivitiesContext.tsx`
- `src/components/ActivityTypeFilter/index.tsx`
- `src/components/ActivityTypeFilter/style.module.css`
- `src/components/ActivityList/index.tsx`
- `src/pages/index.tsx`
- `src/main.tsx`
----------------------------------------
## [2026-03-13 17:02] [Bugfix]
- **Change**: 优化活动类型筛选交互，固定跑步主类型并减少筛选切换时地图闪动
- **Risk Analysis**: 主要风险在于活动筛选状态被强制包含跑步后，会影响用户之前保存在 localStorage 的选择；此外跳过筛选切换动画后，地图反馈更稳但少了原来的轨迹重播效果。已通过测试、格式检查和构建验证。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/utils/activity.ts`
- `src/utils/activity.test.ts`
- `src/contexts/ActivitiesContext.tsx`
- `src/components/ActivityTypeFilter/index.tsx`
- `src/components/ActivityTypeFilter/style.module.css`
- `src/pages/index.tsx`
----------------------------------------
## [2026-03-13 17:29] [Bugfix]
- **Change**: 修复切换年份到 Total 时地图视口未回到当前范围的问题
- **Risk Analysis**: 主要风险在于自动 fit bounds 现在由 scope 变化驱动，可能影响城市、标题和类型筛选切换时的地图位置；已通过单元测试、格式检查、构建和浏览器手工路径验证。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/utils/map.ts`
- `src/utils/map.test.ts`
- `src/pages/index.tsx`
----------------------------------------
## [2026-03-13 17:45] [Bugfix]
- **Change**: 修复年份切换后地图仍沿用首条轨迹缩放的问题，改为按当前范围内全部轨迹坐标计算视口
- **Risk Analysis**: 新逻辑会影响所有依赖自动缩放的场景，包括年份切换、总览视图和多条轨迹定位；单条轨迹和无轨迹数据的默认视口已保留，但仍需在真实浏览器中继续观察大范围数据的缩放体感。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/utils/map.ts`
- `src/utils/map.test.ts`
- `src/pages/index.tsx`
----------------------------------------
## [2026-03-13 17:58] [Bugfix]
- **Change**: 补齐 Hiking 和 VirtualRun 的活动类型归一化，并让地图初始化优先聚焦主要活动簇，避免被少量远端城市数据拉歪缩放
- **Risk Analysis**: VirtualRun 现在会并入 running，可能改变跑步总数和汇总口径；主簇视口策略依赖活动簇数量和比例阈值，极少量跨城数据会被初始视图弱化，但单条轨迹定位和手动缩放不受影响。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/utils/activity.ts`
- `src/utils/activity.test.ts`
- `src/utils/map.ts`
- `src/utils/map.test.ts`
----------------------------------------
## [2026-04-07 19:48] [Feature]
- **Change**: 新增按年份生成的年度总结页面，保留原 /summary，并新增默认跳转到当前年减一的年度总结入口。
- **Risk Analysis**: 主要风险在于年度统计口径与现有活动数据格式的兼容性，以及年度总结下载卡片在不同浏览器中的表现仍有差异；已通过单元测试、构建和本地页面检查覆盖主要路径。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/main.tsx`
- `src/static/site-metadata.ts`
- `src/pages/summary.tsx`
- `src/pages/summary.module.css`
- `src/utils/yearSummary.ts`
- `src/utils/yearSummary.test.ts`
----------------------------------------
## [2026-04-08 09:51] [Bugfix]
- **Change**: 兼容 Keep GPX 点位时间戳的多种单位，避免生成 7000 年异常时间
- **Risk Analysis**: 风险主要在 Keep 导出时间归一化逻辑，可能影响少量历史 Keep 轨迹点时间；当前实现优先按 startTime 选择最接近的候选值，正常旧格式和当前仓库数据应保持不变，但仍建议在 CI 中再验证 gpx_sync 全链路。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `run_page/keep_sync.py`
- `run_page/test_keep_sync.py`
----------------------------------------
## [2026-04-08 10:10] [Critical-Fix]
- **Change**: 增加轨迹解析后的时间合法性校验，跳过异常年份和负时长的 GPX 记录
- **Risk Analysis**: 风险主要在解析层新增了更严格的拒绝条件，可能会过滤少量历史边界数据；但相比让 CI 和入库直接失败，这个取舍更稳妥，且测试已覆盖异常年份、结束早于开始、负时长三类问题。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `run_page/gpxtrackposter/track.py`
- `run_page/gpxtrackposter/test_track.py`
----------------------------------------
## [2026-04-08 10:15] [Critical-Fix]
- **Change**: 修复轨迹加载阶段吞掉异常导致坏对象继续入库的问题
- **Risk Analysis**: 风险主要在 TrackLoadError 现在会向上抛出，加载器会直接跳过坏文件；这会减少脏数据入库，但如果有依赖旧的吞异常行为的边角逻辑，可能影响少量容错路径。当前已有针对 load_gpx 传播异常的测试。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `run_page/gpxtrackposter/track.py`
- `run_page/gpxtrackposter/test_track.py`
----------------------------------------
## [2026-04-08 10:22] [Bugfix]
- **Change**: 调整 Keep 同步测试导入方式，修复 Ruff E402 并避免重复导入异常
- **Risk Analysis**: 风险较低，仅影响测试文件导入方式，不改生产逻辑；测试已验证通过，主要风险是不同 Python 版本下路径插入行为存在细微差异，但当前 CI 场景可覆盖。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `run_page/test_keep_sync.py`
----------------------------------------
## [2026-04-08 16:15] [Bugfix]
- **Change**: 修复年度总结页触摸事件类型写法导致的 ESLint 报错
- **Risk Analysis**: 风险较低，仅是 TSX 类型导入方式调整，不影响实际滑动翻页行为；已对该文件完成 prettier 和 eslint 校验。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `src/pages/summary.tsx`
----------------------------------------

## [2026-09-09] [Upstream Update]
- **Change**: 同步上游 `1639f8b` 的 3.0 主题、依赖和同步脚本，迁移并保留 Classic 个人配置、免费地图、活动筛选、年度总结及 Keep/轨迹校验修复。
- **Data**: 2363 个数据与静态产物文件完全保留；排除会自动改写历史活动类型和补造路线的上游逻辑，增加 SQLite 回归测试。
- **Verification**: 前端 23 项、Python 18 项、类型检查、构建及页面验证通过。完整检查结果、已知 lint 问题和上游版本见 [同步记录](upstream-sync-2026-09-09.md)。首次交付后，用户已授权提交并推送到 `origin/master`。
