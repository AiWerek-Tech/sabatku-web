# SabatKu Web

Public promotional website for the SabatKu Android app, published with GitHub Pages.

## Website contents

- `site/` — responsive, Indonesian-first static landing page and brand assets.
- `site/library/` — Web reader for the versioned `sabatku-library-v1` static catalog. It validates HTTPS/same-origin paths and chapter size/SHA-256 before displaying text.
- `site/privacy/` and `site/delete-account/` — Indonesian and English pages for the Android privacy policy and email requests to delete a SabatKu account.
- Android installation and updates link to the Google Play internal test. Prospective testers contact the SabatKu WhatsApp group for an invitation.
- `site/index.html#pembaruan` & `site/releases.json` — public changelog and bilingual machine-readable release feed consumed by the Android app (`What's new in SabatKu`) and progressively rendered on SabatKu Web.
- `.github/workflows/pages.yml` — deploys `site/` to GitHub Pages whenever `main` is updated.

## Publish

1. Create a public GitHub repository named `sabatku-web` under `AiWerek-Tech` and push this repository's `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
3. The workflow publishes to `https://aiwerek-tech.github.io/sabatku-web/` after it succeeds.

Keep the active track and version current in the homepage and the testing instructions. Switch the download buttons to the public Play listing after production rollout.

The book reader uses `https://aiwerek-tech.github.io/sabatku-books/catalog.json` by default. GitHub Pages must be enabled for `sabatku-books`; a preview catalog can be selected with `?catalog=https://.../catalog.json`. Book pages are read online; offline book installation is a later client/package integration step.

## Privacy and account deletion

Use these URLs in the corresponding Play Console fields after the pages are live:

- Privacy policy: `https://aiwerek-tech.github.io/sabatku-web/privacy/`
- Account deletion: `https://aiwerek-tech.github.io/sabatku-web/delete-account/`

The deletion page opens an email draft addressed to the project's documented Firebase support mailbox, `aiwerek.tech@gmail.com`. It also displays the address for people who use webmail. Confirm that the inbox is monitored and exercise the full request workflow on a designated test account before using the link in Play Console.

The operator should verify account ownership through a challenge sent to the verified email from the Firebase Authentication record. A sender address or a name on its own is insufficient. If the registered inbox is unavailable, use another independently verified proof of ownership before acting. Do not request Google sign-in codes, passwords, private study content, or backups. Keep the request and any reply private.

After verification, use the corresponding Firebase UID to carry out the same order as the Android deletion flow. Create or preserve `users/{uid}/account/deletion` with `startedAt` set to the server timestamp to block client uploads, delete `users/{uid}/studyData` documents and `users/{uid}/profile/main`, and then delete the matching Firebase Authentication user. Verify the target UID and completed deletions before confirming by email. Leave the deletion marker in place for the purpose explained in the privacy policy. Preserve the marker and resume incomplete work if an operation fails. The web path handles server data, and the page explains how users can manage copies stored on their devices.

See [the deletion operations runbook](docs/account-deletion-operations.md) for verification, recovery and acceptance evidence. The owner set a response target of 2 business days from receipt and completion within 7 business days after ownership verification. Inbox monitoring, support-email retention and a completed test-account exercise still need operational verification.

Check the account pages offline before publishing:

```powershell
python tools/check_account_pages.py --android-root ../sabatku-android
python tools/check_release_notes.py --android-root ../sabatku-android
python -m unittest discover -s tools -p "test_*.py" -v
```

Without `--android-root`, the checker validates the website and reports Android parity as `NOT RUN`. These checks do not send email, delete an account, deploy the website or certify policy compliance.

## Preview locally

Serve the `site/` directory with any static HTTP server, for example:

```sh
python -m http.server 8000 --directory site
```

Then open `http://localhost:8000`.

## Book reader tools

The book reader provides local paper themes, font size, line spacing, alignment,
native browser text selection, range highlights and notes. Notes and reading
appearance are saved in this browser's local storage; they are not synchronized
to the Android account or Firestore. Revised source text is checked against the
saved text snapshot before a highlight is painted.

Markdown tables scroll inside their own frame. Inline formatting, footnotes and
Bible references retain their actions. The Bible dialog opens the installed
SabatKu Android app through `sabatku://bible`; the website does not host Bible
verse text. External provider readers keep their provider's capabilities.

The 28 October 2026 reader audit checked 390×844, 844×390 and 1280×800 browser
viewports, paper preferences, exact-word highlighting, persistence after reload
and the Bible reference dialog. This does not replace Android device testing.
