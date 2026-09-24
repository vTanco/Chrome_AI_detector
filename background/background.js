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

// Canal de exportación de Google Docs: el service worker de fondo no está sujeto a las restricciones de CORS de la página
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "DOCENTELENS_FETCH_GDOCS_EXPORT" && message.docId) {
    const exportUrl = `https://docs.google.com/document/d/${message.docId}/export?format=txt`;
    fetch(exportUrl, { credentials: "include" })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then(text => {
        sendResponse({ ok: true, text: text || "" });
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    return true; // Mantener canal abierto para respuesta asíncrona
  }
});
