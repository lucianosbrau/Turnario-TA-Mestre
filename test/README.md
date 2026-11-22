# Collaudi automatici (suite di regressione)

Questi script simulano l'app in un DOM senza browser (jsdom) e verificano le
regole di business e i casi critici (perdita dati, sincronizzazione, conteggi).
Non sono librerie dell'app: l'app resta senza dipendenze e senza build.

## Prerequisiti (una volta sola)

    npm install --save-dev esbuild jsdom

oppure installali globalmente. Serve Node >= 18.

## Esecuzione di tutte le suite

    sh test/run.sh

Lo script costruisce il bundle di test in /tmp (l app resta senza build),
lancia tutte le suite e stampa PASS/FAIL per ogni controllo.

## Cosa copre ogni suite

- `reg-v017.js` — conteggi del lenzuolo (riga CAPI AUTISTI dopo AUTISTI,
  valori a campione), colori CSS della causale L (verde + bordo nero),
  Sala Operativa: causali SO/L/Mis, riga TURNI SO con rosso sotto 3,
  righe più alte, spazio sotto la tabella, righe ASSENZE TOTALI e SO115.
- `reg-seed-safe.js` — protezione anti-perdita: un archivio vergine (seed)
  perde SEMPRE contro un cloud con dati e non viene mai pushato.
- `reg-push-normale.js` — flusso di push normale: le modifiche arrivano al cloud.
- `reg-storico.js` — storico delle copie di sicurezza: boot con copie
  precaricate, elenco nel modale, ripristino della copia selezionata,
  storico non cancellato.
- `reg-cancellazione.js` — cancellazione reversibile del personale, causali
  conservate, filtro Home e recupero dal modale.
- `reg-so-allineamento.js` — la riga TURNI SO della Sala Operativa è
  allineata alle colonne dei giorni (182 turni nel 2027) e i valori coincidono
  con le SO segnate.
- `reg-avvio-sync.mjs` — scenari avvio sincronizzazione (S1-S5): vergine vs
  cloud, locale più recente non toccato, cloud più nuovo applicato, cloud
  vuoto, regressione del bug seedFresh-funzione.
- `reg-merge-collaborativo.mjs` — lavoro simultaneo: le causali e i rinforzi
  esterni si fondono (nessuna sovrascrittura tra due dispositivi).
- `reg-motore.mjs` — motore dei turni: baseline convalidata sull'Excel (2026: 183
  turni, ancora 01/09/2026 D A3), campioni fissi per data, invarianti della
  formula delta%4, attivoIn con dal/al/eliminato.
- `reg-unit-store.mjs` — unit test diretti di store+engine: RP base/storico/
  eccezione, cambio RP con decorrenza, causali, export/import JSON, presente/
  presenteSede con SO e R.
- `reg-lock.mjs` — password del dispositivo: imposta/verifica/cambia e il caso
  "nuova password troppo corta non cancella la vecchia".
- `reg-statico.js` — controlli statici: coppie di selettori CSS lenzuolo/SO
  (l'incidente v0.15), coerenza APP_VERSION/CACHE, id usati dal JS presenti
  nell'HTML, menu causali coerenti, colore L.
- `reg-conteggi-soglie.js` — righe di conteggio a valori attesi calcolati e
  soglie (assenze>27% rosso, SO115<5 rosso), banner criticita' future unico
  con data e motivo, visibile solo dopo l'inserimento di una causale.
- `reg-disastro.mjs` — teatro del disastro: PC-A compila offline, PC-B vergine
  apre, B salva, A rientra online: nessuna causale nè nominativo perso.
- `reg-oggi.mjs` — todayIso usa la DATA LOCALE (Europe/Rome): alle 00:30
  italiane la data UTC e' ancora ieri e il lenzuolo non deve spostarsi.
- `reg-errorlog.mjs` — log errori di produzione: un invio per tipo ogni 30s,
  solo dati diagnostici, un fallimento di rete non rompe mai l'app.
- `reg-sync-live.mjs` — sincronizzazione "viva" mentre l'app e' aperta:
  le novita' del cloud si applicano da sole (niente F5), con una finestra
  aperta o modifiche non ancora spedita si aspetta e avvisa col banner,
  cloud regredito viene unito e rispinto.

Il piano completo (inventario delle funzioni, mappa di copertura, bug storici
trovati con questo metodo) e' in PIANO-COLLAUDI.md.

Copertura: `sh test/run.sh --coverage` misura con c8 le righe eseguite dei
moduli critici (sync, store, engine, lock). In CI (GitHub Actions,
.github/workflows/collaudi.yml) le suite girano a ogni push/PR e la copertura
viene pubblicata nel log: se una suite fallisce la check diventa rossa
(attivare la branch protection per rendere il blocco effettivo su main).

## Convenzioni

- jsdom con `runScripts: 'outside-only'`, bundle valutato con `window.eval`
  (suite _js) oppure bundle ESM importato direttamente (suite _mjs).
- Stub di alert/confirm/prompt/scrollIntoView; localStorage pre-popolato.
- Sblocco password del dispositivo con `test1234`.
- Le suite lanciano `process.exit(1)` se un controllo fallisce.

## Collaudi su browser reale (Playwright, punto 5)

`test/e2e/reg-e2e.mjs` — Chromium vero con service worker vero:
(E1) PC vergine: il cloud ha la meglio sul seed al primo avvio; (E2) il service
worker controlla la pagina; (E3) colori COMPUTATI dalle celle (verde #3fd14f,
bordo 2px, niente celle rosa); (E4) OFFLINE vero: l'app si apre dal SW/cache,
una causale compilata offline arriva al cloud al rientro; (E5) due contesti
(due PC) contro lo stesso cloud: le causali si propagano senza perdite;
(E6) nessun errore JS. Le chiamate Supabase sono intercettate a livello di
rete (context.route): NESSUNA query al database reale.
Esecuzione: `node test/e2e/reg-e2e.mjs` (serve `npm i -D playwright` e
`npx playwright install chromium`; senza Playwright la suite SKIPPA con
codice 0). In CI gira a ogni push/PR (passo "Browser reale").

## Collaudi database REALE (punto 2, solo a richiesta)

`test/reg-supabase-online.mjs` — gira CONTRO il Supabase di produzione ma tocca
SOLO la riga del codice di collaudo (TEST-COLLAUDI-TURNARIO-000001): codice
inesistente non legge né scrive, scrittura con codice fantasma rifiutata,
riga di test scrive/ rilegge correttamente, tabella non leggibile dal browser
(RLS), archivio vero incontaminato (solo forma). Esecuzione:
`sh test/run.sh --online` — NON in CI, per non consumare quota.
