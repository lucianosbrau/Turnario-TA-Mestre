const sync = await import(process.env.SYNC_BUNDLE || '/tmp/sync-bundle.mjs');

// stub localStorage minimale per il codice link
const mem = { 'turnario-ta-sync-code': 'CODICE-LINK-TEST-1234567890' };
globalThis.location = { search: '' };
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

let rispostaCloud = null;    // cosa deve rispondere turnario_leggi
let ultimaScrittura = null;  // ultimo stato passato a turnario_scrivi

globalThis.fetch = async (url, opts) => {
  if (url.includes('turnario_leggi')) {
    return { ok: true, json: async () => rispostaCloud };
  }
  if (url.includes('turnario_scrivi')) {
    ultimaScrittura = JSON.parse(opts.body).p_stato;
    return { ok: true, json: async () => true };
  }
  return { ok: true, json: async () => ({}) };
};

const cloud = (persone, agg) => ({ stato: { personale: persone, causali: {} }, aggiornato_al: agg });
const statoLocaleBuono = () => ({ personale: [{ id: 'LAVORO' }], __aggiornatoAl: '2027-01-05T12:00:00.000Z' });
const applica = (stato) => { globalThis.__applicato = stato; };

async function scenario(nome, cloudResponse, locale, vergine, atteso) {
  globalThis.__applicato = null; ultimaScrittura = null; rispostaCloud = cloudResponse;
  const res = await sync.avvio(applica, () => locale, vergine);
  if (atteso === 'cloud') ok(!!globalThis.__applicato, nome);
  else if (atteso === 'locale') ok(!globalThis.__applicato, nome);
  else if (atteso === 'push') ok(!!ultimaScrittura, nome);
  else if (attesto === 'niente') ok(!globalThis.__applicato && !ultimaScrittura, nome);
}

// S1: dispositivo vergine + cloud con dati => vince il cloud, il seed NON viene pushato
await scenario('S1 vergine perde contro il cloud con lavoro (applica cloud, zero push)',
  cloud([{ id: 'LAVORO' }], '2027-01-01T00:00:00'), statoLocaleBuono(), true, 'cloud');
ok(!ultimaScrittura, 'S1b il seed del dispositivo vergine NON viene scritto sul cloud');

// S2: archivio locale CON lavoro piu' recente del cloud => il cloud NON si applica (il bug della funzione-vero)
await scenario('S2 locale con lavoro piu\' recente del cloud: il cloud NON si applica',
  cloud([{ id: 'VECCHIO' }], '2027-01-01T00:00:00'), statoLocaleBuono(), false, 'locale');

// S3: archivio locale CON lavoro MA cloud piu' recente (altro PC ha lavorato) => il cloud si applica (con snapshot in storico)
await scenario('S3 cloud piu\' recente (altro PC ha lavorato): il cloud si applica',
  cloud([{ id: 'NUOVO' }], '2027-06-01T00:00:00'), statoLocaleBuono(), false, 'cloud');

// S4: cloud vuoto (riga/DB nuovo) => il locale viene pushato
await scenario('S4 cloud vuoto: il locale viene pubblicato',
  null, statoLocaleBuono(), false, 'push');
await scenario('S4b risposta RPC senza stato: locale pubblicato',
  { stato: null }, statoLocaleBuono(), false, 'push');

// S5: cloud con dati + dispositivo vergine: verifica che usi la FUNZIONE di seedFresh (regressione del bug)
await scenario('S5 seedFresh come funzione che restituisce false: il cloud non si applica forzatamente',
  cloud([{ id: 'LAVORO' }], '2027-01-01T00:00:00'), statoLocaleBuono(), () => false, 'locale');
await scenario('S5b seedFresh funzione che restituisce true: il cloud si applica',
  cloud([{ id: 'LAVORO' }], '2027-01-01T00:00:00'), statoLocaleBuono(), () => true, 'cloud');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
