# Pocket Trainer

A dog training clicker and coach that runs on a phone, offline.

Live: https://cdub562.github.io/pocket-trainer/ (open in Safari, then Share → Add to Home Screen).

- `src/page.html` (markup and styles), `src/catalog.js` (skills, socialization passport, breeds) and `src/app.js` (the app) are the source.
- `sh build.sh` stitches them into `index.html` (the page body, also published as a claude.ai artifact) and wraps that into `docs/`, which GitHub Pages serves. Run it after every change, then commit.
- `pwa/` holds the manifest, service worker and icons (`tools/make_icons.py` redraws the icons).
- `ios/` is the native iPhone app (see `ios/README.md`); `node tools/gen_catalog.js` regenerates its skill list from `src/catalog.js`.
- Design: https://claude.ai/artifact/HFQ6rHgZxNJaj7EvHERUXo (v2 training system). Phase 1 is in the web app: dog profiles, mastery levels, proofing grid, planner with places and the week, spaced reviews, block sessions with undo, puppy passport and potty plan, 29 skills.
