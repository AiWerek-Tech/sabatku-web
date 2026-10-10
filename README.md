# SabatKu Web

Public promotional website for the SabatKu Android app, published with GitHub Pages.

## Website contents

- `site/` — responsive, Indonesian-first static landing page and brand assets.
- `site/library/` — Web reader for the versioned `sabatku-library-v1` static catalog. It validates HTTPS/same-origin paths and chapter size/SHA-256 before displaying text.
- The beta APK for testers is published as a GitHub Release asset and linked from the site's download button; it is not a production Play Store release.
- `site/index.html#pembaruan` — public changelog for the latest beta. Update this section and the download link with each APK release.
- `.github/workflows/pages.yml` — deploys `site/` to GitHub Pages whenever `main` is updated.

## Publish

1. Create a public GitHub repository named `sabatku-web` under `AiWerek-Tech` and push this repository's `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
3. The workflow publishes to `https://aiwerek-tech.github.io/sabatku-web/` after it succeeds.

The page intentionally says SabatKu is being prepared for Google Play Store. Replace that status and add the Play Store link after the app is actually listed. The beta APK is not copied into this website repository.

The book reader uses `https://aiwerek-tech.github.io/sabatku-books/catalog.json` by default. GitHub Pages must be enabled for `sabatku-books`; a preview catalog can be selected with `?catalog=https://.../catalog.json`. Book pages are read online; offline book installation is a later client/package integration step.

The donation estimate uses the USD/IDR reference rate available on 9 October 2026 and is labeled as approximate. Refresh the rupiah estimate if the page is updated later.

## Preview locally

Serve the `site/` directory with any static HTTP server, for example:

```sh
python -m http.server 8000 --directory site
```

Then open `http://localhost:8000`.
