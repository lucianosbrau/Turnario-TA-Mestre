# Turnario Turno A — Portogruaro (PWA)

Gestione presenze e turni del Turno A di Portogruaro. Sostituisce il foglio
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
