"""Offline structural checks for SabatKu's account-information pages, not legal certification."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, unquote, urlsplit

SUPPORT_EMAIL = "aiwerek.tech@gmail.com"


def normalized(text: str) -> str:
    return " ".join(text.split())


class Page(HTMLParser):
    def __init__(self, path: Path):
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.links: list[str] = []
        self.text: list[str] = []
        self.paragraphs: list[str] = []
        self._paragraph: list[str] | None = None
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.duplicate_ids.add(attrs["id"])
            self.ids.add(attrs["id"])
        if tag == "p":
            self._paragraph = []
        if "href" in attrs:
            self.links.append(attrs["href"])
        if "src" in attrs:
            self.links.append(attrs["src"])

    def handle_data(self, data):
        self.text.append(data)
        if self._paragraph is not None:
            self._paragraph.append(data)

    def handle_endtag(self, tag):
        if tag == "p" and self._paragraph is not None:
            self.paragraphs.append(normalized("".join(self._paragraph)))
            self._paragraph = None


def audit(site: Path, android_root: Path | None = None) -> dict:
    site = site.resolve()
    checks = 0

    def require(condition, message):
        nonlocal checks
        if not condition:
            raise ValueError(message)
        checks += 1

    pages = {name: Page(site / name / "index.html") for name in ("privacy", "delete-account")}
    mail_requests = {}
    for name, page in pages.items():
        text = normalized(" ".join(page.text))
        require("SabatKu" in text and "Frengky Lokobal" in text, f"{name}: missing app or developer identity")
        require({"isi", "en"} <= page.ids and not page.duplicate_ids, f"{name}: missing/duplicate language anchors")
        require("kedaluwarsa otomatis" in text and "no automatic expiry" in text, f"{name}: missing marker-retention disclosure")
        for link in page.links:
            url = urlsplit(link)
            if url.scheme == "mailto":
                require(unquote(url.path) == SUPPORT_EMAIL, f"{name}: unexpected mail recipient")
                params = parse_qs(url.query, keep_blank_values=True)
                require(set(params) <= {"subject", "body"} and all(len(values) == 1 for values in params.values()),
                        f"{name}: unexpected or duplicate draft fields")
                require(bool(params.get("subject", [""])[0].strip()), f"{name}: missing email subject")
                if name == "delete-account":
                    require(bool(params.get("body", [""])[0].strip()), f"{name}: missing deletion request body")
                    mail_requests[params["subject"][0]] = params["body"][0]
            elif url.scheme:
                require(url.scheme == "https" and bool(url.hostname) and not url.username,
                        f"{name}: non-HTTPS or credential-bearing external link")
            else:
                target = (site / name / unquote(url.path)).resolve() if url.path else site / name / "index.html"
                if target.is_dir():
                    target /= "index.html"
                require(target.is_relative_to(site) and target.is_file(), f"{name}: missing/outside local link {link}")
                if url.fragment:
                    require(unquote(url.fragment) in Page(target).ids, f"{name}: missing target anchor {link}")

    deletion_text = normalized(" ".join(pages["delete-account"].text))
    require("Tombol hanya menyiapkan draft" in deletion_text and "This only opens a draft" in deletion_text,
            "delete-account: draft opening must not be described as completed deletion")
    require("kepemilikan akun terverifikasi" in deletion_text and "ownership is verified" in deletion_text,
            "delete-account: ownership verification is missing")
    require("kode masuk Google" in deletion_text and "Keep passwords" in deletion_text,
            "delete-account: instructions protecting credentials are missing")
    require(set(mail_requests) == {"Permintaan penghapusan akun SabatKu", "SabatKu account deletion request"},
            "delete-account: both request languages must have distinct subjects")

    if android_root is not None:
        navigation = android_root / "app/src/main/java/id/sabatku/app/navigation"
        privacy = (navigation / "AccountPrivacy.kt").read_text(encoding="utf-8")
        support = (navigation / "DeveloperSupport.kt").read_text(encoding="utf-8")
        require(f'PRIVATE_SUPPORT_EMAIL = "{SUPPORT_EMAIL}"' in support, "Android/web private contacts differ")
        literal = r'"((?:\\.|[^"\\])*)"'
        sections = {json.loads('"' + title + '"'): json.loads('"' + body + '"')
                    for title, body in re.findall(literal + r"\s+to\s+" + literal, privacy)}
        for title in ("Voice services", "Layanan suara", "Deletion markers and provider retention", "Penanda penghapusan dan retensi penyedia"):
            require(title in sections and normalized(sections[title]) in pages["privacy"].paragraphs,
                    f"Android/web policy differs: {title}")
        function = re.search(r"(?ms)^internal fun accountDeletionRequestIntent\b.*?^}", support)
        require(function is not None, "Android deletion email draft factory is missing")
        for field in ("subject", "body"):
            match = re.search(r"val " + field + r"\s*=\s*if\s*\(english\)\s*" + literal + r"\s*else\s*" + literal,
                              function.group(0))
            require(match is not None, f"Android deletion {field} is not readable for parity checking")
            if field == "subject":
                subjects = [json.loads('"' + value + '"') for value in match.groups()]
            else:
                bodies = [json.loads('"' + value + '"') for value in match.groups()]
        require(all(mail_requests.get(subject) == body for subject, body in zip(subjects, bodies)),
                "Android/web deletion request templates differ")
        targets = {}
        for name in ("ACCOUNT_DELETION_REPLY_WORKING_DAYS", "ACCOUNT_DELETION_COMPLETION_WORKING_DAYS"):
            value = re.search(r"const val " + name + r"\s*=\s*([0-9]+)", support)
            require(value is not None and int(value.group(1)) > 0, f"Missing account service target: {name}")
            targets[name] = value.group(1)
        timing = re.search(r"internal fun accountRequestTiming\(english: Boolean\): String =\s*if \(english\)\s*"
                           + literal + r"\s*else\s*" + literal, support)
        require(timing is not None, "Android account service timing text is missing")
        for template in timing.groups():
            expected = json.loads('"' + template + '"')
            for name, value in targets.items():
                expected = expected.replace("$" + name, value)
            for name, page in pages.items():
                require(normalized(expected) in page.paragraphs, f"Android/web service target differs: {name}")

    return {"status": "PASS", "checks": checks, "pages": len(pages),
            "android_parity": "PASS" if android_root is not None else "NOT RUN"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    parser.add_argument("--android-root", type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.site, args.android_root), ensure_ascii=False))
    except (ValueError, OSError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
