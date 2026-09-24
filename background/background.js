/**
 * DocenteLens - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  // Establecer configuración inicial por defecto
  chrome.storage.sync.get(["isEnabled", "triggerMode", "sensitivity", "detectText", "detectImages"], (res) => {
    const defaults = {
      isEnabled: true,
      triggerMode: "commandKey", // Tecla Comando ⌘ por defecto (ilumina el contenido IA al pulsar)
      sensitivity: "balanced",
      detectText: true,
      detectImages: true
    };

    const toSet = {};
    for (const key in defaults) {
      if (res[key] === undefined) {
        toSet[key] = defaults[key];
      }
    }

    if (Object.keys(toSet).length > 0) {
      chrome.storage.sync.set(toSet);
    }
  });

  console.log("DocenteLens instalado y listo para su uso docente.");
});
