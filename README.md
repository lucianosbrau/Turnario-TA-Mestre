# Turnario TA — Centrale Mestre (PWA)

Gestione presenze e turni del Turno TA della Centrale di Mestre. Sostituisce il foglio
`Presenze_TurnoA 2026.ods` con una web-app installabile (PWA) che funziona
anche offline. Tutti i dati restano **sul tuo dispositivo** (nessun server).
Anno di partenza: **2027**.

## Come funziona

- **Pagina principale (Personale)**
  - Anno di riferimento: resta memorizzato tra una sessione e l'altra.
  - Elenco del personale con grado, RP (salto turno), specializzazioni e
    periodo di validità (dal / al). Chi esce dal turno resta in archivio.
  - Nuova persona, modifica, cambio RP definitivo con storico e decorrenza.
  - Esporta / Importa backup (file JSON) — fallo con regolarità.
- **Grafica**: font Titillium Web (open source, SIL OFL — è il carattere
  tipografico istituzionale usato dal sito dei Vigili del Fuoco), self-hosted
  in `fonts/` per funzionare offline; colonne del lenzuolo colorate per
  salto turno con la palette del foglio Excel (A1 lime, A2 giallo, A3 azzurro,
  A4 rosa, A5 arancio, A6 lilla, A7 teal, A8 grigio).
- **Logo**: l'app mostra automaticamente `icons/logo.png` se presente; in
  caso contrario usa il segnaposto. Il logo ufficiale del Corpo ha uno
  status particolare dicopyright, quindi il file non va committato in un
  repository pubblico: chi ne ha titolo puo' caricarlo solo nella propria
  installazione (vedi sotto).
- **Pagina Presenze (il "lenzuolo")**
  - Tutto l'anno in orizzontale, con scorrimento; i 12 mesi in fila.
  - Le celle RP (riposo) sono calcolate automaticamente dal salto turno.
  - Clicca una cella per assegnare una causale: L (licenza), Mis (missione),
    M (malattia), SO (sala operativa), R (rinforzo).
  - La colonna RP di ogni mese permette un cambio di salto turno
    **valido solo per quel mese** (eccezione, non tocca l'archivio).
  - I nomi restano fissi mentre si scorre verso destra (colonne fisse).
  - Causali su un periodo: clicca il NOME della persona e scegli la causale
    e l'intervallo di date (per un singolo giorno clicca la cella).
  - Totali a destra per persona; in basso DUE righe di conteggio:
    PERSONALE IN TURNO (celle vuote + SO + R, riposi e assenze esclusi) e
    PERSONALE MESTRE (come sopra ma senza i rinforzi R, in servizio
    presso altre sedi).
  - Ordine dei nominativi: per grado (CSE, CR, CRE, CS, VC, VE, VF) con il
    capo turno per primo, come nel foglio Excel; a parita' di grado resta
    l'ordine di inserimento.
- **Calendario perenne**: generato dall'ancora 01/09/2026 = turno Diurno,
  salto A3 (verificata contro il file Excel). Qualsiasi anno, passato o
  futuro, si calcola da qui.

## Password di accesso

Al primo avvio l'app chiede di scegliere una password; alle aperture
successive la chiede prima di mostrare qualunque dato. Si cambia dalla
pagina principale ("Cambia password di accesso"). Nota onesta: e' un
lucchetto di cortesia del dispositivo (protegge da sguardi, non cifra i
dati del browser).

## Sincronizzazione tra dispositivi (Supabase)

La compilazione si ritrova uguale su PC e telefono senza nessun file da
gestire: l'archivio viene salvato online in automatico a ogni modifica e
scaricato all'apertura. Se la rete manca, l'app funziona lo stesso e si
risincronizza appena torna.

### Attivazione (una volta sola, chi gestisce il progetto)
1. Nel pannello del proprio account Supabase, in **SQL Editor**, eseguire:

```sql
create table if not exists turnario_archivio (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stato jsonb not null,
  aggiornato_al timestamptz not null default now()
);
alter table turnario_archivio enable row level security;
create policy "solo proprietario legge" on turnario_archivio
  for select using (auth.uid() = user_id);
create policy "solo proprietario inserisce" on turnario_archivio
  for insert with check (auth.uid() = user_id);
create policy "solo proprietario aggiorna" on turnario_archivio
  for update using (auth.uid() = user_id);
```

2. In **Authentication → Users → Add user**: creare l'account del turno
   (email + password a scelta) e confermarlo (auto-confirm).
3. In **Settings → API**: copiare *Project URL* e *anon public key* dentro
   `SUPABASE_URL` e `SUPABASE_ANON_KEY` in `js/config.js` e pubblicare.

Dopo la pubblicazione, su ogni dispositivo: pagina principale →
**"Attiva la sincronizzazione"** → email e password del turno, una volta
sola. Lo stato della sincronizzazione e' sempre visibile in alto.

Chiave di volta: se due dispositivi compilano **contemporaneamente**, vince
l'ultima modifica; l'app conserva comunque uno snapshot prima di applicare
l'archivio dal cloud.

## Aggiornamenti e dati: come non perdere la compilazione

I dati compilati (causali, personale, RP) **vivono nel browser**, separati dal
codice: un nuovo rilascio li conserva automaticamente. In più:
- a ogni cambio di versione dell'app viene salvata una **copia di sicurezza
  interna** dello stato precedente (pulsante "Ripristina copia di sicurezza");
- l'**esportazione JSON** resta l'assicurazione vera: fai un backup prima di
  cambiare dispositivo o se cambi l'indirizzo del sito (i dati sono legati
  all'indirizzo esatto).

## Tecnica, in breve

- PWA statica: HTML + CSS + JavaScript, nessuna libreria esterna, nessun build.
- Dati in `localStorage` del browser; backup con export/import JSON.
- Service worker in modalità **network-first**: con internet usa sempre
  l'ultima versione online, la cache serve solo quando sei offline.

## Convenzione delle versioni

A ogni modifica importante si aggiornano **due contatori, uno accanto
all'altro**:
1. `APP_VERSION` in `js/config.js` — appare come badge in alto a destra.
2. `CACHE` in `sw.js` — es. `turnario-ta-v0.2.0`.

## Dati di partenza

`js/seed-data.js` è generato dal foglio `Presenze_TurnoA 2026.ods`
(personale, causali 2026, storico RP). Il primo avvio carica questi dati
e l'anno 2027; dopo, l'app lavora sulla propria copia locale.

## Logo ufficiale (per l'installazione personale)

Il distintivo del Corpo Nazionale è un emblema istituzionale non libero
(vedi l'avviso su Wikipedia). Non viene incluso nel repository pubblico;
chi ha titolo all'uso interno può semplicemente salvare il file del logo come
`icons/logo.png` accanto all'app: viene mostrato automaticamente in testata
  al posto del segnaposto, restando locale al proprio dispositivo.
