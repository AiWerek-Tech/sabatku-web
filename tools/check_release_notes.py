#!/usr/bin/env python3
"""Validate SabatKu Web release notes JSON, HTML changelog, and Android parity."""

from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse


VALID_TRACKS = {
    "play-internal",
    "play-production",
    "github-release",
    "github-beta",
    "retrospective",
}

CHANGELOG_CARD_RE = re.compile(
    r'<article\s+class="changelog-card"[^>]*data-version-code="(\d+)"',
    re.IGNORECASE,
)
ANDROID_VERSION_CODE_RE = re.compile(
    r'gradleProperty\("sabatku\.versionCode"\).*?\.orElse\((\d+)\)',
    re.DOTALL,
)
ANDROID_VERSION_NAME_RE = re.compile(
    r'gradleProperty\("sabatku\.versionName"\)\.orElse\("([^"]+)"\)',
)
ANDROID_ENTRY_RE = re.compile(
    r'AppReleaseEntry\(\s*versionName\s*=\s*"([^"]+)"\s*,\s*versionCode\s*=\s*(\d+)',
    re.DOTALL,
)


def is_trusted_web_url(raw: str | None) -> bool:
    if raw is None:
        return True
    candidate = raw.strip()
    if not candidate:
        return False
    parsed = urlparse(candidate)
    if parsed.scheme.lower() != "https" or parsed.username or parsed.password:
        return False
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    if path.lower().endswith(".apk"):
        return False
    if host == "aiwerek-tech.github.io":
        return path == "/sabatku-web" or path.startswith("/sabatku-web/")
    if host == "github.com":
        return path.startswith("/AiWerek-Tech/sabatku-web")
    if host == "play.google.com":
        return path.startswith("/apps/internaltest/") or path.startswith("/store/apps/")
    return False


def validate_releases_json(releases_path: Path) -> tuple[list[str], dict | None]:
    errors: list[str] = []
    if not releases_path.is_file():
        return [f"Missing releases feed: {releases_path}"], None

    try:
        data = json.loads(releases_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"Invalid JSON in {releases_path}: {exc}"], None

    if not isinstance(data, dict):
        return [f"Expected JSON object in {releases_path}"], None

    if data.get("schemaVersion") != 1:
        errors.append(f"Unsupported schemaVersion={data.get('schemaVersion')!r} (expected 1)")

    latest_version = data.get("latestVersion")
    latest_code = data.get("latestVersionCode")
    if not isinstance(latest_version, str) or not latest_version.strip():
        errors.append("latestVersion must be a non-empty string")
    if not isinstance(latest_code, int) or isinstance(latest_code, bool) or latest_code <= 0:
        errors.append("latestVersionCode must be a positive integer")

    for url_key in ("webChangelogUrl", "playTestingUrl"):
        val = data.get(url_key)
        if url_key == "webChangelogUrl" and not val:
            errors.append("webChangelogUrl is required")
        elif val is not None and (not isinstance(val, str) or not is_trusted_web_url(val)):
            errors.append(f"Untrusted or invalid URL for {url_key}: {val!r}")

    releases = data.get("releases")
    if not isinstance(releases, list) or not releases:
        errors.append("releases must be a non-empty array")
        return errors, data

    seen_codes: set[int] = set()
    seen_names: set[str] = set()
    previous_code: int | None = None

    for idx, entry in enumerate(releases):
        if not isinstance(entry, dict):
            errors.append(f"releases[{idx}] must be an object")
            continue
        vname = entry.get("versionName")
        vcode = entry.get("versionCode")
        if not isinstance(vname, str) or not vname.strip():
            errors.append(f"releases[{idx}].versionName must be non-empty")
            continue
        if not isinstance(vcode, int) or isinstance(vcode, bool) or vcode <= 0:
            errors.append(f"releases[{idx}] ({vname}).versionCode must be a positive int")
            continue
        if vcode in seen_codes:
            errors.append(f"Duplicate versionCode {vcode} at releases[{idx}]")
        if vname in seen_names:
            errors.append(f"Duplicate versionName {vname} at releases[{idx}]")
        if previous_code is not None and vcode >= previous_code:
            errors.append(f"Releases must be strictly descending by versionCode ({vcode} after {previous_code})")
        seen_codes.add(vcode)
        seen_names.add(vname)
        previous_code = vcode

        iso_date = entry.get("date")
        if not isinstance(iso_date, str):
            errors.append(f"{vname}: missing ISO date")
        else:
            try:
                date.fromisoformat(iso_date)
            except ValueError:
                errors.append(f"{vname}: invalid ISO date {iso_date!r}")

        track = entry.get("track")
        if track not in VALID_TRACKS:
            errors.append(f"{vname}: unsupported track {track!r}")

        for text_key in ("headlineId", "headlineEn"):
            val = entry.get(text_key)
            if not isinstance(val, str) or not val.strip():
                errors.append(f"{vname}: {text_key} must be non-empty")

        for list_key in ("notesId", "notesEn"):
            notes = entry.get(list_key)
            if not isinstance(notes, list) or not notes or not all(isinstance(n, str) and n.strip() for n in notes):
                errors.append(f"{vname}: {list_key} must be a non-empty list of strings")

        entry_url = entry.get("url")
        if entry_url is not None and (not isinstance(entry_url, str) or not is_trusted_web_url(entry_url)):
            errors.append(f"{vname}: untrusted or APK url {entry_url!r}")

    top = releases[0] if isinstance(releases[0], dict) else {}
    if isinstance(latest_version, str) and top.get("versionName") != latest_version:
        errors.append(f"Top release versionName {top.get('versionName')!r} != latestVersion {latest_version!r}")
    if isinstance(latest_code, int) and top.get("versionCode") != latest_code:
        errors.append(f"Top release versionCode {top.get('versionCode')!r} != latestVersionCode {latest_code!r}")

    for required_name in ("1.0.2", "1.0.1", "1.0.0", "0.1.0-beta17", "0.1.0-beta01"):
        if required_name not in seen_names:
            errors.append(f"Missing expected release {required_name} in releases.json")

    return errors, data


def validate_index_html(index_path: Path, data: dict) -> list[str]:
    errors: list[str] = []
    if not index_path.is_file():
        return [f"Missing web landing page: {index_path}"]

    html = index_path.read_text(encoding="utf-8")
    if 'id="pembaruan"' not in html:
        errors.append("site/index.html is missing #pembaruan changelog section")
    if '<details class="release-archive">' not in html:
        errors.append("site/index.html should keep legacy beta notes grouped inside <details class=\"release-archive\">")

    latest_version = data.get("latestVersion", "")
    latest_code = data.get("latestVersionCode")
    card_codes = [int(m.group(1)) for m in CHANGELOG_CARD_RE.finditer(html)]
    if not card_codes:
        errors.append("site/index.html has no .changelog-card element with data-version-code")
    elif latest_code not in card_codes:
        errors.append(f"site/index.html changelog cards {card_codes} do not include latestVersionCode={latest_code}")

    if latest_version and latest_version not in html:
        errors.append(f"site/index.html does not mention latestVersion {latest_version}")

    for entry in data.get("releases", []):
        vname = entry.get("versionName", "")
        track = entry.get("track", "")
        if track in ("play-internal", "play-production", "github-release") and vname not in html:
            errors.append(f"site/index.html is missing active release {vname}")

    return errors


def validate_android_parity(android_root: Path, data: dict) -> list[str]:
    errors: list[str] = []
    gradle_file = android_root / "app" / "build.gradle.kts"
    catalog_file = android_root / "app" / "src" / "main" / "java" / "id" / "sabatku" / "app" / "update" / "AppReleaseNotes.kt"

    if not gradle_file.is_file():
        return [f"Missing Android build.gradle.kts: {gradle_file}"]
    if not catalog_file.is_file():
        return [f"Missing Android AppReleaseNotes.kt: {catalog_file}"]

    gradle_text = gradle_file.read_text(encoding="utf-8")
    code_match = ANDROID_VERSION_CODE_RE.search(gradle_text)
    name_match = ANDROID_VERSION_NAME_RE.search(gradle_text)
    if not code_match or not name_match:
        errors.append("Could not parse default versionCode/versionName from Android build.gradle.kts")
        return errors

    android_code = int(code_match.group(1))
    android_name = name_match.group(1)
    by_code = {r["versionCode"]: r for r in data.get("releases", []) if isinstance(r, dict) and "versionCode" in r}

    if android_code not in by_code:
        errors.append(f"Android default versionCode={android_code} is missing from sabatku-web releases.json")
    elif by_code[android_code].get("versionName") != android_name:
        errors.append(
            f"Android default versionName={android_name!r} conflicts with releases.json {by_code[android_code].get('versionName')!r} for versionCode={android_code}"
        )

    latest_code = data.get("latestVersionCode", 0)
    if android_code > latest_code:
        errors.append(
            f"Android default versionCode={android_code} ({android_name}) is ahead of sabatku-web latestVersionCode={latest_code}"
        )

    catalog_text = catalog_file.read_text(encoding="utf-8")
    if "https://aiwerek-tech.github.io/sabatku-web/releases.json" not in catalog_text:
        errors.append("Android AppReleaseNotes.kt is missing SabatKu Web releases.json URL")

    bundled_entries = [(m.group(1), int(m.group(2))) for m in ANDROID_ENTRY_RE.finditer(catalog_text)]
    if not bundled_entries:
        errors.append("No bundled AppReleaseEntry definitions found in AppReleaseNotes.kt")
    for vname, vcode in bundled_entries:
        web_entry = by_code.get(vcode)
        if not web_entry:
            errors.append(f"Android bundled release {vname} ({vcode}) missing from releases.json")
        elif web_entry.get("versionName") != vname:
            errors.append(f"Android bundled release {vname} ({vcode}) mismatches web {web_entry.get('versionName')}")

    return errors


def check_release_notes(web_root: Path, android_root: Path | None = None) -> list[str]:
    releases_path = web_root / "site" / "releases.json"
    index_path = web_root / "site" / "index.html"
    errors, data = validate_releases_json(releases_path)
    if data is not None:
        errors.extend(validate_index_html(index_path, data))
        if android_root is not None:
            errors.extend(validate_android_parity(android_root, data))
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate SabatKu Web release notes and Android parity.")
    parser.add_argument(
        "--web-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the sabatku-web repository root.",
    )
    parser.add_argument(
        "--android-root",
        type=Path,
        default=None,
        help="Optional path to the sabatku-android repository root for parity validation.",
    )
    args = parser.parse_args(argv)

    errors = check_release_notes(args.web_root.resolve(), args.android_root.resolve() if args.android_root else None)
    if errors:
        for err in errors:
            print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    print("[OK] SabatKu Web releases.json, index.html, and parity checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
