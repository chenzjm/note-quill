#!/usr/bin/env bash
# 在插件仓库与 Obsidian vault 部署目录之间同步插件文件
#
# 用法：
#   ./sync.sh to-vault             仓库 → vault（部署到 Obsidian，改完记得重载）
#   ./sync.sh from-vault           vault → 仓库（把 vault 里现场改的文件收回仓库）
#   ./sync.sh deploy "提交说明"     构建 → 部署到 vault → 提交 → 推送
#
# vault 路径可用环境变量覆盖：VAULT_DIR=/path/to/plugin ./sync.sh to-vault
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT="${VAULT_DIR:-/Users/chenzhongjun/Desktop/文档编辑器/消金业务合作平台/.obsidian/plugins/xxljob-flow-atlas}"
FILES=(main.js manifest.json styles.css)

if [ ! -d "$VAULT" ]; then
  echo "找不到 vault 插件目录：$VAULT" >&2
  exit 1
fi

deploy_to_vault() {
  for f in "${FILES[@]}"; do
    [ -f "$REPO/$f" ] || { echo "仓库缺少文件：$f（先 npm run build）" >&2; exit 1; }
    cp "$REPO/$f" "$VAULT/$f"
  done
  # Hot Reload 靠 .hotreload 标记决定是否监听本插件；标记丢了会静默失效，这里兜底重建
  touch "$VAULT/.hotreload"
}

case "${1:-}" in
  to-vault)
    deploy_to_vault
    echo "已部署到 vault：$VAULT"
    ;;
  from-vault)
    for f in "${FILES[@]}"; do
      [ -f "$VAULT/$f" ] || { echo "vault 缺少文件：$f" >&2; exit 1; }
      cp "$VAULT/$f" "$REPO/$f"
    done
    echo "已从 vault 收回到仓库：$REPO"
    echo "提示：检查 git diff 后提交。"
    ;;
  deploy)
    msg="${2:-}"
    if [ -z "$msg" ]; then
      echo '用法: ./sync.sh deploy "提交说明"' >&2
      exit 1
    fi
    cd "$REPO"
    echo "构建中…"
    npm run build >/dev/null
    deploy_to_vault
    echo "已部署到 vault：$VAULT"
    git add -A
    git commit -m "$msg"
    git push
    echo "已提交并推送"
    ;;
  *)
    echo "用法: ./sync.sh to-vault | from-vault | deploy \"提交说明\"" >&2
    exit 1
    ;;
esac
