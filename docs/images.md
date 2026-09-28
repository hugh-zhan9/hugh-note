# 静态图床

入口 `/images/`，源码 `apps/images`。参考兰空图床的拖拽、粘贴、预览与链接复制流程，重新用 React/TypeScript 实现，没有引入 PHP、登录系统或兰空源码。

## 首次使用

1. 确认公开图片仓库 `hugh-zhan9/hugh-image` 已通过添加 README 等方式初始化 `main` 分支。图片不存进 `hugh-note`。
2. 在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建 Token；Repository access 只选择图片仓库，授予 Contents: Read and write。有效期自行选择。
3. 打开图床，输入 Token 后点击连接。仓库固定为 `hugh-zhan9/hugh-image`、分支为 `main`，使用 GitHub 原始图片地址；页面不展示仓库配置项，也不读取旧的浏览器仓库配置。
4. 选择、拖拽或粘贴图片，再点击上传。每批最多 20 张，每张最多 10 MB；完成后复制 URL 或 Markdown。

Token 仅在当前页面内存中，刷新、离开或点击“清除 Token”后清除；它只会直接发送给 `api.github.com`。仓库配置不读写浏览器存储。不要把 Token 放到构建变量、GitHub Actions 输出或公开代码中。Contents 写权限本身也允许修改和删除；本应用只创建文件，不执行这些操作。

直接使用 `raw.githubusercontent.com` 的图片地址，不要求配置 Pages。GitHub 访问速度和限制仍影响上传、浏览与图片展示。

## 连接时提示分支无法读取

公开仓库存在不代表 `main` 已创建。空仓库需先在 GitHub 添加 README 并提交到 `main`，再连接；若分支已存在，检查 Token 是否授权 `hugh-image` 和 Contents 权限。应用只做读取检查，不自动创建分支或提交初始化文件。

## 图片规则

支持 JPEG、PNG、WebP、GIF，拒绝 SVG。默认压缩 JPEG/PNG：最长边 2000px，WebP 质量 0.85；若转换后更大则保留原文件。GIF/WebP 保留原文件以保留动画；其他图片可关闭压缩。最大解码尺寸 4000 万像素。

最终内容的 SHA-256 生成路径 `images/ab/<hash>.<ext>`。相同结果复用已有图片；同路径不同内容拒绝覆盖。压缩设置或浏览器编码不同可能得到不同内容和路径。只支持新增，无重命名、修改、删除或远程清理。界面的“清空队列”只清理本地预览。

多张图片串行写入，逐张显示成功或失败；失败不回滚已经写入的图片。网络超时后 GitHub 可能已经完成提交，手动重新上传同图会核对已有内容，不覆盖。遇到权限、限额或分支冲突会报错，不自动重试。

图片库读取 `main` 分支的 `images/` 目录（含子目录），按路径排列，每次显示 60 张。它不依赖数据库或索引文件；GitHub 返回截断结果时显示错误。原图用于懒加载预览，不额外写入缩略图。

## 开发和验证

```sh
pnpm --dir apps/images install --frozen-lockfile
pnpm --dir apps/images dev
pnpm --dir apps/images test
pnpm --dir apps/images typecheck
pnpm --dir apps/images check
node scripts/build.mjs
```

组合预览沿用 `bash scripts/preview.sh`。浏览器回归使用应用自己的 Playwright 依赖，需已安装 Chromium（`pnpm --dir apps/images exec playwright install chromium`），或者指定 `CHROMIUM_EXECUTABLE_PATH`：

```sh
SITE_TEST_URL=http://127.0.0.1:1313 node apps/images/tests/browser.mjs
```

测试拦截 GitHub API，不写入真实仓库。生产页面 CSP 仅允许同源脚本、GitHub API 连接及 HTTPS 图片；无第三方脚本。组合构建新增图床步骤，失败时沿用旧产物，不发布半成品。部署仍通过根 `.github/workflows/depoly.yml`。

设计合同见 [静态图床概要](loopx/design/2026-09-28-static-images/概要设计.md)。本次工作不包含旧图迁移、创建图片仓库或生产部署。
