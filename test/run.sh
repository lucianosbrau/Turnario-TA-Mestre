#!/bin/sh
# Esegue tutte le suite di collaudo del Turnario TA.
# Prerequisiti: node >= 18, esbuild e jsdom (npm i -D esbuild jsdom, oppure globali).
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export TURNARIO_REPO="$REPO"
BUNDLE="${APP_BUNDLE:-/tmp/turnario-app-bundle.js}"
SYNC="${SYNC_BUNDLE:-/tmp/turnario-sync-bundle.mjs}"
export SYNC_BUNDLE="$SYNC"
export APP_BUNDLE="$BUNDLE"

if [ -x "$REPO/node_modules/.bin/esbuild" ]; then ESB="$REPO/node_modules/.bin/esbuild";
elif [ -n "$ESBUILD_BIN" ]; then ESB="$ESBUILD_BIN";
else ESB="esbuild"; fi

echo "== build bundle"
"$ESB" "$REPO/js/main.js" --bundle --outfile="$BUNDLE" --format=iife || exit 1
"$ESB" "$REPO/js/sync.js" --bundle --format=esm --outfile="$SYNC" || exit 1

FAIL=0
for t in reg-v017 reg-seed-safe reg-push-normale reg-storico reg-cancellazione reg-so-allineamento; do
  echo "== $t"
  node "$REPO/test/$t.js" || FAIL=1
done
for t in reg-avvio-sync reg-merge-collaborativo; do
  echo "== $t"
  node "$REPO/test/$t.mjs" || FAIL=1
done
if [ "$FAIL" = "0" ]; then echo "== TUTTE LE SUITE PASSATE"; else echo "== ALMENO UNA SUITE FALLITA"; fi
exit $FAIL
