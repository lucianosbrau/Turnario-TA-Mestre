# PORTOGRUARO — briefing per una nuova sessione di sviluppo

> Documento da fornire come **informazione di base a una nuova chat** per costruire,
> su repository e database propri, la versione "Turnario — Portogruaro" della PWA
> già sviluppata per Mestre. Scriverlo all'inizio della nuova chat insieme
> all'eventuale file Excel del distaccamento di Portogruaro.

## 1. Missione

Realizzare la stessa PWA ("lenzuolo" digitale presenze + gestione personale +
Sala Operativa) ma per il **Distaccamento di Portogruaro**, con:

- **nuovo repository GitHub** (nome suggerito: `Turnario-TA-Portogruaro`) e
  GitHub Pages attiva da `main`;
- **nuovo progetto Supabase** (URL e anon key propri), nuova tabella/link
  privato con **nuovo codice segreto**;
- nome app: **"Turnario TA — Portogruaro"** (nel repo di Mestre il nome
  Portogruaro era stato rimosso: lì è Centrale Mestre, qui viceversa);
- anno di riferimento iniziale da concordare con l'utente.

## 2. Da dove si parte

Copiare il codice della versione stabile di Mestre (repository
`lucianosbrau/Turnario-TA-Mestre`, main, v0.15.x) e adattarlo. La **logica di
business è già validata dall'utente** con il foglio Excel di Mestre; leggere
prima di tutto `CONTINUITA.md` di quel repo: contiene tutte le decisioni
riguardanti causali, conteggi, RP, Sala Operativa, regole di evidenziamento e
criticità, convenzioni di rilascio e pattern di test.

### Cosa COPIARE così com'è (verificato)

- Motore calendario perenne (`js/engine.js`): ancora calcolata come
  **2026-09-01 = turno Diurno, salto A3** — MA da **riverificare** contro il
  lenzuolo Excel di Portogruaro (se il distaccamento segue lo stesso turno A
  della centrale, l'ancora dovrebbe coincidere; controllare le prime settimane
  mese per mese).
- Struttura PWA statica: HTML + CSS + vanilla JS, moduli ES, **nessuna
  libreria, nessun build**; service worker sempre network-first con cache
  versionata solo per offline.
- Tutte le regole di business (vedi `CONTINUITA.md` §4 di Mestre): causali
  L/Mis/M/R/SO (SO solo da Sala Operativa), righe di conteggio con soglie
  (Assenze totali RP+L > 27%, Autisti 3°/4° < 5, Capi CS/CSE/CR/CRE in
  sede < 3, SO115 < 5), riepiloghi destri L / L estive (>8 rossa) / R,
  gestione personale dal/al, filtro home sul personale in servizio,
  duplicati con recupero omonimi usciti, cancellazione massiva con spunte,
  Sala Operativa con personale SO115 + rinforzi esterni (archivio separato,
  solo RP all'inserimento), banner criticità unico mostrato solo dopo
  l'inserimento di una causale, evidenziazione riga con ▸.

### Cosa GENERARE EX NOVO (mai copiare da Mestre)

1. **Seed dei dati** (`js/seed-data.js`): personale, specializzazioni,
   autisti, RP, storico RP e causali di Portogruaro dal **suo file Excel**.
   Il seed di Mestre va cancellato: 35 persone sbagliate herefarebbero
   confusione.
2. **Credenziali**: `SUPABASE_URL` e `SUPABASE_ANON_KEY` in `js/config.js`
   del nuovo progetto Supabase. **Non committare mai** le chiavi di Mestre
   nel repo nuovo (lì sono pubbliche nel codice per scelta; il link privato
   invece NON va mai scritto: si comunica fuori banda).
3. **Codice del link privato**: generare un nuovo codice segreto e far
   eseguire all'utente gli script SQL del README (tabella
   `turnario_link_privato` + RPC `turnario_leggi/turnario_scrivi/
   turnario_cambia_codice` con RLS). Le stesse funzioni sono già pronte: si
   cambiano solo i nomi se si vuole isolare (es. prefisso `portogruaro_`).
4. **Chiavi dei dati**: rinominare nel codice `turnario-ta-v1` (localStorage
   archivio), `turnario-ta-lock` (password dispositivo) e
   `turnario-ta-sync-code` (codice link) — es. `turnario-pg-v1`,
   `turnario-pg-lock`, `turnario-pg-sync-code` — così un dispositivo che
   usi entrambe le app non si mescola i dati.
5. **CACHE del service worker**: partire da `turnario-pg-v0.1.0` e
   `APP_VERSION = "0.1.0"`.
6. **Manifest, icone, font**: manifest.webmanifest (nome/short_name
   aggiornati), `icons/logo.png` (chiedere il distintivo all'utente),
   i font Titillium Web si copiano (self-hosted in `fonts/`, licenza OFL).

## 3. Questioni da aprire subito con l'utente (Portogruaro)

- Anno di partenza e file Excel di Portogruaro (controllare: 8 salti A1–A8
  uguali? personale con le stesse specializzazioni? CAPI/SO115/autisti con
  le stesse soglie? e la soglia "Assenze totali > 27%" è valida anche lì?).
- Se il calendario del distaccamento segue esattamente il turno A (verifica
  con l'Excel: primissimo giorno dell'anno foglio = D o N? quale salto?).
- Monitor ultrawide dell'utente: le due pagine già non hanno limiti di
  larghezza; niente da chiedere.

## 4. Convenzioni di lavoro (già collaudate con questo utente)

- **PR e merge**: branch `vibe/<slug>-29a2d7`, PR con `gh pr create --draft`
  poi `gh pr ready`, **unione in locale** `git merge --no-ff` + push su main
  (GitHub marca la PR MERGED), eliminazione del branch. File title/body PR
  in /tmp con heredoc `<<'EOF'` (niente token tipo `__PRN__`).
- **Versioni**: a ogni modifica significativa incrementare INSIEME
  `APP_VERSION` (config.js, badge in alto) e `CACHE` in sw.js.
- **Continuità**: creare subito un CONTINUITA.md come quello di Mestre e
  aggiornarlo a ogni release; il README racconta l'uso, il CONTINUITA le
  decisioni.
- **Verifiche**: bundle esbuild in /tmp + suite jsdom (pattern in
  CONTINUITA §8 di Mestre). Attenzione: jsdom NON applica il CSS: le regole
  di stile si verificano con controlli testuali rigorosi sui selettori
  (vedi incidente v0.14.0 → v0.15.2 di Mestre: selettori corrotti hanno
  dipinto di rosso l'intero lenzuolo, non ripetere sostituzioni in blocco).
- Password di accesso per dispositivo (hash SHA-256, "lucchetto di
  cortesia"): richiesta all'apertura e — questo è piaciuto — resta valida
  anche per chi ha il link privato.
- L'utente è un NON programmatore: spiegazioni semplici, niente dettagli
  tecnici non richiesti, chiedere conferma quando una regola potrebbe
  differenziarsi.

## 5. Recap finale per la nuova chat

1. Leggere questo file e il `CONTINUITA.md` del repo Mestre.
2. Ricevere dall'utente il file Excel di Portogruaro e verificarlo (come
   fatto per Mestre: fogli Presenze / Personale / Liste / Calendario_Perenne / Storico_RP).
3. Creare repo + Pages + progetto Supabase con i nomi scelti.
4. Copiare il codice, applicare i punti del §2 (cosa generare ex novo),
   caricare i seed di Portogruaro.
5. Costruire e rilasciare v0.1.0 con le stesse convenzioni.
