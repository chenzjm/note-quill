# XXL-Job Flow Atlas v{{VERSION}} 安装说明

把 xxl-job 平台导出的任务 XML 导入 Obsidian，自动生成「任务流 / 批任务 / 任务组件」三类结构化文档，
并建好父子回链与 mermaid 依赖图。

- 仓库：<https://github.com/chenzjm/xxljob-flow-atlas>
- 版本：{{VERSION}} ｜ 插件 id：`xxljob-flow-atlas` ｜ 最低 Obsidian 版本：1.6.0

## 一、包内容

```
xxljob-flow-atlas/                     ← 插件本体，解压到 .obsidian/plugins/
├── main.js
├── manifest.json
└── styles.css
vault-配套文件/                         ← 解压到 vault 根目录（与已有目录合并）
├── _fileclasses/                     三份字段类定义
└── _template/业务模板/xxljob-批任务-pirenwu/   三份文档模板
安装说明.md
```

## 二、安装插件（3 步）

1. 把 `xxljob-flow-atlas/` 整个文件夹复制到 `<你的 vault>/.obsidian/plugins/` 下。
   目录名必须保持 `xxljob-flow-atlas`（要与 `manifest.json` 里的 `id` 一致）。
2. **完全退出并重开 Obsidian**。运行中往插件目录新增文件夹，设置页里不会出现它。
3. 设置 → 第三方插件 → 关闭受限模式 → 在已安装插件列表中启用 **XXL-Job Flow Atlas**。

## 三、安装配套文件（建议一起装）

把 `vault-配套文件/` 里的两个目录合并进 vault 根目录：

- **`_fileclasses/`（三份字段类定义）**
  生成的文档 frontmatter 写了 `fileClass: 任务流 / 批任务 / 任务组件`。库里没有对应定义时，
  这些键只是普通 YAML —— 不影响生成，但字段视图、校验、Meta Bind 绑定不会生效。
  需要库里已启用 **Fileclass** 插件（id `fileclass`）。
- **`_template/业务模板/xxljob-批任务-pirenwu/`（三份文档模板）**
  插件按模板结构生成文档。**不放模板也能用**：插件会回退到内置结构，但产物结构与主力库不一致。

## 四、首次使用前的设置

设置 → **XXL-Job Flow Atlas**：

| 设置 | 默认 | 说明 |
|---|---|---|
| 文档根目录 | `8.xxljob` | 生成文档放在哪个文件夹下，可改成你库里的任意目录 |
| 重名文档处理 | 跳过 | 重复导入时：跳过 / 更新 frontmatter（保留手写正文）/ 新建副本 |
| 任务流 / 批任务 / 任务组件模板 | 上面三份模板的路径 | 路径不一致就改这里；**留空 = 用内置结构** |
| 执行器清单 | 空 | XML 里只有 `jobGroup` 数字、没有名称。每行 `执行器名称\|分组编号`，如 `通用保险执行器\|1120`；导入时确认过一次会自动回写 |

> 最省事的做法：模板先按默认路径放好，直接导入一个 XML —— 向导会按 jobGroup 询问执行器名，确认后自动记住。

## 五、使用

1. 命令面板执行 **导入 xxl-job 任务 XML**（或点左侧 Ribbon 的上传云图标）。
2. 选择文件 / 目录 → 确认执行器名 → 预览三级树 → 导入。
3. 生成结构：

```
8.xxljob/<执行器>/
├── 任务流/      任务流的当前运行事实
├── 任务/        正文有「# 对应任务流」双链指回任务流
└── 任务组件/     正文有「# 对应批任务」双链指回批任务
```

以「更新」策略重导入时：frontmatter 整体刷新，归属章节同步刷新，其余手写正文原样保留。

## 六、更新插件

用新版本的 `main.js` / `manifest.json` / `styles.css` 覆盖插件目录里的同名文件，重开 Obsidian（或重载插件）即可。

## 七、常见问题

| 现象 | 原因与处理 |
|---|---|
| 生成的文档结构与预期不一致 | 设置里的三个模板路径没对上，或模板文件没放进去。留空即用内置结构 |
| 插件装了但设置页找不到 | 没有完全退出重启 Obsidian；或目录名不是 `xxljob-flow-atlas` |
| 导入时执行器名不对 | 在设置页执行器清单里补 `名称\|分组编号` |
| 这个插件能吃 Oracle 导出的 SQL 吗 | 不能。它只吃 xxl-job 平台导出的 `<linked-list>/<job>` 结构 XML，与数据库 DDL 无关 |
