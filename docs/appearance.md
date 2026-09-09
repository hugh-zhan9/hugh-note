# 网站外观

此改动基于 2026-09-08 的 `387c80e`，保留该版本的主页重构、月份与路线切换、那年今日及文章表格样式。

主页、博客列表和文章页共用配色。导航中的「外观」提供素纸（9 月 8 日重构后的原主页背景 `#faf9f6`）、暖纸、鼠尾草和夜幕四套预设。用户也可以通过取色器或 `#RRGGBB` 色值设置纯色背景，并随时恢复默认。

选择保存在当前浏览器的 `localStorage["theme-storage"]`，跨页和同源标签页同步。原有 `light`、`dark` 选择继续生效。自定义颜色保存为六位十六进制色值；无效输入不改变当前外观。浏览器拒绝存储时，面板会说明选择无法保存。

实现沿用 Hugo 的 `customCSS` / `customJS` 和项目模板覆盖机制：

- `assets/css/skin.css` 管理全站颜色变量；`homepage.css` 保留原有组件布局，通过颜色变量引用共享配色。
- `static/js/themetoggle.js` 覆盖 Archie 的同名脚本，负责首屏配色、外观控件和偏好存储。页面其他脚本不再管理主题。
- `layouts/partials/head.html` 提供共享外观入口。

自定义背景按相对亮度选择黑色或白色正文，保持至少 4.5:1 对比度。活动图、路线图和外观面板保持浅色或深色阅读底色。

构建需要 Hugo Extended（已用 0.165.0 验证）。基础检查：

```sh
bash tests/homepage_contract_test.sh
bash tests/crazy_talk_section_test.sh
node --test tests/skin_test.cjs
hugo --destination /tmp/hugh-note-build
```

新增预设时，在控制器的 `presets`、外观下拉框和 `skin.css` 中加入对应名称与颜色；保持布局样式在原有页面文件中。

浏览器回归测试需要 Playwright 和 Chromium。在 `hugo server` 启动后运行：

```sh
node tests/skin_browser_test.cjs
```

默认测试地址为 `http://localhost:1313`，可用 `SKIN_TEST_URL` 指定其他本地地址，用 `CHROMIUM_EXECUTABLE_PATH` 指定现有 Chromium。测试涵盖跨页一致性、自定义颜色、恢复默认、标签页同步，以及 320–1440px 的面板边界；截图写入系统临时目录。

跑步站点是单独部署的 `/running/`。仅用 Hugo 或静态文件服务器预览博客时，需要为该路径提供真实站点代理；否则数据请求返回 404，月份按钮维持隐藏。当前本地预览通过 `/tmp/hugh-note-preview.py` 将该路径代理到已发布的跑步站点。皮肤浏览器回归使用隔离的跑步样本，不能代替真实数据连接检查。

2026-09-09 已验证真实 `/running/` 页面与活动数据均返回 200：9 月暂无跑步记录，切换至 8 月后可以使用「月度总览 / 单次路线」。月份按钮在数据加载成功后显示；路线切换仅在所选月份有跑步记录时显示。
