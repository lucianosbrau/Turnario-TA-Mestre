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
  - Nella scheda persona i campi obbligatori sono solo cognome e nome;
    tutto il resto (grado, RP, autista, specializzazioni, date) e'
    facoltativo.
  - Tra le specializzazioni di ogni persona c'e' anche **Autista** con menu
    a tendina: 1°, 2°, 3° o 4° (i vecchi dati salvati "1".."4" vengono
    convertiti automaticamente).
  - Pulsanti: Presenze, Inserisci personale, Cancella personale, Cambio RP
    (definitivo, con decorrenza e storico), Esporta backup.
  - L'ordine del personale e' automatico (grado e capo turno) in tutta
    l'app, incluso il lenzuolo: nessun pulsante di ordinamento.
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
  - Causali su piu' turni: clicca il NOME della persona, scegli la causale,
    la DATA DI INIZIO e QUANTI TURNI consecutivi (per un singolo giorno resta
    il clic sulla cella). Se la data indicata non e' un giorno di turno, la
    causale parte dal primo turno utile.
  - Totali a destra per persona: L, **L estive** (licenze dei mesi di
    giugno, luglio, agosto e settembre; colonna gialla, diventa rossa se
    una persona supera le 8 licenze estive), SO e R.
  - Righe di conteggio in basso per ogni turno: PERSONALE IN TURNO
    (celle vuote + SO + R, riposi e assenze esclusi), PERSONALE MESTRE
    (come sopra ma senza i rinforzi R), LICENZE, RINFORZI, IN RP,
    AUTISTI (solo chi in anagrafica ha 3° o 4°), CAPI (gradi CS, CSE,
    CR, CRE; anche questa riga conta la presenza in sede, quindi senza
    i rinforzi R), AS, AG, SO115 (conta chi ha la spunta SO115 in anagrafica,
    non la causale SO).
  - **Evidenza delle criticita'**: la cella del conteggio diventa rossa se
    le licenze superano il 27% del personale in turno di quel giorno, se gli
    autisti (3°/4°) scendono sotto 5, se i capi scendono sotto 3 o se gli
    SO115 scendono sotto 5. Il banner in alto (chiudibile con la x, unico per
    tutte le date) elenca le criticita' future con data e motivo, ma compare
    solo quando si inserisce una causale che genera criticita': non appare
    all'apertura della pagina.
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

### Modalita' A — link privato (la piu' semplice)

Si sincronizza semplicemente aprendo l'app con l'indirizzo completo del link
privato, salvato nei preferiti: `...Turnario-TA-Mestre/?k=CODICE`.
Il codice viene memorizzato dal dispositivo: dalle volte successive non serve
piu' nemmeno il `?k=...`. Chi ha il link legge/scrive l'archivio di sede; per
revocare l'accesso si rigenera il codice con `turnario_cambia_codice` e si
ridistribuisce il link.

### Modalita' B — account del turno

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

### Script SQL per il link privato (Modalita' A)

```sql
create table if not exists turnario_link_privato (
  id int primary key default 1,
  codice text not null unique,
  stato jsonb not null default '{}'::jsonb,
  aggiornato_al timestamptz not null default now()
);
insert into turnario_link_privato (id, codice) values (1, 'CODICE-SEGRETO-GENERATO')
  on conflict (id) do update set codice = excluded.codice;
alter table turnario_link_privato enable row level security;
revoke all on turnario_link_privato from anon, authenticated;

create or replace function turnario_leggi(p_codice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select stato, aggiornato_al into r from turnario_link_privato where codice = p_codice;
  if not found then return null; end if;
  return jsonb_build_object('stato', r.stato, 'aggiornato_al', r.aggiornato_al);
end $$;

create or replace function turnario_scrivi(p_codice text, p_stato jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from turnario_link_privato where codice = p_codice) then
    return false;
  end if;
  update turnario_link_privato set stato = p_stato, aggiornato_al = now() where codice = p_codice;
  return true;
end $$;

create or replace function turnario_cambia_codice(p_vecchio text, p_nuovo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update turnario_link_privato set codice = p_nuovo where codice = p_vecchio;
  return found;
end $$;
```

Il `CODICE-SEGRETO-GENERATO` viene generato alla consegna; per rigenerarlo:
SQL Editor -> `select turnario_cambia_codice('vecchio', 'nuovo');` e si
distribuisce il nuovo link (tutti i vecchi link smettono di funzionare).

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
