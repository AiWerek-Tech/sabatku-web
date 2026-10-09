# SabatKu Web

Public promotional website for the SabatKu Android app, published with GitHub Pages.

## Website contents

- `site/` — responsive, Indonesian-first static landing page and brand assets.
- `.github/workflows/pages.yml` — deploys `site/` to GitHub Pages whenever `main` is updated.

## Publish

1. Create a public GitHub repository named `sabatku-web` under `AiWerek-Tech` and push this repository's `main` branch.
2. In **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
3. The workflow publishes to `https://aiwerek-tech.github.io/sabatku-web/` after it succeeds.

The page intentionally says SabatKu is being prepared for Google Play Store. Replace that status and add the Play Store link after the app is actually listed. The beta APK is not copied into this website repository.

The donation estimate uses the USD/IDR reference rate available on 9 October 2026 and is labeled as approximate. Refresh the rupiah estimate if the page is updated later.

## Preview locally

Serve the `site/` directory with any static HTTP server, for example:

```sh
python -m http.server 8000 --directory site
```

Then open `http://localhost:8000`.
