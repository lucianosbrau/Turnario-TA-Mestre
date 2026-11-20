# Turnario Turno A — Portogruaro (PWA)

Gestione presenze e turni del Turno A di Portogruaro. Sostituisce il foglio
`Presenze_TurnoA 2026.ods` con una web-app installabile (PWA) che funziona
anche offline. Tutti i dati restano **sul tuo dispositivo** (nessun server).

## Come funziona

- **Pagina principale (Personale)**
  - Anno di riferimento: resta memorizzato tra una sessione e l'altra.
  - Elenco del personale con grado, RP (salto turno), specializzazioni e
    periodo di validità (dal / al). Chi esce dal turno resta in archivio.
  - Nuova persona, modifica, cambio RP definitivo con storico e decorrenza.
  - Esporta / Importa backup (file JSON) — fallo con regolarità.
- **Pagina Presenze (il "lenzuolo")**
  - Tutto l'anno in orizzontale, con scorrimento; i 12 mesi in fila.
  - Le celle RP (riposo) sono calcolate automaticamente dal salto turno.
  - Clicca una cella per assegnare una causale: L (licenza), Mis (missione),
    M (malattia), SO (sala operativa), R (rinforzo).
  - La colonna RP di ogni mese permette un cambio di salto turno
    **valido solo per quel mese** (eccezione, non tocca l'archivio).
  - Totali a destra per persona; in basso la riga EFFETTIVI DI SEDE
    (celle vuote + SO + R).
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
(personale, causali 2026, storico RP). Il primo avvio carica questi dati;
dopo, l'app lavora sulla propria copia locale.
