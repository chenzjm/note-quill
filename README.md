# Note Quill

> [!WARNING]
> 占位项目名：`note-quill` / `Note Quill` 仅为脚手架占位，正式开发前请同步修改
> `manifest.json` 的 `id` / `name`、`package.json` 的 `name`，以及运行期插件目录名（须与 id 一致）。
> 插件 `id` 上架后不可更改，请尽早定名。id 规范：仅小写字母 + 连字符，不能含 `obsidian`，不能以 `plugin` 结尾。

一个基于官方 `obsidian-sample-plugin` 模板约定的 Obsidian 插件脚手架，
使用 esbuild 打包为单个 CJS `main.js`。

## 开发

```bash
npm install         # 安装依赖
npm run dev         # esbuild watch 模式 -> 生成 main.js
npm run build       # 类型检查 + 生产构建
npm run lint        # eslint（含 eslint-plugin-obsidianmd，覆盖大部分上架审核规则）
npm version x.y.z   # 同步更新 manifest.json / package.json / versions.json
```

### 本地调试（dev vault）

本仓库已软链到本地独立开发库：

```
/Users/chenzhongjun/WorkBuddy/obsidian/dev-vault/.obsidian/plugins/note-quill  ->  本项目
```

1. 在 Obsidian 中「打开文件夹作为仓库」→ 选择 `dev-vault`。
2. 设置 → 第三方插件 → 关闭受限模式 → 启用 **Note Quill**。
3. 保持 `npm run dev` 运行，代码修改会自动重新构建；
   用 Hot-Reload 插件（或命令面板「Reload app without saving」）即可即时生效。

### 开发红线（来自调研笔记）

- 用户输入或拼接的路径必须过 `normalizePath()`。
- 用到 Node / Electron API 时，`manifest.json` 必须设 `"isDesktopOnly": true`。
- 用 `createEl()` / `el.empty()` 代替 `innerHTML`。
- 所有注册都放在 `onload()` 并使用 `register*` 系列；`onunload()` 中不要 detach leaves。
- 命令不要设默认快捷键；命令 ID 不要包含插件 ID。
- 提交上架前删除脚手架 / 示例代码。

## 发布

1. `npm version 1.0.0`（同步更新 manifest/package/versions.json）。
2. `git tag -a 1.0.0 -m "1.0.0" && git push origin 1.0.0`。
3. GitHub Actions 自动构建并创建 draft release，附
   `main.js` / `manifest.json` / `styles.css`（tag **必须**与 manifest `version` 完全一致，无 `v` 前缀）。
4. 发布 release 后，在 <https://community.obsidian.md> 提交上架。

## 许可证

[MIT](LICENSE)
