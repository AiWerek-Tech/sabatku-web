#!/usr/bin/env python3
"""Unit tests for tools/check_release_notes.py."""

from __future__ import annotations

import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

TOOLS_DIR = Path(__file__).resolve().parent
WEB_ROOT = TOOLS_DIR.parent
ANDROID_ROOT = WEB_ROOT.parent / "sabatku-android"

if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import check_release_notes as crn


class ReleaseNotesCheckTests(unittest.TestCase):
    def test_real_web_and_android_repos_pass(self) -> None:
        errors = crn.check_release_notes(
            WEB_ROOT,
            ANDROID_ROOT if ANDROID_ROOT.is_dir() else None,
        )
        self.assertEqual([], errors)

    def _copy_minimal_fixture(self, tmp: Path) -> tuple[Path, Path]:
        web_dir = tmp / "web"
        android_dir = tmp / "android"
        (web_dir / "site").mkdir(parents=True)
        shutil.copy2(WEB_ROOT / "site" / "releases.json", web_dir / "site" / "releases.json")
        shutil.copy2(WEB_ROOT / "site" / "index.html", web_dir / "site" / "index.html")
        (android_dir / "app" / "src" / "main" / "java" / "id" / "sabatku" / "app" / "update").mkdir(parents=True)
        shutil.copy2(ANDROID_ROOT / "app" / "build.gradle.kts", android_dir / "app" / "build.gradle.kts")
        shutil.copy2(
            ANDROID_ROOT / "app" / "src" / "main" / "java" / "id" / "sabatku" / "app" / "update" / "AppReleaseNotes.kt",
            android_dir / "app" / "src" / "main" / "java" / "id" / "sabatku" / "app" / "update" / "AppReleaseNotes.kt",
        )
        return web_dir, android_dir

    def test_rejects_apk_link_or_untrusted_host(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            web_dir, _ = self._copy_minimal_fixture(Path(td))
            payload = json.loads((web_dir / "site" / "releases.json").read_text(encoding="utf-8"))
            payload["releases"][0]["url"] = "https://github.com/AiWerek-Tech/sabatku-web/releases/download/v1.0.2/sabatku.apk"
            (web_dir / "site" / "releases.json").write_text(json.dumps(payload), encoding="utf-8")

            errors = crn.check_release_notes(web_dir)
            self.assertTrue(any("untrusted or APK" in e for e in errors), errors)

    def test_rejects_mismatched_android_default_version(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            web_dir, android_dir = self._copy_minimal_fixture(Path(td))
            gradle_path = android_dir / "app" / "build.gradle.kts"
            gradle_text = gradle_path.read_text(encoding="utf-8").replace('.orElse("1.0.4")', '.orElse("0.1.0-beta17")')
            gradle_path.write_text(gradle_text, encoding="utf-8")

            errors = crn.check_release_notes(web_dir, android_dir)
            self.assertTrue(any("conflicts with releases.json" in e for e in errors), errors)

    def test_allows_future_1_0_5_on_web_while_android_default_is_1_0_4(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            web_dir, android_dir = self._copy_minimal_fixture(Path(td))
            payload = json.loads((web_dir / "site" / "releases.json").read_text(encoding="utf-8"))
            future = copy.deepcopy(payload["releases"][0])
            future["versionName"] = "1.0.5"
            future["versionCode"] = 27
            future["date"] = "2026-12-05"
            payload["latestVersion"] = "1.0.5"
            payload["latestVersionCode"] = 27
            payload["releases"].insert(0, future)
            (web_dir / "site" / "releases.json").write_text(json.dumps(payload), encoding="utf-8")

            html_path = web_dir / "site" / "index.html"
            html = html_path.read_text(encoding="utf-8")
            html = html.replace(
                '<article class="changelog-card" data-version-code="26">',
                '<article class="changelog-card" data-version-code="27">1.0.5</article>\n<article class="changelog-card" data-version-code="26">',
            )
            html_path.write_text(html, encoding="utf-8")

            errors = crn.check_release_notes(web_dir, android_dir)
            self.assertEqual([], errors)


if __name__ == "__main__":
    unittest.main()
