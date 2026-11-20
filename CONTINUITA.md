# CONTINUITÀ — Turnario TA Centrale Mestre

Documento operativo per chiunque riprenda lo sviluppo dell'app (un'altra sessione
di sviluppo assistito o un operatore reale). Contiene le decisioni prese
insieme all'utente, le regole di business verificate, l'architettura del
codice e le convenzioni di rilascio. Aggiornarlo a ogni modifica importante.

Data di riferimento: fine v0.14.0. Ultima versione pubblicata: **0.14.0**.

**Sala Operativa (v0.14.0)**: pulsante verde in coda alla barra della home,
routing `#so`, pagina `#pagina-so` con tabella `#lenzuolo-so`: calendario
identico al lenzuolo (mesi, date, D/N, slot, colonna RP del mese, celle
causali cliccabili) ma righe limitate a chi ha la spunta SO115 in anagrafica;
toggle "solo attivi" locale (#so-solo-attivi). RIEPILOGHI ANCORA DA
DEFINIRE con l'utente.

## 1. Contesto e obiettivo

- **Utente**: responsabile non programmatore del Turno A dei Vigili del
  Fuoco, Distaccamento di Mestre. Parla italiano, vuole spiegazioni semplici
  ma vuole anche essere contraddetto quando propone soluzioni inefficaci.
- **Obiettivo**: PWA che sostituisce il foglio di calcolo
  `files/Presenze_TurnoA 2026.ods` ("lenzuolo" = registro presenze annuale)
  con gestione dell'avvicendamento del personale durante l'anno.
- **Anno di riferimento predefinito 2027** (`ANNO_DEFAULT`). Conteggi dei
  turni eventi estremamente precisi: il calendario è generato dall'ancora
  e riproduce il file Excel al 100%.
- Nome ufficiale: **"Turnario TA — Centrale Mestre"** (NON Portogruaro).
- Sito pubblicato: GitHub Pages da `main`, root del repository.

## 2. Stack e vincoli tecnici (decisioni irrinunciabili)

- PWA **statica pura**: HTML + CSS + vanilla JS (moduli ES). **Nessuna
  libreria esterna, nessun processo di build** in repo. Il bundle per i
  test si genera con esbuild in /tmp (vedi §8).
- Nessun server proprietario: i dati vivono in `localStorage` + sync
  Supabase (vedi §7).
- Font: **Titillium Web** self-hosted in `fonts/` (SIL OFL, è il font
  istituzionale di vigilfuoco.gov.it).
- Logo: `icons/logo.png`, distintivo fornito dall'utente, committato nel
  repo pubblico **con il suo consenso esplicito** (nota sul copyright
  data all'utente; nessuna azione pendente).
- Localizzazione: interamente **italiano**;date ISO internamente,
  `isoToIt()` per la visualizzazione gg/mm/aaaa.

## 3. Architettura del codice

| File | Ruolo |
|---|---|
| `js/config.js` | Costanti: `APP_VERSION`, ancora calendario, `CAUSALI`, `SLOT`+`SLOT_COLOR` (palette Excel), `GRADI`, `GRADO_ORDER=["CSE","CR","CRE","CS","VC","VE","VF"]`, `MESI`, `SPEC_FIELDS`, `AUTISTA=["1°","2°","3°","4°"]`, `ANNO_DEFAULT=2027`, credenziali Supabase. |
| `js/engine.js` | Motore calendario: `turniAnno`, `attivoIn(p,iso)` (date dal/al), `rpEffettivo` (eccezione mese → storico → RP base), `valoreCella`, `presente` (in turno, include SO e R), `presenteSede` (esclude R), `effettiviTurno`, `isoToIt`, `todayIso`, `cellKey`. |
| `js/store.js` | Stato in `localStorage` chiave `"turnario-ta-v1"`; snapshot automatico a cambio di `__appVersion`; `setCausale` (una causale = un giorno `{p,d,c}`), `cambioRpDefinitivo`, `setEccezioneMese`, `mappaCausali`, migrazione autista "1".."4" → "1°".."4°" in `load()`. |
| `js/ui.js` | Tutta la UI: home, lenzuolo, schede/modali, menu causale, cancellazione massiva, duplicati/recupero, banner criticità. |
| `js/main.js` | Avvio: blocco password, registrazione service worker, routing hash (`#presenze`). |
| `js/lock.js` | Password per-device, hash SHA-256, chiave `"turnario-ta-lock"`. Risposta data all'utente: è un "lucchetto di cortesia", non cifratura. |
| `js/sync.js` | Modalità A (link privato, preferita: RPC `turnario_leggi/turnario_scrivi` con codice in `?k=`, salvato in `"turnario-ta-sync-code"`); modalità B (account email+password). |
| `js/seed-data.js` | 35 persone + causali 2026 + rpStorico generati dall'ODS. Si carica solo al primo avvio. |
| `sw.js` | Service worker **sempre network-first** (bypass cache), cache versionata solo per fallback offline. |
| `index.html` | Struttura pagine. Nota storica: sezioni gestite con `toggleAttribute("hidden")` — mai solo `style.display`. |
| `css/style.css` | Estetica dai colori Excel; colonne lenzuolo per slot. |

### Motore calendario (verificato contro l'Excel, non toccare senza riverifica)

- Ancora: **2026-09-01 = turno Diurno, salto A3** (`ANCHOR_DATE/SLOT/PHASE`).
- `delta%4==0 → D`, `==1 → N`; slot coppia k-esima = `((3-1+k) mod 8)+1`.
- 2027: 182 turni (91 D, 91 N), continuità 2026→2027 verificata.
- RP effettivo in una data: 1) eccezione del mese (pagina Presenze, non
  tocca l'archivio), 2) rpStorico con periodo, 3) RP base dell'anagrafica.

## 4. Regole di business decise con l'utente (v0.1 → v0.12.2)

**Causali**: L licenza, Mis missione, M malattia, SO sala operativa
(conta come presenza), R rinforzo (lavora ma altrove, NON presenza sede).
Causale "A" eliminata su richiesta. Cella vuota = in turno.

**Inserimento causali**: clic sulla cella = quel giorno; clic sul NOME =
scheda unica con **menu a tendina della causale, calendario nativo
(type=date, default: oggi se nell'anno del lenzuolo, altrimenti 1
gennaio) e numero di turni consecutivi**, tutto nella stessa maschera
(v0.13.0: niente più prompt sequenziali; se la data scelta non è un
turno parte dal primo turno utile). Dopo ogni inserimento di causale il
banner delle criticità si aggiorna (vedi sotto).

**Righe di conteggio in basso (per ogni turno)**:
1. PERSONALE IN TURNO (`presente`: celle vuote + SO + R, riposi/assenze esclusi)
2. PERSONALE MESTRE (come sopra ma senza R)
3. **ASSENZE TOTALI (RP + L)** (v0.13.1, riga gialla, subito dopo PERSONALE
   MESTRE) — critico se `> floor(0.27 × personale in turno)`; e' QUESTA
   riga a generare l'alert del 27% (le sole licenze non lo generano piu')
4. LICENZE (L) — nessun alert
5. RINFORZI (R)
6. IN RP (celle vuote che coincidono con lo slot RP)
7. **AUTISTI (3° e 4°)** — solo `p.autista ∈ {"3°","4°"}` E `presenteSede`; critico se < 5
8. **CAPI** (gradi CS/CSE/CR/CRE) — `presenteSede` (decisione confermata dall'utente: conta chi è in sede, rinforzi esclusi); critico se < 3
9. AS presenti — spec AS + `presenteSede`
10. AG presenti — spec AG + `presenteSede`
11. SO115 presenti — **spunta SO115 in anagrafica** (NON la causale SO) + `presenteSede`; critico se < 5

**Evidenza criticità**: cella rossa (`td.num.critico`); banner unico
chiudibile con "x" che elenca **tutte** le criticità future con data
successiva ad oggi, ma **compare solo dopo l'inserimento di una causale**
(`avvisoDaCausale`), non all'apertura della pagina. Chiuso non ricompare
finché non si inserisce un'altra causale. Non persiste tra sessioni (nota
comunicata all'utente, comportamento accettato).

**Evidenziazione righe (v0.12.3)**: accanto a ogni nome del lenzuolo c'e' un
triangolo ▸; un clic evidenzia quella riga per tutto l'anno in giallo
trasparente (i colori degli slot restano leggibili sotto; il triangolo
ruota a ▾), un secondo clic la disattiva; piu' righe insieme. Non
persiste tra le sessioni. Il clic sul NOME resta per la causale su periodo.

**Riepiloghi a destra del lenzuolo** (per persona): colonne **L,
L estive, SO, R**. Le vecchie colonne TURNI, RP, MIS, M sono state
rimosse su richiesta (v0.10). **L estive** = licenze nei mesi
giugno–settembre, colonna **gialla**, cella **rossa se > 8**.

**Personale**:
- Campi obbligatori alla creazione: **solo cognome e nome** (verifica nel
  `onclick` di `#fp-salva`, non usare `required` del form: non funziona
  con i bottoni). Tutto il resto facoltativo (grado di default VF, RP
  default A1, capoTurno menu Si/No, Autista menu 1°/2°/3°/4°).
- Avvicendamento: date **dal/al** nella scheda; chi ha `al` passato è
  "uscito": resta in archivio, non compare in compilazione corrente.
- **Ordinamento automatico ovunque** (home, lenzuolo, menu): grado
  `GRADO_ORDER`, poi capo turno ("Si") prima, poi ordine di inserimento.
  Il pulsante "Ordina personale" è stato rimosso come ridondante.
- **Home filtrata**: di default solo chi è in servizio oggi (spunta
  "solo-attivi-home", disinseribile per vedere anche gli usciti).
- La vecchia riga di riepilogo "Personale in turno oggi: X su Y" è stata
  **rimossa** su richiesta (v0.12.2).
- **Duplicati**: cognome+nome confrontati case-insensitive/trim su tutto
  l'archivio. Se l'omonimo è **uscito** → offerta di **recupero**
  (azzera `al`, storico intatto, nessun doppione); se si rinuncia o
  l'omonimo è attivo → richiesta di nominativo differente univoco
  (loop di prompt, annullare non salva).
- **Cancellazione**: senza password (rimossa su richiesta, v0.10.2);
  solo conferma. Dal menu "Cancella personale": **spunte multiple** +
  "Seleziona tutti" + un'unica conferma con numero e nomi.
- **Password di accesso** per-device richiestasolo all'apertura
  dell'app; "Cambia password di accesso" rimane tra i pulsanti.

**UI**: modale con "x" **dentro i confini della scheda** (angolo alto
destro del box, sticky; NON ancorata alla finestra: modificato in
v0.11.1 su richiesta). Anno = `<select class="anno-menu">` persistente
in `state.settings.anno`. Lenzuolo a piena larghezza (fino a 3840px),
nomi fissi a sinistra durante lo scroll, 12 mesi in fila.

## 5. Convenzioni di rilascio (obbligatorie)

1. A ogni modifica significativa aumentare **insieme** `APP_VERSION`
   in `js/config.js` e `CACHE = "turnario-ta-vX.Y.Z"` in `sw.js`.
2. Flusso: branch `vibe/<slug>-29a2d7` → PR bozza con `gh pr create
   --draft` (title/body da file /tmp con heredoc `<<'EOF'` — NON usare
   token tipo `__PRN__`: hanno causato fallimenti silenziosi) → `gh pr
   ready` → **merge locale** `git merge --no-ff` + push su `main`
   (l'unione via API GitHub è bloccata dall'ambiente; GitHub marca la
   PR MERGED automaticamente) → eliminare il branch.
3. Commit mirati, mai segreti nei file di testo dei messaggi.

## 6. Dati, backup e sincronizzazione

- `localStorage["turnario-ta-v1"]`: intero archivio (personale, causali
  per anno, rpStorico, exceptions, settings). Snapshot automatico in
  `turnario-ta-v1-snapshot` a ogni cambio versione; "Ripristina copia
  di sicurezza".
- Sync Supabase: se il cloud è più recente di `__aggiornatoAl` locale,
  vince il cloud (snapshot prima di applicare). Push automatico 2.5s
  dopo ogni `save()`.
- Modalità in uso: **link privato** `…/?k=CODICE`. Il codice NON va
  mai scritto nella documentazione del repo. Per rigenerarlo:
  SQL `select turnario_cambia_codice('vecchio','nuovo')`.
- La password dell'app resta comunque richiesta (confermato dall'utente).

## 7. Questioni aperte / note per riprendere

- Definizioni di presenza: le righe AUTISTI/CAPI usano `presenteSede`
  (esclude R); PERSONALE IN TURNO usa `presente` (include SO e R) —
  comunicata come decisione di design, nessuna modifica richiesta finora.
- Il recupero dell'omonimo riattiva la persona **com'era** (grado, RP,
  specializzazioni storici); possibile evoluzione: applicare i valori
  appena compilati nella scheda alla persona recuperata.
- Chiusura del banner criticità non persistente tra sessioni (accettato).
- UNA cella "L estive" è per anno selezionato; soglia rossa: > 8.

## 8. Verifica e test (come si è sempre verificato)

- Bundle test: `cd /tmp && npx esbuild <repo>/js/main.js --bundle
  --platform=browser --outfile=/tmp/app-bundle.js --format=iife`
- Test jsdom pattern: JSDOM con `runScripts:"outside-only"`, override di
  `alert/confirm/prompt/matchMedia/serviceWorker`, pre-seed di
  `localStorage`, `window.eval(bundle)`, sblocco via
  `#blocco-pass`/`#blocco-pass2`/`#blocco-ok` con `test1234`.
- Suite in /tmp (non committate): `test-autista.js` (Autista 1°–4°, L
  estive), `test-banner.js` (criticità, CAPI in sede, banner su causa),
  `test-massiva.js`, `test-obbligatori.js` (ordine automatico, campi
  obbligatori), `test-filtro-dupe.js`, `test-recupera.js`, `test-x.js`,
  `test-nuova.js`/`test-nuova-seed.js`.
- Attenzione jsdom: (a) il CSS esterno non è caricato, i controlli di
  colore vanno fatti leggendo `css/style.css`; (b) riscrivare
  `localStorage` dopo il load NON tocca lo `state` in memoria: pre-seed
  prima del bundle o passare dalla UI; (c) l'`hidden` attribute va
  tolto/messo davvero, non basta `style.display`.

## 9. Cronologia sintetica delle release

| Ver. | Contenuto |
|---|---|
| v0.1–v0.9 | struttura PWA, motore, seed, lenzuolo, personale con dal/al, eccezioni RP mensili, conteggi, password, sync (account → link privato), restyling, logo, causali data+turni, x di chiusura |
| v0.10.0 | riga CAPI, criticità (celle rosse + banner), Autista 1°–4° con conteggio solo 3°/4°, riepiloghi con L estive |
| v0.10.1 | CAPI in sede; banner unico, senza limiti, mostrato solo all'inserimento di causali |
| v0.10.2 | cancellazione senza password (solo conferma) |
| v0.11.0 | cancellazione massiva con spunte |
| v0.11.1 | "x" di chiusura dentro i confini della scheda |
| v0.11.2 | rimosso "Ordina personale" (ordinamento automatico verificato); obbligatori solo cognome e nome |
| v0.12.0 | home filtrata sul personale in servizio; avviso duplicati |
| v0.12.1 | recupero dell'omonimo uscito dal turno |
| v0.12.2 | rimossa la riga "Personale in turno oggi" |
| v0.12.3 | triangolo ▸ di evidenziazione riga nel lenzuolo |
| v0.13.0 | causale su periodo: calendario + turni in un'unica scheda (no prompt) |
| v0.13.1 | riga ASSENZE TOTALI (RP+L) gialla con alert 27%, licenze senza alert; bordi riepilogo più marcati; intestazione calendario bloccata allo scroll verticale |
| v0.14.0 | pulsante verde Sala Operativa: pagina dedicata con lenzuolo limitato al personale SO115 (struttura iniziale; riepiloghi da definire) |
