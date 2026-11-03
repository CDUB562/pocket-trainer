#!/bin/sh
# Build the installable offline app into docs/ (served by GitHub Pages).
# index.html is the page body (also published as a claude.ai artifact, which adds its own skeleton).
set -e
cd "$(dirname "$0")"
mkdir -p docs
VERSION=$(cat index.html pwa/sw.js pwa/manifest.webmanifest | sha1sum | cut -c1-10)
{
  printf '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '<meta name="theme-color" content="#111613">'
  printf '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-180.png">'
  printf '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  printf '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Trainer">'
  printf '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}</style></head><body>'
  cat index.html
  printf '<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js")});</script>'
  printf '</body></html>\n'
} > docs/index.html
sed "s/__VERSION__/$VERSION/" pwa/sw.js > docs/sw.js
cp pwa/manifest.webmanifest pwa/icon-*.png docs/
touch docs/.nojekyll
echo "built docs/ ($VERSION)"
