# Piano dei collaudi — Turnario TA Centrale Mestre

Metodo: ogni funzione dell'app deve essere coperta da almeno un collaudo automatico.
Ogni bug corretto NASCE con il collaudo che lo riproduce (regola dal 2025-12:
prima lo scenario, poi la correzione). Se un bug può ritornare, non è chiuso.

Esecuzione di tutto: `sh test/run.sh` (vedi README.md per i prerequisiti).

## Inventario funzioni e copertura

| # | Funzione | Suite che la copre |
|---|---|---|
| 1 | Motore turni (ancora 01/09/2026 D A3, formula delta%4, slot A1-A8) | reg-motore (baseline Excel + invarianti + campioni fissi) |
| 2 | attivoIn (dal/al/eliminato) | reg-motore, reg-cancellazione |
| 3 | RP effettivo: eccezione mensile > storico > base | reg-unit-store |
| 4 | Cambio RP definitivo con decorrenza (vecchio RP valido fino al giorno prima) | reg-unit-store |
| 5 | Eccezione RP solo per un mese | reg-unit-store |
| 6 | Causali: inserimento, cancellazione (codice vuoto) | reg-unit-store |
| 7 | valoreCella / presente / presenteSede (SO conta, R è rinforzo fuori sede) | reg-unit-store |
| 8 | Conteggi inferiori (in turno, Mestre, assenze tot, L, R, RP, autisti, capi autisti, capi, AS, AG, SO115) | reg-conteggi-soglie, reg-v017 |
| 9 | Soglie e colorazioni (assenze>27%, autisti<5, capi<3, SO115<5, TURNI SO<3) | reg-conteggi-soglie (critico), reg-v017 (TURNI SO) |
| 10 | Banner criticità future (unico, con data e motivo, solo dopo inserimento causale) | reg-conteggi-soglie (inserimento simulato: clic cella -> menu -> L) |
| 11 | Home: filtro "solo in servizio", toggle, usciti/cancellati in grigio | reg-cancellazione |
| 12 | Cancellazione reversibile + recupero (finestra Cancella personale) | reg-cancellazione |
| 13 | Recupero omonimi usciti/cancellati all'inserimento | reg-cancellazione (flusso modale), reg-omonimi (recupero uscito, nome diverso per doppi attivi, annullamento) |
| 14 | Sala Operativa: solo SO115, causali SO/L/Mis, TURNI SO allineato e <3 rosso, righe alte | reg-v017, reg-so-allineamento |
| 15 | Rinforzi esterni SO (archivio separato, persistono, cancellabili) | parziale in reg-v017/reg-unit-store (unità store basic); da rafforzare |
| 16 | Ordine automatico del personale | implicito in tutte le suite UI (i nominativi compaiono sempre ordinati); dedicato: da aggiungere |
| 17 | Sincronizzazione: scenari avvio (S1-S5, M1, M1b, V1) | reg-avvio-sync |
| 18 | Unione causali/rinforzi tra due PC (lavoro simultaneo) | reg-merge-collaborativo |
| 19 | Sincronizzazione viva (novationi applicate senza F5, finestra aperta, auto-rispedizione) | reg-sync-live |
| 20 | Teatro del disastro multi-dispositivo cronologico | reg-disastro |
| 21 | Protezione archivio vergine (seed mai spinto) | reg-seed-safe |
| 22 | Push normale | reg-push-normale |
| 23 | Storico copie di sicurezza (10 copie datate, ripristino selezionabile) | reg-storico |
| 24 | Password del dispositivo (imposta/verifica/cambia; mai restare senza lucchetto) | reg-lock |
| 25 | Export/import JSON | reg-unit-store |
| 26 | Controlli statici (selettori CSS accoppiati, versione/cache, id JS↔HTML, menu causali, colore L) | reg-statico |
| 27 | Esporta Excel SpreadsheetML (Presenze + Sala Operativa) | reg-export-excel (XML valido, fogli Presenze/Sala Operativa, nominativi, causale L, righe conteggio, esterni SO solo con flag, backup JSON) |
| 28 | Causale su periodo (clic nome: data inizio + n turni) | parziale (reg-v017 via menu); dedicata: da aggiungere |
| 29 | Ordine/struttura lenzuolo (sticky header, nomi fissi, larghezza) | non自动化 (grafica: verifica umana) |

## Bug trovati con questo metodo (iperbole dei "per caso")

- v1.3.1 loading-freeze: il polling live si bloccava dopo il primo push (timer mai azzerato) — trovato da reg-sync-live.
- v1.4.0 lock: cambio password con nuova troppo corta CANCELLAVA la vecchia (dispositivo senza lucchetto) — trovato da reg-lock.
- v1.4.0 cambio RP: la decorrenza non era rispettata (anche i mesi prima del cambio mostravano il nuovo RP) — trovato da reg-unit-store.
- v1.4.0 sync: migrazione al nuovo schema con modifiche offline non spedite le buttava; ora unite e spinte — trovato da reg-disastro.
- v1.4.0 sync: errore di rete all'avvio non gestito (promise reietta) — trovato da reg-disastro.

## Convenzione per ogni nuova release

1. `sh test/run.sh` — TUTTE le suite verdi prima di pubblicare.
2. Ogni fix nuovo porta il suo caso nella suite competente (o una suite nuova).
3. Aggiornare questo file se cambia l'inventario o la copertura.
4. Aggiornare APP_VERSION (js/config.js) e CACHE (sw.js) INSIEME (reg-statico lo verifica).

## Estensioni decise con l'utente (2025-12, secondo giro di critica)

- reg-oggi.mjs: todayIso con data LOCALE Europe/Rome (bloccato a collaudo:
  il sospetto UTC si e' rivelato infondato nel codice attuale, il test
  impedisce che lo diventi in futuro).
- reg-errorlog.mjs + js/errorlog.js: errori JS della PWA spediti alla tabella
  Supabase turnario_log (solo versione/messaggio/pagina; max 1 invio ogni
  30s per tipo; mai dati del registro; fallimenti silenziosi).
- .github/workflows/collaudi.yml: CI a ogni push/PR su main; per il blocco
  effettivo serve la branch protection attivata dall'utente.
- run.sh --coverage: copertura c8 dei moduli critici (sync, store, engine,
  lock): la mappa fatta a mano resta per l'inventario, il numero no.
- TODO concordati: progetto Supabase di TEST per le suite RLS/codice-link
  (punto 2), Playwright su browser reale con service worker/offline e due
  contesti per due PC (punto 5).

## Limiti dichiarati (onestà)

- I collaudi verificano la logica, non i pixel: l'aspetto resta verifica umana.
- jsdom non esegue il service worker: cache/aggiornamento/offline reale restano
  territorio di Playwright (punto 5, da fare).
- Supabase e' simulato con stub nelle suite sync: RLS e codice-link veri
  restano territorio del progetto di test (punto 2, da fare).
- L'export Excel (SpreadsheetML) e' coperto da reg-export-excel (XML valido,
  fogli, righe, esterni SO, backup JSON).
- L'inserimento di omonimi/doppi e' coperto da reg-omonimi.
