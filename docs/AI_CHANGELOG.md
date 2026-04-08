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
