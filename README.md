# Pocket Trainer

A dog training clicker and coach that runs on a phone, offline.

Live: https://cdub562.github.io/pocket-trainer/ (open in Safari, then Share → Add to Home Screen).

- `index.html` is the app (page body only; it is also published as a claude.ai artifact).
- `pwa/` holds the manifest, service worker and icons (`tools/make_icons.py` redraws the icons).
- `sh build.sh` wraps the app into `docs/`, which GitHub Pages serves. Run it after every change, then commit `docs/`.
