# Running Page Upstream Merge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `running_page_main` 的后续功能与 bugfix 合并到 `running_page`，同时保留晚青在四个关键文件中的个性化配置意图并修复兼容问题。

**Architecture:** 以 `running_page` 为主仓，在隔离分支中引入 `upstream/master` 进行受控 merge。通用代码以上游为准，四个保护文件逐段人工合并，最终通过重生成产物和最小运行验证来确认功能完整。

**Tech Stack:** Git, React, Vite, TypeScript, Python sync scripts, GitHub Actions workflow

---

### Task 1: 建立隔离分支与基线信息

**Files:**
- Modify: `.git/config`
- Reference: `docs/plans/2026-03-13-running-page-upstream-merge-design.md`

**Step 1: 记录当前状态**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page status --short --branch
git -C /Users/zhangyukun/project/running/running_page rev-parse HEAD
git -C /Users/zhangyukun/project/running/running_page rev-parse upstream/master
```

Expected: 工作区干净，能拿到当前 `HEAD` 和 `upstream/master` 提交号。

**Step 2: 创建集成分支**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page checkout -b chore/merge-upstream-2026-03-13
```

Expected: 成功切到新的隔离分支。

**Step 3: Commit**

此任务不提交，仅建立执行环境。

### Task 2: 先做失败验证和冲突预演

**Files:**
- Reference: `src/pages/index.tsx`
- Reference: `src/static/site-metadata.ts`
- Reference: `src/utils/const.ts`
- Reference: `.github/workflows/run_data_sync.yml`

**Step 1: 写出合并前验证清单**

记录需人工验证的页面和配置：
- 首页是否可打开
- 轨迹是否显示
- 汇总页是否可打开
- 站点 metadata 是否正确
- workflow 关键参数是否仍符合晚青配置

**Step 2: 预演 merge 但不提交**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page merge --no-commit --no-ff upstream/master
```

Expected: 出现冲突或待确认改动，明确冲突文件范围。

**Step 3: 收集冲突文件**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page status --short
```

Expected: 能明确四个保护文件及其他冲突点。

**Step 4: 回退预演状态**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page merge --abort
```

Expected: 回到干净状态。

### Task 3: 正式执行 merge 并处理非保护文件

**Files:**
- Modify: 通用冲突文件（以上游为主）

**Step 1: 再次执行 merge**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page merge --no-ff upstream/master
```

Expected: 进入冲突解决阶段。

**Step 2: 处理非保护文件**

原则：
- 通用代码、依赖、脚本、地图 provider 适配优先采用上游版本
- 生成产物先不人工处理

**Step 3: 记录剩余冲突**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page status --short
```

Expected: 剩余重点集中在四个保护文件和少量必要兼容文件。

### Task 4: 合并保护文件 `run_data_sync.yml`

**Files:**
- Modify: `.github/workflows/run_data_sync.yml`

**Step 1: 先对比三方内容**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page checkout --ours .github/workflows/run_data_sync.yml
git -C /Users/zhangyukun/project/running/running_page checkout --theirs .github/workflows/run_data_sync.yml
```

Expected: 明确晚青配置与上游 workflow 修复的差异。

**Step 2: 手工合并**

规则：
- 保留晚青的运行参数与部署偏好
- 吸收上游 CI、缓存、兼容性、脚本修复

**Step 3: 验证 YAML 基本可读**

Run:
```bash
python3 - <<'PY'
import yaml, pathlib
path = pathlib.Path('/Users/zhangyukun/project/running/running_page/.github/workflows/run_data_sync.yml')
yaml.safe_load(path.read_text())
print('ok')
PY
```

Expected: 输出 `ok`。

### Task 5: 合并保护文件 `site-metadata.ts` 与 `const.ts`

**Files:**
- Modify: `src/static/site-metadata.ts`
- Modify: `src/utils/const.ts`

**Step 1: 写出失败场景**

需要防止：
- 缺失上游新增字段导致页面报错
- 丢失晚青个性化 metadata
- 丢失上游新增地图 provider 配置导致底图不可用

**Step 2: 手工合并最小必要字段**

规则：
- 本地 metadata 内容优先
- 上游结构字段和新增常量补齐
- 地图 provider 配置必须引入

**Step 3: 运行类型检查或构建前检查**

Run:
```bash
cd /Users/zhangyukun/project/running/running_page && pnpm build
```

Expected: 若失败，应指向缺失常量或字段，继续修复直到通过。

### Task 6: 合并保护文件 `src/pages/index.tsx`

**Files:**
- Modify: `src/pages/index.tsx`

**Step 1: 写出失败目标**

需验证：
- 页面能渲染
- 单条轨迹定位、年份切换、地图联动不报错
- 晚青定制交互仍存在

**Step 2: 手工合并**

规则：
- 保留晚青页面意图
- 上游与地图、主题、定位、URL hash、渲染相关的必要修复优先引入

**Step 3: 运行构建**

Run:
```bash
cd /Users/zhangyukun/project/running/running_page && pnpm build
```

Expected: 构建通过。

### Task 7: 重生成产物并验证

**Files:**
- Modify: `assets/*.svg`
- Modify: `src/static/activities.json`
- Modify: `run_page/data.db`

**Step 1: 生成前确认脚本可运行**

Run:
```bash
cd /Users/zhangyukun/project/running/running_page && python3 run_page/gen_svg.py --help > /tmp/running_page_gen_svg_help.txt
```

Expected: 命令成功返回。

**Step 2: 按现有配置重生成必要产物**

Run:
```bash
cd /Users/zhangyukun/project/running/running_page && pnpm build
```

Expected: `dist` 正常生成。

**Step 3: 记录是否需要额外跑同步脚本**

如果当前本地数据不足以重生成所有产物，明确记录限制，不编造成功结论。

### Task 8: 最终验证、提交与记录

**Files:**
- Modify: `docs/AI_CHANGELOG.md`

**Step 1: 最终验证**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page status --short
cd /Users/zhangyukun/project/running/running_page && pnpm build
```

Expected: 构建成功，改动集中在预期文件。

**Step 2: Commit**

Run:
```bash
git -C /Users/zhangyukun/project/running/running_page add .
git -C /Users/zhangyukun/project/running/running_page commit -m "merge: sync upstream running_page_main with local customizations"
```

Expected: 提交成功。

**Step 3: 运行 flight recorder**

Run:
```bash
python3 "/Users/zhangyukun/.codex/skills/flight-recorder/scripts/log_change.py" "Refactor" "合并上游 running_page_main 功能并保留晚青定制配置" "主要风险在于四个保护文件与上游新结构的兼容处理，尤其是地图配置和首页交互逻辑；如果定制字段遗漏，可能造成页面构建失败或功能退化。" "S2" ".github/workflows/run_data_sync.yml,src/pages/index.tsx,src/static/site-metadata.ts,src/utils/const.ts"
```

Expected: `docs/AI_CHANGELOG.md` 追加一条中文记录。

Plan complete and saved to `docs/plans/2026-03-13-running-page-upstream-merge.md`. Two execution options:

**1. Subagent-Driven (this session)** - 我在当前会话直接执行这份计划并逐步处理冲突

**2. Parallel Session (separate)** - 新开会话按 `executing-plans` 逐任务执行

**Which approach?**
