from pathlib import Path
import tempfile
import unittest

from check_account_pages import audit


class AccountPageChecksTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sabatku-privacy-test-")
        root = Path(self.temporary.name).resolve()
        temporary_root = Path(tempfile.gettempdir()).resolve()
        self.assertTrue(root != temporary_root and root.is_relative_to(temporary_root)
                        and root.name.startswith("sabatku-privacy-test-"))
        self.addCleanup(self.temporary.cleanup)
        self.site = root / "site"
        source = Path(__file__).resolve().parents[1] / "site"
        for name in ("privacy", "delete-account"):
            destination = self.site / name / "index.html"
            destination.parent.mkdir(parents=True)
            destination.write_text((source / name / "index.html").read_text(encoding="utf-8"), encoding="utf-8")
        # The checker validates local destinations, not artwork or CSS rendering.
        for relative in ("index.html", "styles.css", "account-info.css", "assets/sabatku-symbol.png"):
            destination = self.site / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("", encoding="utf-8")
        self.android = root / "android"
        navigation = Path("app/src/main/java/id/sabatku/app/navigation")
        actual_android = source.parents[1] / "sabatku-android"
        for name in ("AccountPrivacy.kt", "DeveloperSupport.kt"):
            destination = self.android / navigation / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text((actual_android / navigation / name).read_text(encoding="utf-8"), encoding="utf-8")

    def replace(self, relative, old, new):
        path = self.site / relative
        text = path.read_text(encoding="utf-8")
        self.assertIn(old, text)
        path.write_text(text.replace(old, new), encoding="utf-8")

    def test_current_pages_and_android_templates_agree(self):
        self.assertEqual("PASS", audit(self.site, self.android)["android_parity"])

    def test_wrong_email_recipient_is_rejected(self):
        self.replace("privacy/index.html", "mailto:aiwerek.tech@gmail.com", "mailto:wrong@example.org")
        with self.assertRaisesRegex(ValueError, "recipient"):
            audit(self.site)

    def test_hidden_copy_recipient_is_rejected(self):
        self.replace("privacy/index.html", 'subject=Pertanyaan%20privasi%20SabatKu"',
                     'subject=Pertanyaan%20privasi%20SabatKu&amp;bcc=wrong@example.org"')
        with self.assertRaisesRegex(ValueError, "draft fields"):
            audit(self.site)

    def test_broken_local_destination_is_rejected(self):
        self.replace("delete-account/index.html", 'href="../privacy/"', 'href="../missing/"')
        with self.assertRaisesRegex(ValueError, "local link"):
            audit(self.site)

    def test_missing_retention_disclosure_is_rejected(self):
        self.replace("privacy/index.html", "no automatic expiry", "an unspecified expiry")
        with self.assertRaisesRegex(ValueError, "retention"):
            audit(self.site)

    def test_non_https_external_link_is_rejected(self):
        self.replace("privacy/index.html", "https://firebase.google.com", "http://firebase.google.com")
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            audit(self.site)

    def test_duplicate_language_anchor_is_rejected(self):
        self.replace("privacy/index.html", 'id="en"', 'id="isi"')
        with self.assertRaisesRegex(ValueError, "anchors"):
            audit(self.site)

    def test_changed_deletion_template_is_detected(self):
        self.replace("delete-account/index.html", "body=Please%20delete", "body=Please%20change")
        with self.assertRaisesRegex(ValueError, "templates differ"):
            audit(self.site, self.android)

    def test_changed_android_voice_policy_is_detected(self):
        path = self.android / "app/src/main/java/id/sabatku/app/navigation/AccountPrivacy.kt"
        text = path.read_text(encoding="utf-8")
        path.write_text(text.replace("Reminder playback requires an installed offline voice.", "Missing disclosure."), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Voice services"):
            audit(self.site, self.android)

    def test_changed_service_deadline_is_detected(self):
        self.replace("delete-account/index.html", "within 7 business days", "within 8 business days")
        with self.assertRaisesRegex(ValueError, "service target differs"):
            audit(self.site, self.android)


if __name__ == "__main__":
    unittest.main()
