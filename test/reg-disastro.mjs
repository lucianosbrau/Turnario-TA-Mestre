// TEATRO DEL DISASTRO: cronologia completa multi-dispositivo.
// Simula PC-A e PC-B che lavorano con cadute di rete, un PC vergine (cache
// pulita) e il ritorno online. E' il copione che ha scovato i bug peggiori
// (perdita dati, seed che sovrascrive, cloud regredito): lo congelo qui.
const sync = await import(process.env.SYNC_BUNDLE || '/tmp/sync-bundle.mjs');

globalThis.location = { search: '' };
globalThis.TURNARIO_POLL_MS = 99 * 60 * 1000;   // polling silenzioso: il copione guida gli eventi
const mem = { 'turnario-ta-sync-code': 'CODICE-LINK-TEST-1234567890' };
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- cloud simulato
let cloud = null;
let offline = false;
let scritture = [];
globalThis.fetch = async (url, opts) => {
  if (offline) throw new Error('offline');
  if (url.includes('turnario_leggi')) return { ok: true, json: async () => cloud };
  if (url.includes('turnario_scrivi')) {
    const st = JSON.parse(opts.body).p_stato;
    console.log('   [scrittura] persone:', st.personale.map(p => p.cognome).join(','), '| causali:', (st.causali[2027] || []).map(c => c.c).join(','));
    scritture.push(st);
    cloud = { stato: JSON.parse(JSON.stringify(st)), aggiornato_al: new Date().toISOString() };
    return { ok: true, json: async () => true };
  }
  return { ok: true, json: async () => ({}) };
};

// ---- i due "PC": ogni PC ha il proprio archivio (come il localStorage del browser)
const persona = (id, c) => ({ id, cognome: c, nome: 'X', grado: 'CS', rp: 'A1', capoTurno: 'No', dal: null, al: null, autista: '3°', spec: { SO115: 'Si' } });
const PC_A = {
  persone: [persona('a1', 'ROSSI'), persona('a2', 'VERDI')],
  causali: { 2027: [{ p: 'a1', d: '2027-01-15', c: 'L' }] },
  __aggiornatoAl: '2027-01-14T08:00:00.000Z',
  __cloudVisto: '',
};
const PC_B = { persone: [persona('s1', 'SEED')], causali: {}, __aggiornatoAl: '', __cloudVisto: '' };
let pcCorrente = null;           // serve al callback onCloudVisto
let applicatoCorrente = null;

const archivio = (pc) => () => ({ personale: pc.persone, causali: pc.causali, __aggiornatoAl: pc.__aggiornatoAl || '', __cloudVisto: pc.__cloudVisto || '' });
sync.onCloudVisto((v) => { if (pcCorrente) pcCorrente.__cloudVisto = v; });
sync.onBusy(() => false);
const applica = (stato) => { applicatoCorrente = stato; };

// ======================= COPIONE =======================

// SCENA 1: il cloud contiene il lavoro gia' spedito da PC-A (copia profonda!)
cloud = {
  stato: JSON.parse(JSON.stringify({ personale: PC_A.persone, causali: PC_A.causali })),
  aggiornato_al: '2027-01-20T08:00:00.000Z',
};

// SCENA 2: PC-A apre e va OFFLINE prima di potersi aggiornare, poi compila una Mis
offline = true;
pcCorrente = PC_A; applicatoCorrente = null; scritture = [];
await sync.avvio(applica, archivio(PC_A), () => false);   // scarica fallisce: resta col proprio archivio
PC_A.causali[2027].push({ p: 'a2', d: '2027-02-10', c: 'Mis' });
PC_A.__aggiornatoAl = '2027-02-11T09:30:00.000Z';
// il salvataggio fallisce (offline): la modifica resta nel browser di PC-A
try { sync.programmaPush(null, archivio(PC_A)); await sleep(3200); } catch {}
ok(scritture.length === 0, '(S2) PC-A offline: zero scritture al cloud, il lavoro resta nel suo browser');

// SCENA 3: PC-B vergine apre (rete presente): deve ricevere IL LAVORO di PC-A
offline = false;
pcCorrente = PC_B; applicatoCorrente = null;
await sync.avvio(applica, archivio(PC_B), () => true);
ok(applicatoCorrente && applicatoCorrente.personale.some(p => p.cognome === 'ROSSI'),
   '(S3) PC-B vergine riceve il lavoro di PC-A (il seed NON ha vinto)');
ok(applicatoCorrente && applicatoCorrente.personale.every(p => p.cognome !== 'SEED'),
   '(S3b) il seed di PC-B è stato sostituito dal cloud');
ok(scritture.length === 0, '(S3c) il seed di PC-B non è stato spinto sul cloud (zero scritture)');

// SCENA 4: PC-B compila una SO e la spedisce
offline = false;
const scaricatoDaB = JSON.parse(JSON.stringify(applicatoCorrente));
PC_B.persone = scaricatoDaB.personale;      // B ora ha l'archivio scaricato dal cloud
PC_B.causali = scaricatoDaB.causali;
PC_B.causali[2027].push({ p: 'a1', d: '2027-02-20', c: 'SO' });
PC_B.__aggiornatoAl = '2027-02-21T10:00:00.000Z';
scritture = [];
await sync.programmaPush(null, archivio(PC_B));
await sleep(3200);
const scrittoDaB = scritture[scritture.length - 1];
ok(scrittoDaB && (scrittoDaB.causali[2027] || []).some(c => c.d === '2027-02-20' && c.c === 'SO'),
   '(S4) la SO compilata da PC-B arriva al cloud');
ok(scrittoDaB && (scrittoDaB.causali[2027] || []).some(c => c.d === '2027-01-15' && c.c === 'L'),
   '(S4b) la L storica di PC-A resta nel cloud dopo la scrittura di PC-B');

// SCENA 5: PC-A torna online e apre: la sua Mis NON SPEDITA deve arrivare al
// cloud SENZA cancellare la SO che PC-B ha aggiunto nel frattempo
offline = false;
pcCorrente = PC_A; applicatoCorrente = null; scritture = [];
await sync.avvio(applica, archivio(PC_A), () => false);
await sleep(3600);   // eventuale debounce del push di emergenza
const finale = cloud.stato;
const causFin = (finale.causali[2027] || []);
ok(causFin.some(c => c.d === '2027-02-10' && c.c === 'Mis'), '(S5) la Mis di PC-A scritta offline arriva al cloud');
ok(causFin.some(c => c.d === '2027-02-20' && c.c === 'SO'), '(S5b) la SO di PC-B NON e\' stata cancellata dal ritorno di PC-A');
ok(causFin.some(c => c.d === '2027-01-15' && c.c === 'L'), '(S5c) la L storica esiste ancora');

// SCENA 6: nessuna perdita complessiva
ok(finale.personale.some(p => p.cognome === 'ROSSI') && finale.personale.some(p => p.cognome === 'VERDI'),
   '(S6) nessun nominativo perso nel percorso completo');
ok(causFin.length === 3, '(S6b) nel cloud finale ci sono esattamente le 3 causali scritte (trovate: ' + causFin.length + ')');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK: cronologia completa multi-dispositivo senza perdite');
process.exit(failures ? 1 : 0);
