# AI Change Log
## [2026-03-24 09:41] [Feature]
- **Change**: 新增疯言疯语独立栏目，补充导航、栏目索引页、本地列表模板覆盖与最小回归测试
- **Risk Analysis**: 本次改动覆盖了站点列表页模板，主要风险是其他 section 的标题展示逻辑发生变化；目前通过保留 posts 的 All articles 逻辑并对其他 section 回退到 .Title 来降低风险。由于本机未安装 hugo，尚未执行真实构建验证，若线上主题或 Hugo 版本行为有差异，可能在栏目页渲染上出现细节偏差。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `hugo.toml`
- `content/crazy-talk/_index.md`
- `content/crazy-talk/先有一个入口.md`
- `layouts/_default/list.html`
- `tests/crazy_talk_section_test.sh`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-24 09:58] [Feature]
- **Change**: 将疯言疯语栏目改为按天展开全文的时间流页面，并把示例内容调整为按天一文
- **Risk Analysis**: 本次改动新增了 crazy-talk 的 section 专属模板，主要风险是该栏目在文章数量增多后页面会变长，影响加载和阅读节奏；同时由于仍保留单篇页但列表页不再暴露跳转入口，后续若需要分享单日链接，需要用户主动进入对应 permalink。当前仅完成源码级测试，本机未安装 hugo，尚未做真实渲染验证。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `content/crazy-talk/2026-03-24.md`
- `layouts/crazy-talk/list.html`
- `tests/crazy_talk_section_test.sh`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-24 10:11] [Feature]
- **Change**: 新增 crazy-talk-publisher skill，用于快速创建或追加疯言疯语并自动提交推送，同时补充脚本级测试与 Git 推送集成验证
- **Risk Analysis**: 本次改动主要位于用户技能目录而非仓库内，风险在于该 skill 会对博客仓库执行自动 commit 和 push，若误触发会直接发布内容。已通过严格触发词、仅提交目标文件、临时仓库集成测试来降低风险，但真实仓库推送仍依赖本地 Git 凭证、网络和远端分支状态。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/SKILL.md`
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/agents/openai.yaml`
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/scripts/publish_crazy_talk.py`
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/scripts/test_publish_crazy_talk.py`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-24 10:26] [Refactor]
- **Change**: 将 crazy-talk-publisher skill 从写死仓库路径改为发现 Hugo 博客、相对路径缓存与失效后重新发现的机制
- **Risk Analysis**: 本次改动重构了 skill 的目标目录解析逻辑，主要风险在于缓存提示依赖当前执行目录，跨目录调用时可能失效；但缓存内容不再保存绝对路径，且每次都会校验 hugo.toml 与 content/crazy-talk，不命中时会回退到重新发现或创建目录。已通过脚本级测试与命令级发现+推送验证降低风险。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/SKILL.md`
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/scripts/publish_crazy_talk.py`
- `/Users/zhangyukun/.codex/skills/crazy-talk-publisher/scripts/test_publish_crazy_talk.py`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-24 18:30] [Feature]
- **Change**: 新增 blog-post-publisher skill，支持按文件名从 Obsidian inbox 发布到 content/posts，或按文本直发创建符合 posts 格式的文章，并自动 commit/push
- **Risk Analysis**: 主要风险是自动发布行为依赖输入 payload 语义，若用户输入与文件名重名会优先按文件发布；已通过测试覆盖文件发布、文本直发、仓库发现缓存和 git 推送流程。另一个风险是 description 取正文首行，若首行包含特殊字符可能影响展示，当前已做双引号转义。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/SKILL.md`
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/agents/openai.yaml`
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/scripts/publish_blog_post.py`
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/scripts/test_publish_blog_post.py`
- `docs/AI_CHANGELOG.md`
----------------------------------------
## [2026-03-24 18:38] [Refactor]
- **Change**: 调整 blog-post-publisher：直发正文必须显式标题，缺失时报错提示；description 改为按正文自动提炼一句摘要
- **Risk Analysis**: 主要风险是更严格的标题校验会阻止此前可直接发布的无标题文本；这符合新需求但会改变旧行为。description 提炼使用首句优先策略，若正文缺少句号会按长度截断，可能与用户期望摘要不完全一致。已补充并通过 8 条回归测试。
- **Risk Level**: S2（中级: 局部功能异常、可绕过但影响效率）
- **Changed Files**:
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/scripts/publish_blog_post.py`
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/scripts/test_publish_blog_post.py`
- `/Users/zhangyukun/.codex/skills/blog-post-publisher/SKILL.md`
- `docs/AI_CHANGELOG.md`
----------------------------------------
