// Configurazione dell'applicazione.
// Le due costanti qui sotto vanno aggiornate insieme a ogni modifica importante.
export const APP_VERSION = "0.1.0";

// Ancora del calendario perenne (verificata contro il file Excel 2026):
// 01/09/2026 = turno Diurno (D), salto turno A3.
// Da qui si genera il calendario di qualsiasi anno (passato o futuro).
export const ANCHOR_DATE = "2026-09-01";
export const ANCHOR_SLOT = 3;      // A3
export const ANCHOR_PHASE = "D";

// Causali disponibili nelle celle del lenzuolo.
// "RP" non viene digitata: la app la calcola dal salto turno.
// SO = Sala Operativa e R = Rinforzo contano negli effettivi della sede.
export const CAUSALI = {
  L:   { label: "Licenza",   colore: "#2e7d32" },
  Mis: { label: "Missione",  colore: "#1565c0" },
  M:   { label: "Malattia",  colore: "#c62828" },
  SO:  { label: "Sala Operativa", colore: "#6a1b9a" },
  R:   { label: "Rinforzo",  colore: "#00838f" },
  RP:  { label: "Riposo (salto turno)", colore: "#b45309" },
};

export const SLOT = ["A1","A2","A3","A4","A5","A6","A7","A8"];
export const GRADI = ["VF","VE","VC","CS","CSE","CR","CRE"];
export const AUTISTA = ["1","2","3","4"];
export const SPEC_FIELDS = ["AS","AG","SO115","PN","NBCR","SFA","SA","USAR","TAS1","TAS2","SAF"];

export const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                     "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

// Presenza = cella vuota, SO o R (ai fini del conteggio effettivi di sede).
export const PRESENTI = ["", "SO", "R"];
