// Unit test del lucchetto della password del dispositivo (js/lock.js).
const lock = await import(process.env.LOCK_BUNDLE || '/tmp/lock-bundle.mjs');

const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

ok(lock.haPassword() === false, '(1) nessuna password all\'inizio');

await lock.impostaPassword('test1234');
ok(lock.haPassword() === true, '(2) password impostata');
ok((await lock.verificaPassword('test1234')) === true, '(2b) password corretta accettata');
ok((await lock.verificaPassword('SBAGLIATA')) === false, '(2c) password sbagliata rifiutata');
ok(!(await lock.verificaPassword('') ), '(2d) password vuota rifiutata');

let cambioOk = true;
try { await lock.cambiaPassword('SBAGLIATA', 'nuova123'); cambioOk = false; } catch { cambioOk = cambioOk && true; }
ok(cambioOk, '(3) cambio con vecchia sbagliata rifiutato');
ok((await lock.verificaPassword('test1234')) === true, '(3b) la vecchia password resta valida dopo il tentativo fallito');

let lanciato = false;
try { await lock.cambiaPassword('test1234', '4567'); } catch { lanciato = true; }
ok(!lanciato, "(4) cambio con vecchia giusta riuscito (nuova '4567')");
ok((await lock.verificaPassword('4567')) === true, '(4b) nuova password valida');
ok((await lock.verificaPassword('test1234')) === false, "(4c) vecchia non valida piu'");
// BUG TROVATO E CORRETTO: nuova password troppo corta NON deve cancellare la vecchia
let cortaNuovaRifiutata = false;
try { await lock.cambiaPassword('4567', '12'); } catch { cortaNuovaRifiutata = true; }
ok(cortaNuovaRifiutata, "(4d) cambio con nuova troppo corta rifiutato");
ok((await lock.verificaPassword('4567')) === true, "(4e) dopo il rifiuto la password precedente resta valida (non si resta senza lucchetto)");

lock.rimuoviPassword();
ok(lock.haPassword() === false, '(5) rimozione password');

// password troppo corta rifiutata
let cortaRifiutata = false;
try { await lock.impostaPassword('abc'); } catch { cortaRifiutata = true; }
ok(cortaRifiutata, "(6) password piu' corta di 4 caratteri rifiutata");

// con "sostituisci=true" la sovrascrittura di una password esistente e' vietata
lock.rimuoviPassword();
await lock.impostaPassword('iniziale');
let vietata = false;
try { await lock.impostaPassword('altra', true); } catch { vietata = true; }
ok(vietata, "(6b) impostaPassword(_, true) rifiuta se la password esiste gia'");
ok((await lock.verificaPassword('iniziale')) === true, '(6c) la password originale resta');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
