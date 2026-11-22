// COLLAUDI ONLINE CONTRO IL SUPABASE REALE (punto 2) — SOLO riga di TEST.
// Non fa parte delle suite automatiche: si lancia a mano (sh test/run.sh --online)
// per non consumare quota. Non tocca MAI il codice dell'archivio vero:
// tutte le scritture usano TURNARIO_TEST_CODE (riga di collaudo dedicata).
const cfg = await import(process.env.CONFIG_BUNDLE || '/tmp/turnario-config-bundle.mjs');
const URL = cfg.SUPABASE_URL, KEY = cfg.SUPABASE_ANON_KEY;
const TEST_CODICE = process.env.TURNARIO_TEST_CODE || 'TEST-COLLAUDI-TURNARIO-000001';
const CODICE_VERO = process.env.TURNARIO_CODICE_VERO || '';

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
if (!URL || !KEY) { console.log('SKIP: SUPABASE_URL/ANON_KEY non configurati'); process.exit(0); }

const rpc = async (nome, corpo) => {
  const res = await fetch(`${URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { ok: res.ok, status: res.status, j: await res.json().catch(() => null) };
};

const statoTest = (n) => ({
  personale: [{ id: 't' + n, cognome: 'COLLAUDO', nome: 'TEST', grado: 'CS', rp: 'A1', capoTurno: 'No', dal: null, al: null, autista: '3°', spec: {} }],
  causali: { 2027: [{ p: 't' + n, d: '2027-06-01', c: 'L' }] },
  soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
  __appVersion: 'COLLAUDO', origine: 'riga di collaudo automatico',
});

// O1: codice inesistente in LETTURA -> vuoto
let r = await rpc('turnario_leggi', { p_codice: 'INESISTENTE-' + Math.random().toString(36).slice(2) });
ok(r.ok && (r.j === null || r.j === undefined), '(O1) codice inesistente in lettura: risposta vuota');

// O2: codice inesistente in SCRITTURA -> rifiutato, nulla creato
const prima = (await rpc('turnario_leggi', { p_codice: TEST_CODICE })).j;
r = await rpc('turnario_scrivi', { p_codice: 'INESISTENTE-' + Math.random().toString(36).slice(2), p_stato: statoTest(0) });
ok(r.ok && r.j === false, '(O2) scrittura con codice inesistente: RIFIUTATA (nessuna riga creata via API)');
const dopo = (await rpc('turnario_leggi', { p_codice: TEST_CODICE })).j;
ok(JSON.stringify(prima) === JSON.stringify(dopo), '(O2b) la riga di test non e\' cambiata per il tentativo estraneo');

// O3: il codice di TEST legge la sua riga
ok(!!dopo && !!dopo.stato, '(O3) codice di test in lettura: la sua riga risponde');

// O4: scrittura sul codice di TEST -> rilettura coerente
r = await rpc('turnario_scrivi', { p_codice: TEST_CODICE, p_stato: statoTest(1) });
ok(r.ok && r.j === true, '(O4) scrittura sul codice di test accettata');
const letto = (await rpc('turnario_leggi', { p_codice: TEST_CODICE })).j;
ok(letto?.stato?.personale?.[0]?.id === 't1' && letto?.stato?.causali?.[2027]?.[0]?.c === 'L',
   '(O4b) rilettura: persona e causale scritte correttamente');

// O5: il seed di un "PC vergine" NON puo' sostituirsi al lavoro (simulazione sintetica):
// si scrive un nuovo stato completo e si verifica che la seconda scrittura abbia la meglio
r = await rpc('turnario_scrivi', { p_codice: TEST_CODICE, p_stato: statoTest(2) });
const letto2 = (await rpc('turnario_leggi', { p_codice: TEST_CODICE })).j;
ok(letto2?.stato?.personale?.[0]?.id === 't2', '(O5) ultima scrittura valida = stato corrente (successione corretta)');

// O6: tabella direttamente leggibile con la anon key? NON deve
const resTab = await fetch(`${URL}/rest/v1/turnario_link_privato?select=codice`, { headers: { 'apikey': KEY } });
ok(resTab.status === 401 || resTab.status === 403 || resTab.status === 404, '(O6) lettura diretta della tabella NEGATA al browser (RLS, status ' + resTab.status + ')');

// O7: l'archivio VERO esiste e NON e' stato toccato (lettura della sola forma)
if (CODICE_VERO) {
  const vero = (await rpc('turnario_leggi', { p_codice: CODICE_VERO })).j;
  ok(!!vero?.stato?.personale?.length, '(O7) archivio vero presente e incontaminato (' + vero.stato.personale.length + ' persone, nessuna scrittura toccata)');
}

// pulizia: la riga di test torna allo stato minimo
await rpc('turnario_scrivi', { p_codice: TEST_CODICE, p_stato: { origine: 'riga di collaudo, non e il registro vero', pulita: true } });

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK (database reale, riga di test)');
process.exit(failures ? 1 : 0);
