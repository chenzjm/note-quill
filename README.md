# XXL-Job Flow Atlas

Import job definitions exported from an [xxl-job](https://github.com/xuxueli/xxl-job) admin console into your vault as structured **task flow / task / task component** notes, with parent links and generated Mermaid dependency graphs.

An xxl-job export is a `<linked-list>` of jobs nested three levels deep: a task flow (`MAIN`) contains N tasks (`VIRTUAL`), each task contains N task components (`COMPONENT`). This plugin mirrors that tree into Markdown — one note per job — and keeps re-imports idempotent.

| | |
|---|---|
| Input | one XML, several XMLs, or a whole folder (only `.xml` files are read) |
| Output | `8.xxljob/<executor>/<level>/<name>.md` — root folder is configurable |
| Notes | no network access, no telemetry, no accounts, no paid features |
| Requires | Obsidian 1.6.0 or newer · desktop and mobile |

## Installation

**Community directory** — Settings → Community plugins → Browse → search for “XXL-Job Flow Atlas”.

**BRAT (beta builds)** — install [BRAT](https://github.com/TfTHacker/obsidian42-brat), then *Add beta plugin* → `chenzjm/xxljob-flow-atlas`.

**Manually** — download `main.js`, `manifest.json` and `styles.css` from the latest release, put all three in `<your vault>/.obsidian/plugins/xxljob-flow-atlas/`, restart Obsidian, then enable **XXL-Job Flow Atlas** under Settings → Community plugins → Installed plugins.

## Before your first import

All four items are optional — the plugin runs with its defaults — but this is what makes the output match your own conventions:

- **Executor names.** The exported XML only carries a numeric `jobGroup`, never the executor name. The wizard asks for a name the first time it sees a group and remembers the mapping; you can also pre-fill it under Settings → 执行器清单, one line per entry: `ExecutorName|groupNumber`.
- **Note templates.** Three Markdown templates control the structure of the generated notes (defaults point at `_template/业务模板/xxljob-批任务-pirenwu/` in your vault). Point the three template settings at your own files, or clear them to fall back to the built-in structure. Ready-to-copy samples live in [`templates/`](templates) of this repository.
- **File classes.** Generated frontmatter carries `fileClass: 任务流 / 批任务 / 任务组件`. Without matching definitions those keys are plain YAML — generation still works, but field views and Meta Bind bindings do not. Samples are in [`templates/fileclasses/`](templates/fileclasses) for vaults using the Fileclass plugin (community plugin id `fileclass`).
- **Folder selection** is desktop-only. On mobile, pick XML files instead of a folder.

## Usage

1. Run **导入 xxl-job 任务 XML** from the command palette (or click the upload-cloud ribbon icon).
2. Pick files or a folder → confirm the executor name → review the three-level tree → import.
3. Executor names confirmed in step 2 are written back to the settings list, so the same job group is never asked twice.

Re-importing the same export is safe: existing notes are handled per the conflict policy — skip, update frontmatter (hand-written body preserved, the parent-link section refreshed), or create a renamed copy.

## Settings

| Setting | Default | Notes |
|---|---|---|
| 文档根目录 (root folder) | `8.xxljob` | Where generated notes are placed |
| 重名文档处理 (conflict policy) | 跳过 (skip) | skip / update frontmatter / create a renamed copy |
| 执行器清单 (executors) | empty | One per line: `name` or `name\|group1,group2` |
| 任务流 / 批任务 / 任务组件模板 (templates) | see above | Clear a field to use the built-in structure |

## Generated note structure

```
8.xxljob/<executor>/
├── 任务流/    task flow notes
├── 任务/      task notes — body has a “# 对应任务流” backlink section
└── 任务组件/   task component notes — body has a “# 对应批任务” backlink section
```

The import wizard, settings and generated notes are in Chinese (the plugin was built for a Chinese-language vault); the parser and generation logic are language-agnostic.

## Privacy and policies

- The plugin makes **no network requests** and collects **no telemetry**.
- It reads and writes only files inside your vault.
- It has no accounts, ads, or paid tiers, and does not install or update itself.
- Licensed under [MIT](LICENSE).

---

# 中文说明

## 能力

| 环节 | 说明 |
|---|---|
| 输入 | 支持单个 / 多个 XML，或直接选整个目录（自动筛选 `.xml`），可跨文件合并导入 |
| 解析 | 实体反转义、`executorParam` JSON 校验、雪花 ID 按字符串处理（不丢精度）、按 `jobLevelType` 判定层级 |
| 映射 | 三级 n 元树：任务流(MAIN) → n 个任务(VIRTUAL) → n 个任务组件(COMPONENT) |
| 生成 | 正文**套用 `_template` 的模板**生成，未知项保留模板填写提示；模板缺失时回退内置结构 |
| 关联 | 父文档正文生成 mermaid 依赖图 + `[[双链]]`；**子文档正文写「# 对应任务流」/「# 对应批任务」章节，用 `[[双链]]` 引入父级文档** |
| 幂等 | 以目标路径为键，重导入按冲突策略处理：跳过 / 更新（保留手写正文 + 刷新归属章节）/ 新建副本 |

## 文档模板

生成的三类文档默认套用 vault 里的模板（设置页可改路径）：

| 设置 | 默认 |
|---|---|
| 任务流模板 | `_template/业务模板/xxljob-批任务-pirenwu/xxljob-任务流-renwuliu.md` |
| 批任务模板 | `_template/业务模板/xxljob-批任务-pirenwu/xxljob-批任务-pirenwu.md` |
| 任务组件模板 | `_template/业务模板/xxljob-批任务-pirenwu/xxljob-任务组件-renwuzujian.md` |

仓库内 [`templates/`](templates) 放着这三份模板的副本，可直接复制进你自己的 vault。

套模板的规则：

- **frontmatter**：沿用模板的键顺序；能从 XML 确定的写真实值，确定不了的**保留模板里的 `{{填写提示}}`** 由人工补。
- **正文**：模板里的 `{{：任务简述…}}` 换成导入生成的简述；模板里自带的 mermaid 示例图整体替换为真实依赖图。
- **人工项**：任务组件模板的「业务范围 / 防重机制 / 外部接口 / 接口防重 / 交易状态 / 分页排序」—— 能从任务参数推断的（业务范围的机构与租户、分页的 pageSize）会自动填，其余**保留填写提示**。
- 模板没读到（路径为空或文件不存在）时回退内置结构，并弹一次提示。

> [!note]
> 任务参数只在批任务 frontmatter 的 `任务参数` 键里，正文不重复展开成表格；
> 任务的 author / addTime / 原 id 等来源信息也不写进正文。

## 生成的目录结构

```
8.xxljob/<执行器>/
├── 任务流/    「任务流」fileClass：任务流名称、业务执行日期、Cron、负责人、调度过期策略、调度状态
├── 任务/      「批任务」fileClass：任务名称、负责人、任务参数、调度过期策略；正文有「# 对应任务流」
└── 任务组件/  「任务组件」fileClass：任务组件名称、路由策略、阻塞处理策略、分片参数、jobBeanName；正文有「# 对应批任务」
```

> [!note] 归属关系写在正文，不在 frontmatter
> 改用正文一级章节 + 双链引入父级文档（父级缺失时标「待确认」）：
>
> ```markdown
> # 对应任务流
>
> [[8.xxljob/执行器/任务流/XXX|XXX]]
> ```
>
> 以「更新」策略重导入时，frontmatter 整体刷新（废弃键自动清除）、归属章节同步刷新，其余手写正文原样保留。

## 使用

1. 命令面板执行 **导入 xxl-job 任务 XML**（或点左侧 Ribbon 的云上传图标）。
2. 选择文件 / 目录 → 确认执行器名（按 jobGroup 自动匹配清单，可改）→ 预览三级树 → 导入。
3. 导入后执行器名与 jobGroup 的绑定会回写到设置页的执行器清单，下次同分组不再询问。

## 开发

```bash
npm install         # 安装依赖
npm run dev         # esbuild watch 模式 -> 生成 main.js
npm run build       # 类型检查 + 生产构建
npm run lint        # eslint（含 eslint-plugin-obsidianmd，覆盖大部分上架审核规则）
npm test            # 单元测试（含两个真实 XML 样例，fixture 缺失时自动跳过）
npm run dryrun -- <xml 路径...> [--write] [--policy=skip|update|rename] [--out=.dryrun] [--templates=<目录>]
python3 scripts/pack.py [--from-vault]   # 打包成可直接发给别人的 zip
```

`--templates` 指定模板目录（目录下需有 `xxljob-任务流-renwuliu.md` / `xxljob-批任务-pirenwu.md` / `xxljob-任务组件-renwuzujian.md`），
默认用仓库内 `templates/` 的副本；想按真实模板验证就指向 vault 的 `_template/业务模板/xxljob-批任务-pirenwu`。

`dryrun` 用于不进 vault 的端到端验证：打印解析结果与生成计划，加 `--write` 才落盘到暂存目录
（默认 `.dryrun/`，已 gitignore）。重复执行可验证三种冲突策略的幂等行为。

### 模块划分

```
src/parser.ts       XML → ParsedJob（反转义、长 ID、层级判定、画布/依赖提取）
src/mapping.ts      枚举映射表、层级树构建（buildFlowTree）、父子回链、文件名净化
src/writer.ts       frontmatter + 正文生成（模板驱动）、mermaid、三遍法编排（组件 → 任务 → 任务流）
src/importer.ts     写入 vault（建目录、路径规范化、冲突策略）
src/executors.ts    执行器清单与文件名推断（纯逻辑）
src/frontmatter.ts  frontmatter 拆分/合并（纯逻辑）
src/templates.ts    从 vault 读取三类模板原文（读不到时返回缺失清单）
src/bundle.ts       供聚合插件 require 的入口（导出解析/生成/应用等 API）
src/ui/importModal.ts 四步导入向导
```

### 本地调试（dev vault）

把本仓库软链或复制到独立开发库：

```
<dev-vault>/.obsidian/plugins/xxljob-flow-atlas  ->  本项目
```

1. 在 Obsidian 中「打开文件夹作为仓库」→ 选择 dev vault。
2. 设置 → 第三方插件 → 关闭受限模式 → 启用 **XXL-Job Flow Atlas**。
3. 保持 `npm run dev` 运行，代码修改会自动重新构建；装了 Hot-Reload 会自动重载。

> [!warning]
> 调试时请把设置里的「文档根目录」指向 dev vault 内的目录，避免写进主力库。

### 开发红线（来自调研笔记）

- 用户输入或拼接的路径必须过 `normalizePath()`。
- 用到 Node / Electron API 时，`manifest.json` 必须设 `"isDesktopOnly": true`。
- 用 `createEl()` / `el.empty()` 代替 `innerHTML`；样式用 CSS 类，不直接改 `element.style`。
- 所有注册都放在 `onload()` 并使用 `register*` 系列；`onunload()` 中不要 detach leaves。
- 命令不要设默认快捷键；命令 ID 不要包含插件 ID。

## 发布

1. `npm version x.y.z`（同步更新 manifest / package / versions.json；`.npmrc` 已关掉 `v` 前缀）。
2. `git tag -a x.y.z -m "x.y.z" && git push origin x.y.z`。
   tag **必须**与 manifest 的 `version` 完全一致、无 `v` 前缀 —— CI 会先校验，不一致直接失败。
3. GitHub Actions 自动 `npm ci` + 构建 + 生成构建来源证明，并创建 **draft** release
   （附 `main.js` / `manifest.json` / `styles.css`）。
4. 到 Releases 页面把 draft 发布成正式 release，然后在 <https://community.obsidian.md> 提交上架。

## 许可证

[MIT](LICENSE)
