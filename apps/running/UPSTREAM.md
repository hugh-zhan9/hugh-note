# 跑步应用来源

导入来源 https://github.com/hugh-zhan9/running ，提交 `0e2c77a`（2026-09-09），完整保留受版本控制文件，许可证见 LICENSE。上游 https://github.com/yihong0618/running_page ，当前同步基线 `1639f8b`，历史同步约束见 docs/upstream-sync-2026-09-09.md。

本应用由仓库根目录脚本组合构建与发布；此目录 .github 下的工作流仅为原始导入记录，不会在 GitHub 上执行。实际同步/发布配置位于根 .github/workflows。

全站适配集中在 plugins/、src/site/，以及共享数据/主题 hooks；后续同步上游时保留这些接入点。不要导入上游的个人数据或在没有核对的情况下覆盖已有 GPX/DB/JSON。
