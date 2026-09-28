# 牧己的个人网站

Hugo 博客、React 跑步应用和静态图床在同一仓库维护，共用外观和发布流程。

```sh
git submodule update --init --recursive
pnpm --dir apps/running install --frozen-lockfile
pnpm --dir apps/images install --frozen-lockfile
bash scripts/preview.sh
```

预览默认打开 <http://127.0.0.1:1313>。需要 Node.js 24+、pnpm、Hugo Extended 0.165.0 和 Python 3。

- [构建、测试、部署切换和上游维护](docs/running-integration.md)
- [全站外观](docs/appearance.md)
- [静态图床使用与配置](docs/images.md)
- [跑步应用来源](apps/running/UPSTREAM.md)
