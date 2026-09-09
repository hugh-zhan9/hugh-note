# Running Page Upstream Merge Design

**目标**

将 `running_page_main` 的后续功能和 bugfix 合并回 `running_page`，同时尽量保留晚青在以下文件中的定制意图，并在必要时做兼容修复而不是机械回退：

- `.github/workflows/run_data_sync.yml`
- `src/pages/index.tsx`
- `src/static/site-metadata.ts`
- `src/utils/const.ts`

**现状结论**

- `running_page` 与 `running_page_main` 共享共同祖先 `33d7b3190d714b24aca22be9f5e5630b59caba6e`
- `running_page_main` 自分叉后已有大量新功能、地图修复、依赖升级、同步脚本修复和页面增强
- `running_page` 自分叉后主要是数据与产物更新，少量站点级个性化修改集中在上述四个文件
- 因此本次应采用“受控上游合并 + 保护本地定制”的策略，而不是整仓覆盖或零散拷贝文件

**设计原则**

1. 通用代码以上游为准
2. 个性化定制以晚青提交意图为准
3. 若本地定制阻断上游新功能，则优先保证功能可用，再恢复定制效果
4. 生成产物不作为冲突处理依据，合并后统一重生成

**冲突处理规则**

**一、默认采用上游版本**

适用于以下内容：

- 通用前端组件
- 地图提供方适配与修复
- 同步脚本与导入逻辑
- 构建配置与依赖升级
- 页面 bugfix

**二、重点保护晚青定制**

以下文件逐段合并，不直接选 `ours` 或 `theirs`：

1. `.github/workflows/run_data_sync.yml`
   - 保留晚青的运行参数、数据源、部署偏好
   - 吸收上游 workflow 修复、CI 兼容、缓存和构建修复

2. `src/pages/index.tsx`
   - 保留晚青页面交互、布局和文案意图
   - 吸收上游对地图、年份切换、定位、主题联动等必要修复

3. `src/static/site-metadata.ts`
   - 本地站点元数据优先
   - 若上游新增字段为页面运行所需，则补齐字段并保留本地内容

4. `src/utils/const.ts`
   - 保留晚青的站点级展示配置和个性化开关
   - 吸收上游新增常量、地图 provider 配置和功能开关
   - 对已有常量命名或结构变化做兼容，不因保留旧写法导致功能缺失

**三、生成产物策略**

以下内容不手工保留历史差异，合并后统一按当前代码重生成：

- `assets/*.svg`
- `src/static/activities.json`
- `run_page/data.db`
- `GPX_OUT/`
- `FIT_OUT/`
- `TCX_OUT/`

**实施顺序**

1. 在 `running_page` 建立集成分支
2. 将 `running_page_main` 作为 `upstream` 合并进集成分支
3. 解决冲突，按保护规则处理四个关键文件
4. 安装依赖并运行最小验证
5. 重生成静态产物
6. 再次验证页面与 workflow 配置
7. 记录风险与后续维护建议

**验证重点**

- 地图底图与轨迹渲染恢复
- 首页与汇总页可访问
- 站点 metadata 正常显示
- workflow 配置仍符合晚青的使用方式
- 上游新增功能未被四个保护文件误伤

**后续维护建议**

- 后续继续以上游 remote 的方式同步，不再通过目录间人工拷贝
- 尽量把个性化改动继续收敛到配置文件和 metadata，减少对通用组件的侵入
- 若需要长期保留“单条记录手工修正”等能力，应新增配置层，而不是直接修改生成产物
