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

  // Inyectar en pestañas ya abiertas para que funcione de inmediato sin tener que recargarlas
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "lib/heuristics-es.js",
            "lib/heuristics-en.js",
            "lib/ai-model-profiler.js",
            "lib/ai-text-detector.js",
            "lib/ai-image-detector.js",
            "content/content.js"
          ]
        }).catch(() => {});

        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content.css"]
        }).catch(() => {});
      }
    }
  });

  console.log("DocenteLens instalado e inyectado en pestañas activas.");
});
