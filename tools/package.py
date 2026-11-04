"""Builds the zips for the Chrome Web Store and addons.mozilla.org (or a GitHub
release): only the files the extension runs on, named after the manifest's
version.

manifest.json is Chrome's, plus Firefox's add-on ID. Firefox doesn't run
extension service workers and Chrome flags a background page as an error, so
each zip gets its own copy: Chrome's without the Firefox settings, Firefox's
with the worker turned into an event page (settings.js first, which the
worker loads with importScripts) and without the Chrome version.

It also writes the Firefox build unpacked to dist/firefox/, for trying a change
in Firefox: load dist/firefox/manifest.json from about:debugging, then run this
again and click Reload after each edit. (Firefox locks a zip it has loaded.)

It refuses to build if a manifest points at a file that wouldn't be packaged,
and warns if there are uncommitted changes, since those would ship too.

Usage: python tools/package.py
       (writes dist/altera-<version>-chrome.zip, dist/altera-<version>-firefox.zip
       and dist/firefox/)
"""
import copy
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Docs, tools and .github stay out of the package.
RUNTIME = ["manifest.json", "src", "popup", "icons"]
# What background.js imports in Chrome; Firefox loads it as a script first.
WORKER_IMPORTS = ["src/shared/settings.js"]


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
    background = manifest["background"]
    refs |= set(background.get("scripts", []))
    if "service_worker" in background:
        refs.add(background["service_worker"])
    for entry in manifest.get("content_scripts", []):
        refs |= set(entry.get("js", [])) | set(entry.get("css", []))
    return refs


def for_chrome(manifest):
    out = copy.deepcopy(manifest)
    out.pop("browser_specific_settings", None)
    return out


def for_firefox(manifest):
    out = copy.deepcopy(manifest)
    out.pop("minimum_chrome_version", None)
    out["background"] = {"scripts": WORKER_IMPORTS + [manifest["background"]["service_worker"]]}
    return out


def manifest_text(manifest):
    return json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"


def uncommitted():
    try:
        out = subprocess.run(["git", "status", "--porcelain", "--", *RUNTIME], cwd=ROOT, capture_output=True, text=True, check=True)
        return out.stdout.rstrip()
    except (OSError, subprocess.CalledProcessError):
        return ""


manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
files = runtime_files()
packed = {f.relative_to(ROOT).as_posix() for f in files}
builds = {"chrome": for_chrome(manifest), "firefox": for_firefox(manifest)}
for browser, trimmed in builds.items():
    missing = sorted(referenced(trimmed) - packed)
    if missing:
        sys.exit(f"The {browser} manifest refers to files that wouldn't be packaged: " + ", ".join(missing))

changes = uncommitted()
if changes:
    print("Warning: these uncommitted changes will be in the builds:\n" + changes + "\n")

(ROOT / "dist").mkdir(exist_ok=True)
for browser, trimmed in builds.items():
    out = ROOT / "dist" / f"altera-{manifest['version']}-{browser}.zip"
    try:
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
            for f in files:
                name = f.relative_to(ROOT).as_posix()
                if name == "manifest.json":
                    archive.writestr(name, manifest_text(trimmed))
                else:
                    archive.write(f, name)
    except OSError as error:
        sys.exit(f"Couldn't write {out.name} ({error.strerror}). If Firefox has it loaded, remove it in about:debugging first.")
    print(f"{out.relative_to(ROOT).as_posix()}: {len(files)} files, {out.stat().st_size // 1024} KB")

unpacked = ROOT / "dist" / "firefox"
shutil.rmtree(unpacked, ignore_errors=True)
for f in files:
    target = unpacked / f.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(f, target)
(unpacked / "manifest.json").write_text(manifest_text(builds["firefox"]), encoding="utf-8", newline="\n")
print(f"{unpacked.relative_to(ROOT).as_posix()}/: the Firefox build, unpacked")
