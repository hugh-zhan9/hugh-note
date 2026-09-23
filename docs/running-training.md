# 跑步 AI 训练建议

跑步首页在地图下展示最近 28 天统计、与前 28 天的比较、AI 分析和未来 7 天的安排。Classic 与 Dashboard 使用同一份报告。目标是有氧基础与半马完赛，每周可安排约 5 次，实际安排根据近期记录调整。没有比赛日期或成绩目标。

只有跑步进入分析，包含规范化后的室内/虚拟跑步；步行、骑行等不参与。统计不跟随页面年份、活动类别或地图筛选。零距离/零时长跑步从训练估算中排除并显示数量，缺失心率不当作零。统计由代码计算，AI 负责解释与建议。

## 配置

报告由 Vite 构建生成，产物为 `/running/data/training.json`。没有在线 AI 接口，访客不能触发模型调用。服务需支持 Chat Completions、JSON mode、`max_completion_tokens` 和 `store: false`。接口不兼容、拒绝或截断响应会使构建失败，不自动重试或切换模型。

在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Variable | `RUNNING_AI_ENABLED` | `true` 启用；未设置时不调用模型 |
| Variable | `RUNNING_AI_BASE_URL` | 如 `https://api.openai.com/v1` 或 `https://api.x.ai/v1`，不附加 `/chat/completions` |
| Variable | `RUNNING_AI_MODEL` | 账号可用且支持上述接口的精确模型 ID |
| Secret | `RUNNING_AI_API_KEY` | 对应服务的 API 密钥 |
| Secret | `RUNNING_REPORT_PASSWORD` | 密码管理器生成的长随机密码，20–256 字符，不能全是数字或含首尾空格 |
| Secret | `RUNNING_AI_PRIVATE_CONTEXT` | 私人目标、希望解读的范围、可引用的研究链接和证据摘要 |

不在公开文件中填写私人目标的具体内容。模型只能引用私人上下文提供的资料；未提供时必须说明证据不足。密码不会发送给 AI，但私人目标及必要的跑步摘要会发送给配置的模型服务；加密保护发布后的报告，不改变服务商的数据处理政策。

公开建议与私人解读分两次独立请求，公开请求不带私人上下文。只发送训练所需摘要，不发送账号、活动名称、地点、GPS 或原始活动 ID。每次请求最多 8,000 个输出/推理 token、120 秒、128 KB 响应，每次构建最多两次请求；费用按所选服务计算。

统一发布工作流只在受信任的 main、非 PR 构建中注入秘密。定时同步继续调用既有发布流程，无需修改 Keep 同步。启用后若缺少配置、任一请求失败、JSON 结构不合法或加密失败，整次构建失败，上一份完整站点不被替换。没有近期有效记录时，展示无数据状态，不调用模型。未启用时展示真实统计和“AI 建议尚未生成”。

本地可将同名环境变量放到 `apps/running/.env`（已忽略），再运行：

```sh
cd apps/running
node --env-file=.env node_modules/vite/bin/vite.js build
# 开发进程只生成一次；修改数据/配置后重启
node --env-file=.env node_modules/vite/bin/vite.js --host 127.0.0.1
```

不要加 `VITE_` 前缀，也不要把密码写进命令行、公开配置、截图或测试夹具。本地组合构建需在进程环境提供同名变量；普通 `node scripts/build.mjs` 不主动读取 `.env`。

## 私人报告

页面只有通用的“私人解读”入口，解锁前不显示私人标题、目标或正文。报告发布前用 PBKDF2-SHA256 与 AES-256-GCM 加密，每份报告有新的随机盐和 IV，认证数据绑定公开报告。密码、派生密钥和明文不写入仓库、日志、静态资源、Cookie、localStorage 或 sessionStorage。

浏览器通过 Web Crypto 解锁，需要 HTTPS 或 localhost。内容由 React 当作普通文本显示，不执行模型给出的 HTML。点击“锁定”、切换后台、离开页面或刷新会清除当前界面内容，尚未完成的解密也不能重新打开它。错误密码与密文损坏统一显示解锁失败。

密文公开可下载，必须使用长随机密码。此方式没有服务器端登录限流或撤销能力；更换密码不能使已下载的旧密文失效，也不能防止解锁后的屏幕被他人查看。

## 验证与维护

```sh
pnpm --dir apps/running test
pnpm --dir apps/running exec tsc --noEmit
node --test tests/site_build_test.mjs tests/site_workflow_test.mjs
node scripts/build.mjs
# 启动组合预览后，需要已安装 Playwright/Chromium
SITE_TEST_URL=http://127.0.0.1:1313 node tests/training_browser_test.cjs
```

单元测试使用模拟 API；浏览器测试使用测试报告验证展示与解锁，不代表真实模型输出质量。上线前需用所选服务实际生成报告，核对目标、训练量、解释和私人内容。测试密码与报告不可用于正式发布。

设计见[概要设计](loopx/design/2026-09-23-running-training/概要设计.md)及[详细设计](loopx/design/2026-09-23-running-training/需求设计文档.md)。接口参考：[OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode)、[xAI](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions)。
