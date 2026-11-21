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
- `reg-sync-live.mjs` — sincronizzazione "viva" mentre l'app e' aperta:
  le novita' del cloud si applicano da sole (niente F5), con una finestra
  aperta o modifiche non ancora spedita si aspetta e avvisa col banner,
  cloud regredito viene unito e rispinto.

## Convenzioni

- jsdom con `runScripts: 'outside-only'`, bundle valutato con `window.eval`.
- Stub di alert/confirm/prompt/scrollIntoView; localStorage pre-popolato.
- Sblocco password del dispositivo con `test1234`.
- Le suite lanciano `process.exit(1)` se un controllo fallisce.
