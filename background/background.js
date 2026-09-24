/**
 * DocenteLens - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  // Establecer configuración inicial por defecto
  chrome.storage.sync.get(["isEnabled", "triggerMode", "sensitivity", "detectText", "detectImages"], (res) => {
    const defaults = {
      isEnabled: true,
      triggerMode: "altClick", // Alt + Clic sostenido por defecto (funciona perfecto en Mac y ratón)
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
