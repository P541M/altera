"""Builds the zip for the Chrome Web Store (or a GitHub release): only the
files the extension runs on, named after the manifest's version.

It refuses to build if the manifest points at a file that wouldn't be in the
zip, and warns if there are uncommitted changes, since those would ship too.

Usage: python tools/package.py   (writes dist/altera-<version>.zip)
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Docs, tools and .github stay out of the package.
RUNTIME = ["manifest.json", "src", "popup", "icons"]


def runtime_files():
    files = []
    for entry in RUNTIME:
        path = ROOT / entry
        if path.is_file():
            files.append(path)
        else:
            files += sorted(f for f in path.rglob("*") if f.is_file() and not f.name.startswith("."))
    return files


def referenced(manifest):
    refs = set(manifest.get("icons", {}).values())
    action = manifest.get("action", {})
    refs |= set(action.get("default_icon", {}).values())
    refs.add(action["default_popup"])
    refs.add(manifest["background"]["service_worker"])
    for entry in manifest.get("content_scripts", []):
        refs |= set(entry.get("js", [])) | set(entry.get("css", []))
    return refs


def uncommitted():
    try:
        out = subprocess.run(["git", "status", "--porcelain", "--", *RUNTIME], cwd=ROOT, capture_output=True, text=True, check=True)
        return out.stdout.rstrip()
    except (OSError, subprocess.CalledProcessError):
        return ""


manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
files = runtime_files()
packed = {f.relative_to(ROOT).as_posix() for f in files}
missing = sorted(referenced(manifest) - packed)
if missing:
    sys.exit("The manifest refers to files that wouldn't be packaged: " + ", ".join(missing))

changes = uncommitted()
if changes:
    print("Warning: these uncommitted changes will be in the zip:\n" + changes + "\n")

out = ROOT / "dist" / f"altera-{manifest['version']}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
    for f in files:
        archive.write(f, f.relative_to(ROOT).as_posix())
print(f"{out.relative_to(ROOT).as_posix()}: {len(files)} files, {out.stat().st_size // 1024} KB")
