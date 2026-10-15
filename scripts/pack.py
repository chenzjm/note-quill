#!/usr/bin/env python3
"""打包 xxljob-flow-atlas，交给别人安装。

产出：<out>/xxljob-flow-atlas-v<版本>/ 目录 + 同名 zip（zip 内文件名带 UTF-8 标记，Windows 解压不乱码）。

用法：
    python3 scripts/pack.py                       # 先 npm run build，再打包
    python3 scripts/pack.py --no-build            # 用现有 main.js 打包
    python3 scripts/pack.py --no-assets           # 只打插件三件套，不带模板/字段类
    python3 scripts/pack.py --out ~/Desktop/dist  # 指定输出目录（默认 ./dist，已 gitignore）
    python3 scripts/pack.py --from-vault          # 先把 vault 的模板与字段类刷回仓库 templates/

模板与字段类的事实来源是仓库 templates/（任何机器 / CI 上都能打包）；
主力 vault 是它们的上游，改完之后用 --from-vault 刷回来。vault 路径可用 VAULT_DIR 覆盖。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"]

TPL_DIR = REPO / "templates"
TPL_NAMES = [
    "xxljob-任务流-renwuliu.md",
    "xxljob-批任务-pirenwu.md",
    "xxljob-任务组件-renwuzujian.md",
]
FILECLASS_NAMES = ["任务流.md", "批任务.md", "任务组件.md"]
DIST_TEMPLATE_DIR = "_template/业务模板/xxljob-批任务-pirenwu"

DEFAULT_VAULT = "/Users/chenzhongjun/Desktop/文档编辑器/消金业务合作平台"


def read_manifest() -> dict:
    return json.loads((REPO / "manifest.json").read_text(encoding="utf-8"))


def refresh_from_vault(vault: Path) -> None:
    """把 vault 里现行的模板与字段类定义刷回仓库 templates/（上游 → 仓库）"""
    if not vault.is_dir():
        sys.exit(f"vault 目录不存在：{vault}")
    (TPL_DIR / "fileclasses").mkdir(parents=True, exist_ok=True)
    pairs = [(vault / "_template" / DIST_TEMPLATE_DIR / n, TPL_DIR / n) for n in TPL_NAMES]
    pairs += [(vault / "_fileclasses" / n, TPL_DIR / "fileclasses" / n) for n in FILECLASS_NAMES]
    for src, dst in pairs:
        if not src.is_file():
            sys.exit(f"vault 缺少文件：{src}")
        shutil.copy2(src, dst)
    print(f"已从 vault 刷新 templates/：{len(pairs)} 份")


def collect_plugin(stage: Path) -> None:
    for name in PLUGIN_FILES:
        src = REPO / name
        if not src.is_file():
            sys.exit(f"仓库缺少 {name}（先跑 npm run build，或去掉 --no-build）")
        shutil.copy2(src, stage / name)
    print(f"插件三件套：{', '.join(PLUGIN_FILES)}")


def collect_assets(stage: Path) -> None:
    fdir = stage / "vault-配套文件" / "_fileclasses"
    tdir = stage / "vault-配套文件" / DIST_TEMPLATE_DIR
    fdir.mkdir(parents=True, exist_ok=True)
    tdir.mkdir(parents=True, exist_ok=True)
    missing = []
    for name in FILECLASS_NAMES:
        src = TPL_DIR / "fileclasses" / name
        if src.is_file():
            shutil.copy2(src, fdir / name)
        else:
            missing.append(str(src))
    for name in TPL_NAMES:
        src = TPL_DIR / name
        if src.is_file():
            shutil.copy2(src, tdir / name)
        else:
            missing.append(str(src))
    print(f"vault 配套文件：{len(FILECLASS_NAMES) + len(TPL_NAMES) - len(missing)} 份（来源 templates/）")
    for path in missing:
        print(f"  ! 未找到（已跳过）：{path}")


def collect_note(stage: Path, version: str) -> None:
    src = REPO / "pack" / "install-note.md"
    text = src.read_text(encoding="utf-8").replace("{{VERSION}}", version)
    (stage / "安装说明.md").write_text(text, encoding="utf-8")
    print("安装说明：pack/install-note.md → 安装说明.md")


def make_zip(folder: Path, zip_path: Path) -> None:
    # zipfile 会给非 ASCII 文件名自动置 UTF-8 标志位（0x800），Windows 10+ 解压不乱码
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for path in sorted(folder.rglob("*")):
            z.write(path, path.relative_to(folder.parent))
    print(f"zip：{zip_path}（{zip_path.stat().st_size / 1024:.0f} KB）")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "dist"), help="输出目录，默认 ./dist")
    ap.add_argument("--no-build", action="store_true", help="跳过 npm run build")
    ap.add_argument("--no-assets", action="store_true", help="不打包模板与字段类")
    ap.add_argument("--from-vault", action="store_true", help="先把 vault 的模板与字段类刷回 templates/")
    args = ap.parse_args()

    if args.from_vault:
        refresh_from_vault(Path(os.environ.get("VAULT_DIR", DEFAULT_VAULT)))

    if not args.no_build:
        print("构建中…")
        subprocess.run(["npm", "run", "build"], cwd=REPO, check=True)

    version = read_manifest()["version"]
    folder = Path(args.out) / f"xxljob-flow-atlas-v{version}"
    if folder.exists():
        shutil.rmtree(folder)
    plugin_dir = folder / "xxljob-flow-atlas"
    plugin_dir.mkdir(parents=True)

    collect_plugin(plugin_dir)
    if not args.no_assets:
        collect_assets(folder)
    collect_note(folder, version)
    make_zip(folder, Path(args.out) / f"xxljob-flow-atlas-v{version}.zip")
    print(f"解压目录：{folder}")


if __name__ == "__main__":
    main()
