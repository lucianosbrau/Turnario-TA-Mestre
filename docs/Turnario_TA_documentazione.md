# Turnario Turno A – Portogruaro: documentazione di progetto

Documento aggiornato al 16 novembre 2026. Raccoglie requisiti, decisioni, struttura del file, formule, macro e stato delle verifiche.

---

## 1. Scopo del progetto

Il file `TURNARIO_TA_2026.ods` è il turnario dei Vigili del Fuoco del **Turno A di Portogruaro**: un foglio per ogni mese, personale in righe, turni G (Giorno) e N (Notte) in colonne.

Obiettivo: ottenere per il **2027** (e gli anni successivi) una copia del file in cui il calendario di ogni mese, i salti turno e i riepiloghi siano generati automaticamente, lasciando manuale solo ciò che è davvero variabile (causali, ferie).

File prodotti in questa fase:

| File | Contenuto |
|---|---|
| `Turnario_TA_2027.ods` | Foglio completo, calendario 2027 già compilato, formule e menu a discesa. **Non contiene le macro.** |
| `Macro_Turnario.bas` | Codice delle due macro, da incollare a mano in LibreOffice (vedi §8). |
| `Turnario_TA_documentazione.md` | Questo documento. |

---

## 2. Regole del turnario

### 2.1 Alternanza G/N e cadenza di 4 giorni
- I turni **G** cadono ogni 4 giorni (es. gennaio 2026: 4, 8, 12, 16, …).
- Il turno **N** cade il giorno successivo al G (5, 9, 13, 17, …).
- Nella riga dei turni l'alternanza è quindi G, N, G, N… ma le date sono sfalsate: i giorni intermedi (2 giorni su 4) non compaiono mai.

### 2.2 Salto turno (A1–A8)
- Ogni coppia G/N ha un **salto turno** codificato A1…A8: la persona associata a quel codice quel giorno **non viene a lavorare**.
- Il codice avanza di 1 a ogni coppia G/N (cioè ogni 4 giorni) e dopo A8 riparte da A1. Il ciclo completo dura quindi 32 giorni.
- G e N della stessa coppia hanno sempre lo stesso salto turno.

### 2.3 Punto di ancoraggio (fornito dall'utente)
- **3 gennaio 2027 = G, salto turno A2** (prossimo G il 7 gennaio = 3+4).
- **4 gennaio 2027 = N, salto turno A2** (prossimo N l'8 gennaio = 4+4).
- Per gli anni successivi la macro prosegue il calcolo matematicamente dall'ancora: l'utente specifica solo l'anno.

### 2.4 Formula di calcolo
Sia `d` una data e `delta = d − 3/1/2027` in giorni (può essere negativo):
- se `delta mod 4 = 0` → turno **G**, indice coppia `n = delta / 4`
- se `(delta − 1) mod 4 = 0` → turno **N**, indice coppia `n = (delta − 1) / 4`
- altrimenti nessun turno quel giorno
- salto turno = `((n + 1) mod 8) + 1` (il `+1` interno deriva dallo slot dell'ancora, A2 → posizione 1 in base zero)

### 2.5 Controllo di coerenza con il 2026
L'ancora è compatibile con il file 2026: calcolando all'indietro, il 4 gennaio 2026 (G) risulta A7, l'8 gennaio A8, il 12 gennaio A1. I valori coincidono con quelli scritti nel file 2026 (CAVALLO F. = A7, CELEGATO M. = A8, FRESCH M. = A1).

---

## 3. Personale e associazione persona → salto turno

Il 2026 ha **7 persone ma 8 slot**: lo slot **A2 non è assegnato a nessuno**. Per questo nel 2026 mancano le celle A2 (es. gennaio, coppia G16/N17 senza valore).

| Slot | Persona | Qualifica |
|---|---|---|
| A1 | FRESCH M. | VC |
| A2 | *(vuoto)* | – |
| A3 | BIASIN M. | VC |
| A4 | MELI D. | CS |
| A5 | DI LORENZO L. | VE |
| A6 | ASCANI D. | VP |
| A7 | CAVALLO F. | VP |
| A8 | CELEGATO M. | CSE |

Ordine delle righe nei fogli mensili: CELEGATO M., MELI D., BIASIN M., FRESCH M., DI LORENZO L., CAVALLO F., ASCANI D.

**Regola decisa:** se uno slot non ha una persona associata, la macro non scrive nulla in quella coppia di turni.

L'associazione è fissa (stesso organico anno dopo anno) e vive nel foglio **Associazioni**.

---

## 4. Registro delle decisioni

| # | Decisione |
|---|---|
| 1 | Struttura invariata: un foglio per mese. |
| 2 | I fogli si chiamano **solo con il nome del mese** (`Gennaio`, `Febbraio`, …), senza l'anno, per semplificare i riferimenti tra fogli. |
| 3 | Macro **"Seleziona anno di riferimento"**: si lancia **una sola volta** su un file appena copiato. Cancella le causali dalla griglia e ricompila date, G/N e salti turno per l'anno scelto. |
| 4 | Macro **"Cambio salto turno"**: chiede persona, nuovo salto e mesi su cui applicarlo. **Non cancella le causali**: svuota soltanto i vecchi salti della persona e scrive i nuovi. |
| 5 | Foglio **Associazioni** persona ↔ salto; slot senza persona = cella non compilata. |
| 6 | Il salto turno di una singola persona per un singolo turno si può modificare a mano dal menu a discesa, senza effetti sugli altri fogli. |
| 7 | **Colore:** stesso colore unico per qualsiasi valore A1–A8; nessun colore per gli altri codici. |
| 8 | Il menu a discesa ammette 18 valori, **prima i codici nuovi, poi i salti**: `L, Mis, Cor, Rin, Mal, P, 1, 2, A, B, A1…A8`. |
| 9 | Quattro colonne di riepilogo per persona dalla colonna D: Aut APS, Aut ABP, Uomo APS, Uomo ABP. Il conteggio somma le occorrenze nell'intera riga del mese (turni G e N insieme). |
| 10 | Il vecchio riquadro "TURNI AUTISTI" del 2026 è **eliminato** e sostituito dalle nuove colonne. |
| 11 | Blocco ferie sempre a partire dalla colonna **AB**, qualunque sia il numero di turni del mese. |
| 12 | Il residuo ferie dell'anno precedente è **diviso in due colonne** (Giorno e Notte), per non sommarlo due volte. |
| 13 | I residui e le ferie spettanti si compilano a mano **solo a gennaio**; da febbraio le formule partono dal mese precedente. |

### 4.1 Significato dei codici nel menu

| Codice | Significato |
|---|---|
| L | Licenza (ferie) |
| Mis | Missione |
| Cor | Corso |
| Rin | Rinforzo |
| Mal | Malattia |
| P | Permesso |
| 1 | Autista APS |
| 2 | Autista ABP |
| A | Uomo APS |
| B | Uomo ABP |
| A1–A8 | Salto turno |

---

## 5. Struttura del file `Turnario_TA_2027.ods`

### 5.1 Fogli
`Associazioni`, `Gennaio`, `Febbraio`, `Marzo`, `Aprile`, `Maggio`, `Giugno`, `Luglio`, `Agosto`, `Settembre`, `Ottobre`, `Novembre`, `Dicembre`.

### 5.2 Foglio Associazioni

| Cella | Contenuto |
|---|---|
| A1 | Titolo "ASSOCIAZIONE PERSONA - SALTO TURNO" |
| A3:C3 | Intestazioni SLOT / COGNOME NOME / QUALIFICA |
| A4:C11 | Le otto righe A1…A8 con nome e qualifica (A2 vuota) |
| A14 / **B14** | "ANNO CORRENTE" e il valore dell'anno (2027). **B14 è letta dai titoli dei fogli e dalla macro "Cambio salto turno".** |

### 5.3 Foglio mensile (layout, numerazione di riga/colonna come in LibreOffice)

| Zona | Posizione | Contenuto |
|---|---|---|
| Titolo | A1 | Formula con nome del mese e anno (vedi §7.1) |
| Intestazioni | riga 3 | B QUALIFICA, C COGNOME NOME, D:G riepiloghi, AB:AG ferie |
| Riga turno | riga 4, da I a X | `G` / `N` |
| Riga giorno | riga 5, da I a X | numero del giorno |
| Riga data | riga 6, da I a X | data completa, formato `DD/MM` |
| Persone | righe 8–17 | 7 righe usate + 3 libere per aggiunte |
| Griglia turni | **I8:X17** | 16 colonne fisse (massimo possibile in un mese) |
| Cuscinetto | Y:AA | vuote, mantengono il blocco ferie ancorato ad AB |

### 5.4 Colonne

| Colonna | Contenuto |
|---|---|
| B | Qualifica |
| C | Cognome e nome |
| D | RIEP. AUT APS (conteggio di "1") |
| E | RIEP. AUT ABP (conteggio di "2") |
| F | RIEP. UOMO APS (conteggio di "A") |
| G | RIEP. UOMO ABP (conteggio di "B") |
| I:X | Griglia turni del mese (fino a 16 colonne) |
| **AB** | FERIE RES. GIORNO (formula) |
| **AC** | FERIE RES. NOTTE (formula) |
| AD | RESIDUO PREC. GIORNO (manuale, solo gennaio) |
| AE | RESIDUO PREC. NOTTE (manuale, solo gennaio) |
| AF | FERIE SPETT. GIORNO (manuale, solo gennaio) |
| AG | FERIE SPETT. NOTTE (manuale, solo gennaio) |

**Perché AB è sempre AB:** la griglia ha larghezza fissa (I…X = 16 colonne) anche nei mesi con 14 o 15 turni (nel 2026 variavano da 14 a 16). Le colonne non usate restano vuote, quindi il blocco ferie non si sposta mai.

### 5.5 Menu a discesa e colore
- **Menu a discesa:** area `I8:X17` di ogni mese, lista non ordinata dei 18 valori, celle vuote ammesse. Il menu è per cella: modificare una cella non tocca gli altri fogli.
- **Colore:** stile di cella `SaltoTurnoStyle`, sfondo `#FFD966` (giallo/ambra), applicato con formattazione condizionale a `I8:X17` quando la cella vale A1…A8. I codici L, Mis, Cor, Rin, Mal, P, 1, 2, A, B non hanno colore. *(Vedi però §10: nel test di rendering il colore non risulta applicato.)*

---

## 6. Come funziona il ciclo ferie

Per ogni persona (riga):

- **Gennaio:** `AB = AF + AD − (numero di G con "L")` e `AC = AG + AE − (numero di N con "L")`
  - cioè: ferie spettanti dell'anno + residuo dell'anno precedente, meno le licenze godute nel mese, separatamente per Giorno e per Notte.
- **Febbraio…Dicembre:** `AB = AB del mese precedente − (G con "L" del mese)` e `AC = AC del mese precedente − (N con "L" del mese)`.

Le celle AD:AG vuote sono trattate come zero.

Nota rispetto alla richiesta iniziale: nel primo messaggio l'utente aveva indicato AD come residuo unico e AE/AF come giorni/notti spettanti, con AD sommato sia a G sia a N. La versione finale (decisione n. 12) separa il residuo in AD (giorno) e AE (notte) e sposta le ferie spettanti in AF e AG.

---

## 7. Formule nel file (riga 8 = prima persona; le altre righe sono identiche con numero di riga diverso)

### 7.1 Titolo (A1)
```
="TURNARIO TURNO A - PORTOGRUARO - GENNAIO " & Associazioni.$B$14
```
Compone il testo fisso, il nome del mese e l'anno letto da `Associazioni!B14`. Il mese è scritto direttamente nella formula di ciascun foglio.

### 7.2 Riepiloghi (colonne D, E, F, G)
```
D8: =COUNTIF(I8:X8;"1")
E8: =COUNTIF(I8:X8;"2")
F8: =COUNTIF(I8:X8;"A")
G8: =COUNTIF(I8:X8;"B")
```
Contano quante celle della riga della persona, nell'intera griglia (G e N insieme), valgono esattamente il codice indicato. `"A"` conta solo "Uomo APS" e **non** i salti A1…A8 (che sono testi diversi).

### 7.3 Ferie – Gennaio
```
AB8: =AF8+AD8-COUNTIFS(I4:X4;"G";I8:X8;"L")
AC8: =AG8+AE8-COUNTIFS(I4:X4;"N";I8:X8;"L")
```
`COUNTIFS` conta le colonne in cui **contemporaneamente** la riga 4 vale "G" (o "N") e la cella della persona vale "L".

### 7.4 Ferie – Febbraio…Dicembre (esempio Febbraio)
```
AB8: =Gennaio.AB8-COUNTIFS(I4:X4;"G";I8:X8;"L")
AC8: =Gennaio.AC8-COUNTIFS(I4:X4;"N";I8:X8;"L")
```
Marzo punta a Febbraio, Aprile a Marzo, e così via. Per questo i fogli hanno nomi fissi senza anno.

---

## 8. Le macro (`Macro_Turnario.bas`)

### 8.1 Installazione
1. Aprire `Turnario_TA_2027.ods` in LibreOffice Calc.
2. **Strumenti → Macro → Modifica macro…**
3. Nella libreria **My Macros / documento → Standard** creare un nuovo modulo (es. `TurnarioMacros`) e incollare l'intero contenuto di `Macro_Turnario.bas`.
4. Salvare il file. Le macro compaiono in **Strumenti → Macro → Esegui macro**.

Le macro lavorano su `ThisComponent`, cioè sul documento in cui sono salvate.

### 8.2 Costanti (le "variabili" di configurazione)

Gli indici sono **base zero** (come nell'API di LibreOffice): colonna 0 = A, riga 0 = riga 1.

| Costante | Valore | Significato |
|---|---|---|
| `ANCHOR_YEAR` | 2027 | Anno dell'ancora |
| `ANCHOR_MONTH` | 1 | Mese dell'ancora |
| `ANCHOR_DAY` | 3 | Giorno dell'ancora (turno G) |
| `ANCHOR_SLOT` | 2 | Salto turno dell'ancora (A2) |
| `GRID_FIRST_COL` | 8 | Prima colonna della griglia = **I** |
| `N_GRID_COLS` | 16 | Numero di colonne della griglia (I…X) |
| `ROW_GN` | 3 | Riga 4: lettere G/N |
| `ROW_DAY` | 4 | Riga 5: numero del giorno |
| `ROW_DATE` | 5 | Riga 6: data completa |
| `FIRST_PERSON_ROW` | 7 | Riga 8: prima persona |
| `MAX_PERSON_ROWS` | 10 | Righe persona disponibili (8–17) |
| `COL_NOME` | 2 | Colonna C: cognome e nome |
| `COL_ANNO_ROW` | 13 | Riga 14 di Associazioni |
| `COL_ANNO_COL` | 1 | Colonna B di Associazioni → cella **B14** (anno corrente) |
| `MonthNames(1 To 12)` | array di stringhe | Nomi dei fogli: Gennaio…Dicembre |

Se si aggiungono righe di persone oltre la 17 o si cambia il layout, queste costanti vanno aggiornate. Per cambiare ancora l'ancora: modificare le quattro costanti `ANCHOR_*`.

### 8.3 Variabili importanti usate dentro le routine

| Variabile | Significato |
|---|---|
| `base` | Numero seriale della data dell'ancora (3/1/2027) |
| `dPrimo`, `dUltimo` | Seriali del primo e dell'ultimo giorno del mese |
| `k` | **Indice di coppia G/N** rispetto all'ancora: `k = 0` è la coppia 3–4 gennaio 2027; `k` negativo = prima, positivo = dopo |
| `dG`, `dN` | Date del G (`base + 4k`) e del N (`dG + 1`) della coppia `k` |
| `slotG`, `slotN`, `slotK` | Salto turno (1–8) della coppia `k` |
| `col` | Colonna di destinazione corrente nella griglia |
| `personaG`, `personaN` | Nome associato allo slot |
| `rG`, `rN`, `rPersona` | Indice di riga della persona nel foglio |
| `anno` | Anno su cui lavorare |
| `nomePersona`, `nuovoSlot`, `mesiCSV` | Parametri di "Cambio salto turno" |

### 8.4 Funzioni e routine

| Nome | Cosa fa |
|---|---|
| `InitMonthNames` | Riempie l'array `MonthNames`. |
| `AnchorSerial()` | Restituisce il seriale della data d'ancoraggio. |
| `SlotForPairIndex(k)` | Restituisce lo slot (1–8) della coppia `k` con la formula `((ANCHOR_SLOT−1+k) Mod 8 + 8) Mod 8 + 1`. Il doppio `Mod` gestisce i `k` negativi. |
| `PersonForSlot(oDoc, slotNum)` | Cerca `"A" & slotNum` in Associazioni (righe 4–11, colonna A) e restituisce il nome in colonna B; stringa vuota se non c'è. |
| `TrovaRigaPersona(oSheet, nome)` | Cerca il nome in colonna C nelle righe 8–17; restituisce l'indice di riga o `-1`. |
| `FormatoData(oDoc)` | Restituisce (creandolo se serve) il formato numerico `DD/MM`. |
| `CompilaMese(oDoc, meseNum, anno)` | Cuore della generazione: **(1)** svuota la griglia I8:X17 e le tre righe di intestazione I4:X6; **(2)** calcola primo e ultimo giorno; **(3)** parte da `k = ((dPrimo−base)\4) − 2` (margine di sicurezza all'indietro) e itera; **(4)** per ogni G/N che cade nel mese scrive lettera, giorno, data e, se lo slot ha una persona e la persona è nel foglio, scrive `A<slot>` nella sua riga; **(5)** applica il formato `DD/MM`. |
| `SelezionaAnnoDiretto(oDoc, anno)` | Versione senza finestre: esegue `CompilaMese` per i 12 mesi e scrive l'anno in `Associazioni!B14`. |
| **`SelezionaAnnoRiferimento()`** | **Macro utente.** Chiede l'anno con una finestra di input, controlla che sia numerico, esegue `SelezionaAnnoDiretto` su `ThisComponent` e mostra un messaggio. |
| `NumeroMese(nome)` | Converte il nome del mese (senza distinzione maiuscole/minuscole) nel numero 1–12; 0 se non valido. |
| `TrovaColonnaData(oSheet, d)` | Trova la colonna della griglia la cui riga data contiene il seriale `d`; `-1` se assente. |
| `RicompilaSaltoPersonaMese(...)` | Per un mese: **(1)** cancella nella riga della persona solo le celle che contengono `A<numero>` (le causali restano); **(2)** scorre le coppie `k` e, dove lo slot è `nuovoSlot`, scrive `A<nuovoSlot>` nelle colonne di G e N di quel mese. |
| `CambioSaltoTurnoDiretto(...)` | Legge l'anno da `Associazioni!B14`, divide l'elenco dei mesi (separati da virgola), richiama `RicompilaSaltoPersonaMese` per ciascuno e poi aggiorna Associazioni (vedi §10). |
| **`CambioSaltoTurno()`** | **Macro utente.** Chiede in sequenza: nome (come scritto nei fogli), nuovo slot (1–8), mesi (es. `Marzo,Aprile`). Verifica che l'anno in B14 non sia 0 (altrimenti chiede di lanciare prima la macro dell'anno). |

### 8.5 Sequenza operativa annuale

1. Copiare il file (es. `Turnario TA 2028.ods`).
2. Eseguire **Seleziona anno di riferimento** → inserire 2028.
3. Compilare a mano, in gennaio, AD:AG con residui e ferie spettanti.
4. Durante l'anno: causali dal menu a discesa; per cambiare slot di una persona su certi mesi usare **Cambio salto turno**.

---

## 9. Verifiche eseguite (e limiti)

**Verificato:**
- Calendario 2027: algoritmo controllato sul mese di gennaio (3 G A2, 4 N A2, 7 G A3, … 31 G A1) e controllato a campione su dicembre; coerenza con le date 2026 (§2.5).
- Posizione dei salti nella griglia di gennaio (es. A3 di BIASIN su 7–8, A4 di MELI su 11–12, A8 di CELEGATO su 27–28).
- Formule di riepilogo e ferie presenti e senza errori di riferimento nei fogli Gennaio, Febbraio e Dicembre.
- Menu a discesa con i 18 valori nell'ordine concordato.

**Non verificato:**
- **Esecuzione delle macro.** L'ambiente in cui il file è stato costruito non esegue le macro Basic (anche una macro con errore voluto risultava "riuscita"), e non è stato possibile incorporarle nel file in modo riconoscibile. Il codice è stato riletto riga per riga ma **mai eseguito**.
- Il comportamento dei fogli di maggio–novembre oltre ai controlli a campione.

---

## 10. Problemi noti e punti aperti

### 10.1 Difetti riscontrati nel file consegnato (test di rendering del 16/11/2026)
1. **Il colore dei salti turno non compare.** Convertendo il file in PDF, le celle A1…A8 appaiono senza sfondo. La regola di formattazione condizionale esiste (stile `SaltoTurnoStyle`, `#FFD966`, area `I8:X17`), ma ha come cella base `Associazioni.A1`, il che probabilmente sfasa il riferimento relativo `I8`. Da correggere: rimpostare la regola dalla cella `I8` di ciascun foglio.
2. **La riga data mostra `###`**: le colonne della griglia (circa 9 mm) sono troppo strette per `DD/MM`. Da allargare o ridurre il carattere.
3. **Intestazioni troncate** ("QUALIFI", "RIEP. AU", "ANNO CORR"): servono larghezze maggiori, testo a capo o intestazioni più brevi.
4. **Le tre righe persona libere (14–16) mostrano 0** nei riepiloghi, perché le formule sono presenti anche dove non c'è nome. Possibile fix: `=SE(C14="";"";CONTA.SE(...))`.
5. **Il file è stato rigenerato da zero**, non copiato dal 2026: la formattazione grafica originale (stili, immagine presente nel file 2026, eventuali celle unite, il foglio di maggio 2026 con colonne extra) non è garantita identica. Da confrontare a vista.

### 10.2 Possibili problemi nel codice delle macro (da cercare durante il test)
- **`CambioSaltoTurnoDiretto` cancella la qualifica.** Quando sposta la persona nello slot nuovo svuota le colonne B **e C** della vecchia riga di Associazioni, ma riscrive solo il nome in B: la qualifica (VC, CS…) va persa. La variabile `qualifica` è dichiarata ma non usata.
- **Nessun controllo di conflitto:** se il nuovo slot è già assegnato a un'altra persona, viene sovrascritto senza avviso, e le celle `A<slot>` dell'altra persona nei mesi scelti non vengono rimosse.
- **Sintassi:** vanno verificati in LibreOffice l'uso di `Global Const` (potrebbe richiedere `Public Const`), le chiamate a `Sub` con parentesi e più argomenti, e `DateSerial(anno, 13, 1)` per dicembre.
- L'inserimento di persona, slot e mesi avviene con **tre finestre di testo**, non con un menu di scelta: è l'implementazione più semplice del requisito "mi viene chiesto a chi cambiare e in quali fogli".

### 10.3 Domande ancora aperte
1. **"Cambio salto turno" cambia anche il default?** Oggi aggiorna in modo permanente il foglio Associazioni (quindi anche il calendario dell'anno prossimo). Se invece il cambio deve valere solo per i mesi scelti, va gestito diversamente. *Nessuna risposta ancora.*
2. **Pulizia delle ferie a inizio anno:** "Seleziona anno" cancella solo la griglia I8:X17. Le colonne AD:AG (residui e ferie spettanti) di gennaio restano con i valori dell'anno precedente fino a compilazione manuale: si vuole che la macro le svuoti?
3. **Persone non in organico:** non è prevista una gestione di arrivi/uscite (le 3 righe libere servono a questo, ma l'associazione slot ↔ nome va aggiornata a mano o con "Cambio salto turno").
4. **Riga "PERSONALE DI RINFORZO"** presente nel file 2026 (sotto l'elenco): non è stata riprodotta nel file 2027.
5. L'utente ha accennato ad "altre cose" da aggiungere in seguito, non ancora specificate.

---

## 11. Prossimi passi consigliati
1. Correggere i difetti §10.1 (formattazione condizionale, larghezze, righe vuote).
2. Incollare le macro in LibreOffice e provarle su una copia: prima *Seleziona anno* (2027, poi 2028), poi *Cambio salto turno* su un mese.
3. Sistemare i punti di §10.2 in base all'esito del test.
4. Rispondere alle domande aperte di §10.3.
