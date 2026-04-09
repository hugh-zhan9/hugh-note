# AI Change Log

## 2026-04-01

### Change
修复疯言疯语发布脚本为正文倒序写入，并批量重排现有日记条目。

### Risk Analysis
发布脚本现在会把新条目插到 front matter 之后，主要风险是旧文件若存在非标准分隔格式可能无法被正确识别；已用单测覆盖普通条目和带前言场景，并对现有文件做了受控重排。由于飞行记录脚本执行时仓库缺少 `docs/` 目录，本条为手工记录。

### Risk Level
S2

### Changed Files
content/crazy-talk/2026-03-24.md
content/crazy-talk/2026-03-25.md
content/crazy-talk/2026-03-27.md
content/crazy-talk/2026-03-29.md
content/crazy-talk/2026-03-31.md
content/crazy-talk/2026-04-01.md
## [2026-04-08 14:30] [Feature]
- **Change**: 实现博客动态首页并将原首页迁移到 /blog
- **Risk Analysis**: 主要风险在于 Hugo 模板需要依赖 enableGitInfo 提供 content 更新时间，且运行页数据通过运行时解析 /running/ 的哈希资源获取；如果运行页资源结构调整或构建环境缺少 Git 信息，首页的跑步模块或博客热力图会降级。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `hugo.toml`
- `content/blog/_index.md`
- `layouts/blog/list.html`
- `layouts/index.html`
- `assets/css/homepage.css`
- `static/js/homepage.js`
- `tests/homepage_contract_test.sh`
- `task_plan.md`
- `findings.md`
- `progress.md`
----------------------------------------
## [2026-04-08 14:40] [Bugfix]
- **Change**: 修复首页主题切换、空月跑步热力图和疯言疯语下一条交互
- **Risk Analysis**: 主要风险在于首页样式现在区分 light/dark 两套变量，并且首页脚本改为 DOMContentLoaded 后初始化；如果主题切换脚本后续改动存储键名或运行页资源结构继续变化，首页可能再次出现主题不同步或跑步数据降级。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `assets/css/homepage.css`
- `static/js/homepage.js`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 14:45] [Bugfix]
- **Change**: 修复首页疯言疯语数据注入和 running 数据解析
- **Risk Analysis**: 主要风险在于 running 数据解析现在通过受控的 Function 只执行提取出的模板字面量，以换取对 /running/ 资源转义内容的兼容；如果对方产物结构再次变化，首页会降级但不应阻断其他模块。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `static/js/homepage.js`
----------------------------------------
## [2026-04-08 14:48] [Bugfix]
- **Change**: 修复首页疯言疯语轮播数据源并调整跑步区默认显示
- **Risk Analysis**: 主要风险在于疯言疯语数据源从 JSON script 改成 DOM data 属性，模板和脚本必须同步；但这个方案比依赖 Hugo JSON 转义更稳，回归风险主要在于字段名改动导致轮播初始化失效。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `static/js/homepage.js`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:12] [Bugfix]
- **Change**: 修复首页主题同步与跑步空数据回退，并为入口按钮补充圆角样式
- **Risk Analysis**: 风险主要在首页 CSS 变量和运行区回退逻辑。若主题切换脚本与主题插件执行时序再次变化，首页深浅色仍可能出现短暂闪动；跑步数据源结构若未来变化，仍会走 0 公里回退，但至少不会再出现缺格或 -- 文案。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `assets/css/homepage.css`
- `static/js/homepage.js`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:15] [Bugfix]
- **Change**: 弱化首页跑步模块进度条视觉，改为更轻的圆角胶囊样式
- **Risk Analysis**: 风险较低，主要是首页 CSS 视觉调整。若个别浏览器对新样式支持差，最多退化为普通底色条，不影响跑步数据逻辑和热力图渲染。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:21] [Bugfix]
- **Change**: 修复首页疯言疯语轮播按整天聚合的问题，改为按单条时间分段展示
- **Risk Analysis**: 风险主要在 Hugo 模板对 crazy-talk markdown 的分段规则假设为 ### 时间。如果未来该栏目格式变化，首页可能退化为取不到条目，但不会影响 crazy-talk 正文页本身。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:24] [Bugfix]
- **Change**: 统一首页两个热力图为 GitHub 风格配色，并将跑步热力图改为按周横向展开
- **Risk Analysis**: 风险主要在首页 CSS 与博客热力图统计文案调整。若用户对深色模式下也要求严格复刻 GitHub 配色，当前实现仍是 GitHub 绿色层级加深色底，不影响数据逻辑；跑步热力图横向展开在窄屏上会以横向滚动呈现。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:31] [Bugfix]
- **Change**: 调整首页跑步热力图为单行横向条带，并将进度条恢复为整卡片宽度
- **Risk Analysis**: 风险较低，主要是首页跑步卡片 CSS 排布变化。窄屏下跑步热力图会继续横向滚动，但现在是一行日历条而不是多行周视图，不影响跑步数据和进度计算。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 15:44] [Bugfix]
- **Change**: 隐藏首页跑步热力图底部横向滚动条视觉
- **Risk Analysis**: 风险很低，仅为 CSS 视觉调整。保留了横向滚动能力但隐藏了滚动条，个别浏览器如果不支持对应属性，也只是继续显示滚动条，不影响数据展示。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 16:39] [Bugfix]
- **Change**: 补齐首页移动端响应式样式，优化小屏导航、标题字号和热力图尺寸
- **Risk Analysis**: 风险主要在首页 CSS 的断点调整。若个别尺寸设备的字重和间距仍显拥挤，需要再根据真机截图微调，但不会影响首页数据逻辑和交互脚本。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 16:47] [Bugfix]
- **Change**: 修复首页 Hero 三个入口按钮在移动端因宽度模型导致的溢出问题
- **Risk Analysis**: 风险很低，仅为首页按钮样式修正。调整为 border-box 并在移动端取消最小宽度后，按钮应始终落在容器内，不影响桌面端布局和跳转行为。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 16:55] [Bugfix]
- **Change**: 按当前页面过滤站点头部导航菜单，隐藏当前栏目对应按钮
- **Risk Analysis**: 风险较低，主要在导航 URL 归一化逻辑。当前实现会去掉路径末尾斜杠后比较，因此 Home、Blog、疯言疯语和 Tags 页面都应正确隐藏自身菜单项；若后续新增带查询参数或锚点的菜单，需要单独处理。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `layouts/partials/head.html`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-08 17:35] [Bugfix]
- **Change**: 首页头部仅保留颜色切换，隐藏 Blog、疯言疯语与 Tags 菜单项
- **Risk Analysis**: 风险很低，主要在站点头部模板逻辑。首页导航现在不再渲染任何菜单项，仅保留主题切换；其他页面仍按当前页过滤菜单项，不影响既有链接结构。
- **Risk Level**: S3（低级: 轻微行为偏差或日志/可观测性影响）
- **Changed Files**:
- `layouts/partials/head.html`
- `tests/homepage_contract_test.sh`
----------------------------------------
## [2026-04-09 09:37] [Feature]
- **Change**: 基于 ui-ux-pro-max 设计系统重构首页视觉语言，改为编辑型双栏 Hero 与冷调数据面板
- **Risk Analysis**: 风险主要在首页 CSS 大幅重写后的真实渲染效果。当前契约测试和脚本检查通过，但由于本地没有 hugo 无法直接预览最终页面，仍可能在实际构建后出现个别间距或主题细节需要微调。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `layouts/index.html`
- `assets/css/homepage.css`
- `tests/homepage_contract_test.sh`
----------------------------------------
