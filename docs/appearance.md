# 网站外观

此改动基于 2026-09-08 的 `387c80e`，保留该版本的主页重构、月份与路线切换、那年今日及文章表格样式。

主页、博客列表、文章页和普通跑步页面共用配色。仅主页导航显示「外观设置」图标（半明半暗的圆形），保留键盘操作、提示文字和 44px 点击区域；其他页面沿用选择，不显示设置入口。面板使用 12px 圆角，内部输入框和按钮使用 6px 圆角；「预设主题」提供素纸（9 月 8 日重构后的原主页背景 `#faf9f6`）、暖纸、鼠尾草和夜幕四套预设。用户也可以通过取色器或 `#RRGGBB` 色值设置纯色背景，并随时恢复默认。

选择保存在当前浏览器的 `localStorage["theme-storage"]`，跨页和同源标签页同步。原有 `light`、`dark` 选择继续生效。自定义颜色保存为六位十六进制色值；无效输入不改变当前外观。浏览器拒绝存储时，面板会说明选择无法保存。

实现沿用 Hugo 的 `customCSS` / `customJS` 和项目模板覆盖机制：

- `assets/css/site-tokens.css` 管理全站颜色变量；`homepage.css` 保留原有组件布局，通过颜色变量引用共享配色。
- `static/js/themetoggle.js` 覆盖 Archie 的同名脚本，负责首屏配色、外观控件和偏好存储。页面其他脚本不再管理主题。
- `layouts/partials/appearance.html` 与 `assets/css/appearance-controls.css` 提供仅在 Hugo 主页挂载的面板。
- `apps/running/src/site/` 接入共享偏好与配色，不挂载面板，各页面保留自己的布局。
- 年度总结 `/running/summary/:year` 保留原 running 的深色渐变、橙色强调、IBM Plex 字体和全屏翻页；不显示全站导航，不跟随皮肤变色，也不改写保存的偏好。普通跑步导航保留「年度总结」，按已有逻辑默认进入最近的已完成年度。

自定义背景按相对亮度选择黑色或白色正文，保持至少 4.5:1 对比度。活动图、路线图和外观面板保持浅色或深色阅读底色。

构建需要 Hugo Extended（已用 0.165.0 验证）。基础检查：

```sh
bash tests/homepage_contract_test.sh
bash tests/crazy_talk_section_test.sh
node --test tests/skin_test.cjs
hugo --destination /tmp/hugh-note-build
```

新增预设时，在控制器的 `presets`、外观下拉框和 `site-tokens.css` 中加入对应名称与颜色；保持布局样式在原有页面文件中。

浏览器回归测试需要 Playwright 和 Chromium。在 `bash scripts/preview.sh` 启动组合站点后运行：

```sh
node tests/skin_browser_test.cjs
```

默认测试地址为 `http://localhost:1313`，可用 `SKIN_TEST_URL` 指定其他本地地址，用 `CHROMIUM_EXECUTABLE_PATH` 指定现有 Chromium。测试涵盖跨页一致性、自定义颜色、恢复默认、标签页同步，以及 320–1440px 的面板边界；截图写入系统临时目录。

跑步现在由 `apps/running` 构建到同一站点 `/running/`。主页直接请求 `/running/data/activities.json`，不再依赖外部站点代理或打包 JS 的内部格式。`tests/site_browser_test.cjs` 用真实构建数据检查跨应用行为；旧的皮肤测试保留隔离样本，负责博客外观回归。

构建、预览、部署切换与后续上游同步见 [同仓维护说明](running-integration.md)。

网站图标为原创「己」字印记：墨绿（`#294d3c`）圆角底，暖纸白（`#faf9f6`）笔画如回转的小径。SVG 源文件在 `static/favicon.svg`，`static/favicon.png` 为 64px 导出，`static/favicon.ico` 包含 16/32/48px。修改图形时同步导出这两种位图；图形不依赖字体。Hugo 通过既有 `params.favicon` 引用 PNG，跑步通过 Vite 的 HTML 资源处理引用同一源 PNG，独立开发与组合发布均可使用。
