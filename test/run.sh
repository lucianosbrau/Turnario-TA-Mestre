#!/bin/sh
# Esegue tutte le suite di collaudo del Turnario TA.
# Prerequisiti: node >= 18, esbuild e jsdom (npm i -D esbuild jsdom, oppure globali).
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export TURNARIO_REPO="$REPO"
export TZ="Europe/Rome"   # collaudi sulle date: fuso del distaccamento
BUNDLE="${APP_BUNDLE:-/tmp/turnario-app-bundle.js}"
SYNC="${SYNC_BUNDLE:-/tmp/turnario-sync-bundle.mjs}"
export SYNC_BUNDLE="$SYNC"
export ENGINE_BUNDLE="/tmp/turnario-engine-bundle.mjs"
export STORE_BUNDLE="/tmp/turnario-store-bundle.mjs"
export LOCK_BUNDLE="/tmp/turnario-lock-bundle.mjs"
export ERRORLOG_BUNDLE="/tmp/turnario-errorlog-bundle.mjs"
export APP_BUNDLE="$BUNDLE"

if [ -x "$REPO/node_modules/.bin/esbuild" ]; then ESB="$REPO/node_modules/.bin/esbuild";
elif [ -n "$ESBUILD_BIN" ]; then ESB="$ESBUILD_BIN";
else ESB="esbuild"; fi

echo "== build bundle"
"$ESB" "$REPO/js/main.js" --bundle --outfile="$BUNDLE" --format=iife || exit 1
"$ESB" "$REPO/js/sync.js" --bundle --format=esm --outfile="$SYNC" || exit 1
"$ESB" "$REPO/js/engine.js" --bundle --format=esm --outfile="/tmp/turnario-engine-bundle.mjs" || exit 1
"$ESB" "$REPO/js/store.js" --bundle --format=esm --outfile="/tmp/turnario-store-bundle.mjs" || exit 1
"$ESB" "$REPO/js/lock.js" --bundle --format=esm --outfile="/tmp/turnario-lock-bundle.mjs" || exit 1
"$ESB" "$REPO/js/errorlog.js" --bundle --format=esm --outfile="/tmp/turnario-errorlog-bundle.mjs" || exit 1

FAIL=0
for t in reg-v017 reg-seed-safe reg-push-normale reg-storico reg-cancellazione reg-so-allineamento reg-statico reg-conteggi-soglie; do
  echo "== $t"
  node "$REPO/test/$t.js"
  rc=$?
  if [ "$rc" -ne 0 ]; then echo "== $t USCITA CON CODICE $rc"; FAIL=1; fi
done
for t in reg-avvio-sync reg-merge-collaborativo reg-sync-live reg-motore reg-unit-store reg-lock reg-disastro reg-oggi reg-errorlog; do
  echo "== $t"
  node "$REPO/test/$t.mjs"
  rc=$?
  if [ "$rc" -ne 0 ]; then echo "== $t USCITA CON CODICE $rc"; FAIL=1; fi
done
if [ "$FAIL" = "0" ]; then echo "== TUTTE LE SUITE PASSATE"; else echo "== ALMENO UNA SUITE FALLITA"; fi

# --e2e: collaudi su BROWSER REALE (Playwright + Chromium + service worker)
if [ "$1" = "--e2e" ] || [ "$2" = "--e2e" ]; then
  echo "== e2e browser reale (playwright)"
  node "$REPO/test/e2e/reg-e2e.mjs"
  rc=$?
  if [ "$rc" -ne 0 ]; then echo "== e2e USCITA CON CODICE $rc"; FAIL=1; fi
fi

# --coverage: percentuale di righe eseguite sul codice critico (c8 + NODE_V8_COVERAGE)
if [ "$1" = "--coverage" ]; then
  if command -v c8 >/dev/null 2>&1 || [ -x "$REPO/node_modules/.bin/c8" ]; then
    echo "== copertura (moduli critici: sync, store, engine, lock, errorlog)"
    "$REPO/node_modules/.bin/c8" --include "js/**" --reporter text --reporter text-summary \
      node "$REPO/test/reg-avvio-sync.mjs" >/dev/null 2>&1
    "$REPO/node_modules/.bin/c8" --include "js/**" --no-clean --reporter text-summary \
      node "$REPO/test/reg-unit-store.mjs" >/dev/null 2>&1
    "$REPO/node_modules/.bin/c8" --include "js/**" --no-clean --reporter text \
      node "$REPO/test/reg-motore.mjs" >/dev/null 2>&1
  else
    echo "== c8 non installato (npm i -D c8): copertura saltata"
  fi
fi
exit $FAIL
