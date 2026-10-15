#!/usr/bin/env python3
"""打包 xxljob-flow-atlas，交给别人安装。

产出：<out>/xxljob-flow-atlas-v<版本>/ 目录 + 同名 zip（zip 内文件名带 UTF-8 标记，Windows 解压不乱码）。

用法：
    python3 scripts/pack.py                       # 先 npm run build，再打包
    python3 scripts/pack.py --no-build            # 用现有 main.js 打包
    python3 scripts/pack.py --no-assets           # 只打插件三件套，不带 vault 配套文件
    python3 scripts/pack.py --out ~/Desktop/dist  # 指定输出目录（默认 ./dist，已 gitignore）
    VAULT_DIR=/path/to/vault python3 scripts/pack.py
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
DEFAULT_VAULT = "/Users/chenzhongjun/Desktop/文档编辑器/消金业务合作平台"
TEMPLATE_DIR = "_template/业务模板/xxljob-批任务-pirenwu"
TEMPLATES = [
    "xxljob-任务流-renwuliu.md",
    "xxljob-批任务-pirenwu.md",
    "xxljob-任务组件-renwuzujian.md",
]
FILECLASSES = ["任务流.md", "批任务.md", "任务组件.md"]


def read_manifest() -> dict:
    return json.loads((REPO / "manifest.json").read_text(encoding="utf-8"))


def collect_plugin(stage: Path) -> None:
    for name in PLUGIN_FILES:
        src = REPO / name
        if not src.is_file():
            sys.exit(f"仓库缺少 {name}（先跑 npm run build，或去掉 --no-build）")
        shutil.copy2(src, stage / name)
    print(f"插件三件套：{', '.join(PLUGIN_FILES)}")


def collect_assets(stage: Path, vault: Path) -> None:
    missing = []
    fdir = stage / "vault-配套文件" / "_fileclasses"
    tdir = stage / "vault-配套文件" / TEMPLATE_DIR
    fdir.mkdir(parents=True, exist_ok=True)
    tdir.mkdir(parents=True, exist_ok=True)
    for name in FILECLASSES:
        src = vault / "_fileclasses" / name
        if src.is_file():
            shutil.copy2(src, fdir / name)
        else:
            missing.append(str(src))
    for name in TEMPLATES:
        src = vault / TEMPLATE_DIR / name
        if src.is_file():
            shutil.copy2(src, tdir / name)
        else:
            missing.append(str(src))
    print(f"vault 配套文件：{len(FILECLASSES) + len(TEMPLATES) - len(missing)} 份")
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
    ap.add_argument("--no-assets", action="store_true", help="不打包 vault 配套文件")
    args = ap.parse_args()

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
        vault = Path(os.environ.get("VAULT_DIR", DEFAULT_VAULT))
        if vault.is_dir():
            collect_assets(folder, vault)
        else:
            print(f"! vault 目录不存在，跳过配套文件：{vault}")
    collect_note(folder, version)
    make_zip(folder, Path(args.out) / f"xxljob-flow-atlas-v{version}.zip")
    print(f"解压目录：{folder}")


if __name__ == "__main__":
    main()
