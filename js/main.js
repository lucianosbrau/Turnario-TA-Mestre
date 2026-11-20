import * as ui from "./ui.js";
import * as lock from "./lock.js";

async function gestisciAccesso() {
  const box = document.getElementById("blocco");
  const testo = document.getElementById("blocco-testo");
  const form = document.getElementById("blocco-form");
  const input = (tipo, placeholder) =>
    `<input type="${tipo}" id="blocco-pass" placeholder="${placeholder}" autocomplete="current-password">
     <button id="blocco-ok">Entra</button>`;
  if (!lock.haPassword()) {
    testo.textContent = "Primo avvio: scegli una password di accesso per questa app (minimo 4 caratteri).";
    form.innerHTML = input("password", "Password") + `<input type="password" id="blocco-pass2" placeholder="Ripeti la password">`;
  } else {
    testo.textContent = "Inserisci la password di accesso.";
    form.innerHTML = input("password", "Password");
  }
  box.style.display = "flex";
  const apri = () => { box.style.display = "none"; };
  form.querySelector("#blocco-ok").addEventListener("click", async () => {
    const p = form.querySelector("#blocco-pass").value;
    try {
      if (!lock.haPassword()) {
        const p2 = form.querySelector("#blocco-pass2").value;
        if (p.length < 4) { testo.textContent = "Password troppo corta (minimo 4 caratteri)."; return; }
        if (p !== p2) { testo.textContent = "Le due password non coincidono."; return; }
        await lock.impostaPassword(p);
        apri();
      } else if (await lock.verificaPassword(p)) {
        apri();
      } else {
        testo.textContent = "Password errata.";
      }
    } catch (e) { testo.textContent = e.message; }
  });
  form.querySelector("#blocco-pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") form.querySelector("#blocco-ok").click();
  });
}

// l'app resta ferma dietro la schermata di blocco finche' la password non e' data
gestisciAccesso().then(() => {
  ui.init();
  ui.bindPresenze();
});

// Registrazione service worker: aggiorna sempre all'ultima versione
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // controlla se stesso a ogni apertura, cosi' una nuova versione arriva subito
      reg.update();
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // c'e' una versione nuova: la attiviamo subito, bypassando la cache
            nw.postMessage("SKIP_WAITING");
          }
        });
      });
    });
  });
}
