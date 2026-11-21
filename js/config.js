// Configurazione dell'applicazione.
// Le due costanti qui sotto vanno aggiornate insieme a ogni modifica importante.
export const APP_VERSION = "1.4.1";

// Anno di default al primo avvio ( cambiabile in alta pagina e memorizzato ).
export const ANNO_DEFAULT = 2027;

// Ancora del calendario perenne (verificata contro il file Excel 2026):
// 01/09/2026 = turno Diurno (D), salto turno A3.
export const ANCHOR_DATE = "2026-09-01";
export const ANCHOR_SLOT = 3;      // A3
export const ANCHOR_PHASE = "D";

// Causali disponibili nelle celle del lenzuolo.
// "RP" non viene digitata: la app la calcola dal salto turno.
// SO = Sala Operativa e R = Rinforzo contano negli effettivi della sede.
export const CAUSALI = {
  L:   { label: "Licenza",        colore: "#2e7d32" },
  Mis: { label: "Missione",       colore: "#1565c0" },
  M:   { label: "Malattia",       colore: "#c62828" },
  SO:  { label: "Sala Operativa", colore: "#6a1b9a" },
  R:   { label: "Rinforzo",       colore: "#00838f" },
  RP:  { label: "Riposo (salto turno)", colore: "#694100" },
};

// Colori dei salti turno — ripresi dal foglio Excel "Presenze 2026"
// (riga degli slot e colonne D/N di ogni coppie).
export const SLOT = ["A1","A2","A3","A4","A5","A6","A7","A8"];
export const SLOT_COLOR = {
  A1: "#aecf00",
  A2: "#fec715",
  A3: "#83caff",
  A4: "#ff9999",
  A5: "#ffd37a",
  A6: "#c9b3ff",
  A7: "#7ad3c0",
  A8: "#bfbfbf",
};

export const GRADI = ["VF","VE","VC","CS","CSE","CR","CRE"];
// Ordine di visualizzazione dei nominativi (come nel foglio Personale del file Excel:
// prima i gradi apicali, poi CS, VC, VE, VF). Dentro lo stesso grado resta l'ordine di inserimento.
export const GRADO_ORDER = ["CSE","CR","CRE","CS","VC","VE","VF"];
export const AUTISTA = ["1°","2°","3°","4°"];   // la riga AUTISTI del lenzuolo conteggia solo 3° e 4°
export const SPEC_FIELDS = ["AS","AG","SO115","PN","NBCR","SFA","SA","USAR","TAS1","TAS2","SAF"];

// Sincronizzazione online (Supabase). Questi due valori sono pubblici per
// progetto (si trovano in Impostazioni > API del pannello Supabase): non sono
// segreti. I dati restano protetti dalle regole di accesso (solo l'account
// del turno puo' leggere/scrivere la propria riga).
// Lasciarli vuoti = app solo locale, come prima.
export const SUPABASE_URL = "https://ixtvscgayclccwhfwqyw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4dHZzY2dheWNsY2N3aGZ3cXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODIyNDksImV4cCI6MjExMDc1ODI0OX0.1klLwc57ZwtKtRpJtfPF9ALcaQyzi1SHVNp_jU3NHaY";

export const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                     "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
