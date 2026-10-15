# XXL-Job Flow Atlas

把 xxl-job 平台导出的任务 XML（`<linked-list>/<job>` 三层结构）导入 Obsidian，
生成结构化的「任务流 / 批任务 / 任务组件」三类 Markdown 文档，自动建立父子回链与 mermaid 依赖图。

> [!info] 设计文档
> 完整设计见 `xxl-job 导入调研/xxl-job XML 导入插件设计方案.md`（工作区文档，非本仓库）。

## 能力

| 环节 | 说明 |
|---|---|
| 输入 | 支持单个 / 多个 XML，或直接选整个目录（自动筛选 `.xml`），可跨文件合并导入 |
| 解析 | 实体反转义、`executorParam` JSON 校验、雪花 ID 按字符串处理（不丢精度）、按 `jobLevelType` 判定层级 |
| 映射 | 三级 n 元树：任务流(MAIN) → n 个任务(VIRTUAL) → n 个任务组件(COMPONENT) |
| 生成 | frontmatter 严格按 `_fileclasses` 字段与中文枚举；正文按 `_template` 骨架全量生成，未知项标「待确认」 |
| 关联 | 父文档正文生成 mermaid 依赖图 + `[[双链]]`；子文档 frontmatter 写「对应任务流名称 / 对应批任务名称」回链 |
| 幂等 | 以目标路径为键，重导入按冲突策略处理：跳过 / 更新 frontmatter（保留手写正文）/ 新建副本 |

## 生成的目录结构

```
8.xxljob/<执行器>/
├── 任务流/    「任务流」fileClass：任务流名称、业务执行日期、Cron、负责人、调度过期策略、调度状态
├── 任务/      「批任务」fileClass：对应任务流名称、任务名称、负责人、任务参数、调度过期策略
└── 任务组件/  「任务组件」fileClass：对应批任务名称、任务组件名称、路由策略、阻塞处理策略、分片参数、jobBeanName
```

## 使用

1. 命令面板执行 **导入 xxl-job 任务 XML**（或点左侧 Ribbon 的云上传图标）。
2. 选择文件 / 目录 → 确认执行器名（按 jobGroup 自动匹配清单，可改）→ 预览三级树 → 导入。
3. 导入后执行器名与 jobGroup 的绑定会回写到设置页的执行器清单，下次同分组不再询问。

### 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| 文档根目录 | `8.xxljob` | 生成文档放在哪个文件夹下 |
| 重名文档处理 | 跳过 | 也可选「更新 frontmatter」「新建副本」 |
| 执行器清单 | 空 | 每行：执行器名称，或 `执行器名称|任务分组编号1,编号2` |

## 开发

```bash
npm install         # 安装依赖
npm run dev         # esbuild watch 模式 -> 生成 main.js
npm run build       # 类型检查 + 生产构建
npm run lint        # eslint（含 eslint-plugin-obsidianmd，覆盖大部分上架审核规则）
npm test            # 单元测试（含两个真实 XML 样例，fixture 缺失时自动跳过）
npm run dryrun -- <xml 路径...> [--write] [--policy=skip|update|rename] [--out=.dryrun]
```

`dryrun` 用于不进 vault 的端到端验证：打印解析结果与生成计划，加 `--write` 才落盘到暂存目录
（默认 `.dryrun/`，已 gitignore）。重复执行可验证三种冲突策略的幂等行为。

### 模块划分

```
src/parser.ts       XML → ParsedJob（反转义、长 ID、层级判定、画布/依赖提取）
src/mapping.ts      枚举映射表、层级树构建（buildFlowTree）、父子回链、文件名净化
src/writer.ts       frontmatter + 正文 + mermaid 生成，三遍法编排（组件 → 任务 → 任务流）
src/importer.ts     写入 vault（建目录、冲突策略）
src/executors.ts    执行器清单与文件名推断（纯逻辑）
src/frontmatter.ts  frontmatter 拆分/合并（纯逻辑）
src/ui/importModal.ts 四步导入向导
```

### 本地调试（dev vault）

本仓库已软链到本地独立开发库：

```
/Users/chenzhongjun/WorkBuddy/obsidian/dev-vault/.obsidian/plugins/xxljob-flow-atlas  ->  本项目
```

1. 在 Obsidian 中「打开文件夹作为仓库」→ 选择 `dev-vault`。
2. 设置 → 第三方插件 → 关闭受限模式 → 启用 **XXL-Job Flow Atlas**。
3. 保持 `npm run dev` 运行，代码修改会自动重新构建；Hot-Reload 插件会自动重载。

> [!warning]
> 调试时请把设置里的「文档根目录」指向 dev vault 内的目录，避免写进主力库。

### 开发红线（来自调研笔记）

- 用户输入或拼接的路径必须过 `normalizePath()`。
- 用到 Node / Electron API 时，`manifest.json` 必须设 `"isDesktopOnly": true`。
- 用 `createEl()` / `el.empty()` 代替 `innerHTML`；样式用 CSS 类，不直接改 `element.style`。
- 所有注册都放在 `onload()` 并使用 `register*` 系列；`onunload()` 中不要 detach leaves。
- 命令不要设默认快捷键；命令 ID 不要包含插件 ID。

## 发布

1. `npm version 1.0.0`（同步更新 manifest/package/versions.json）。
2. `git tag -a 1.0.0 -m "1.0.0" && git push origin 1.0.0`。
3. GitHub Actions 自动构建并创建 draft release，附
   `main.js` / `manifest.json` / `styles.css`（tag **必须**与 manifest `version` 完全一致，无 `v` 前缀）。
4. 发布 release 后，在 <https://community.obsidian.md> 提交上架。

## 许可证

[MIT](LICENSE)
