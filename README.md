# Note Quill

> [!WARNING]
> 占位项目名：`note-quill` / `Note Quill` 仅为脚手架占位，正式开发前请同步修改
> `manifest.json` 的 `id` / `name`、`package.json` 的 `name`，以及运行期插件目录名（须与 id 一致）。
> 插件 `id` 上架后不可更改，请尽早定名。id 规范：仅小写字母 + 连字符，不能含 `obsidian`，不能以 `plugin` 结尾。

An Obsidian plugin scaffold based on the official `obsidian-sample-plugin` template,
bundled with esbuild into a single CJS `main.js`.

## Development

```bash
npm install     # install dependencies
npm run dev     # esbuild watch mode -> main.js
npm run build   # type check + production bundle
npm run lint    # eslint with eslint-plugin-obsidianmd (covers most review rules)
npm version x.y.z   # bump manifest.json / package.json / versions.json
```

### Local debugging (dev vault)

This repo is symlinked into the local dev vault:

```
/Users/chenzhongjun/WorkBuddy/obsidian/dev-vault/.obsidian/plugins/note-quill  ->  this repo
```

1. Open `dev-vault` in Obsidian ("Open folder as vault").
2. Settings -> Community plugins -> turn off Restricted mode -> enable **Note Quill**.
3. With `npm run dev` running, code changes rebuild automatically; use the
   Hot-Reload plugin (or "Reload app without saving") to see changes instantly.

### Deployment rules (from the research notes)

- User-built paths must go through `normalizePath()`.
- Node/Electron APIs require `"isDesktopOnly": true` in `manifest.json`.
- Use `createEl()` / `el.empty()` instead of `innerHTML`.
- Register everything in `onload()` via `register*`; never detach leaves in `onunload()`.
- No default command hotkeys; command IDs must not contain the plugin ID.
- Remove scaffold/sample code before submitting.

## Release

1. `npm version 1.0.0` (bumps manifest/package/versions.json).
2. `git tag -a 1.0.0 -m "1.0.0" && git push origin 1.0.0`.
3. GitHub Actions builds and creates a draft release with
   `main.js` / `manifest.json` / `styles.css` (tag **must** equal manifest `version`, no `v` prefix).
4. Publish the release, then submit via <https://community.obsidian.md>.

## License

[MIT](LICENSE)
