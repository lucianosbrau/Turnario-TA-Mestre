import * as ui from "./ui.js";

ui.init();
ui.bindPresenze();

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
