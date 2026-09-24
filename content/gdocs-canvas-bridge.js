/**
 * DocenteLens - Google Docs Canvas Bridge
 * Se ejecuta en el contexto de página (MAIN world) para interceptar
 * el renderizado en canvas de Google Docs (CanvasRenderingContext2D.prototype.fillText)
 * y acceder a las estructuras internas de texto (window.DOCS_modelChunk).
 */

(function () {
  if (window._docenteLensCanvasBridgeInitialized) return;
  window._docenteLensCanvasBridgeInitialized = true;

  const capturedChunks = [];
  const seenChunks = new Set();
  let fullCapturedText = "";
  let lastBroadcastLength = 0;

  // 1. Interceptar fillText en CanvasRenderingContext2D
  if (typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D.prototype) {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      try {
        if (typeof text === "string" && text.length > 0) {
          const trimmed = text.trim();
          // Ignorar números de una sola cifra o marcas mínimas aisladas
          if (trimmed.length > 1 && !/^\d{1,3}$/.test(trimmed)) {
            if (!seenChunks.has(trimmed)) {
              seenChunks.add(trimmed);
              capturedChunks.push(trimmed);
              fullCapturedText = capturedChunks.join(" ");
            }
          }
        }
      } catch (err) {}
      return originalFillText.apply(this, arguments);
    };

    const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, maxWidth) {
      try {
        if (typeof text === "string" && text.length > 0) {
          const trimmed = text.trim();
          if (trimmed.length > 1 && !/^\d{1,3}$/.test(trimmed)) {
            if (!seenChunks.has(trimmed)) {
              seenChunks.add(trimmed);
              capturedChunks.push(trimmed);
              fullCapturedText = capturedChunks.join(" ");
            }
          }
        }
      } catch (err) {}
      return originalStrokeText.apply(this, arguments);
    };
  }

  // 2. Extraer texto desde window.DOCS_modelChunk
  function extractFromModelChunk() {
    const fragments = [];
    try {
      if (window.DOCS_modelChunk && Array.isArray(window.DOCS_modelChunk)) {
        window.DOCS_modelChunk.forEach(chunk => {
          findStringsInObject(chunk, fragments);
        });
      }
    } catch (e) {}
    return fragments.join("\n");
  }

  function findStringsInObject(obj, out, depth = 0) {
    if (!obj || depth > 8) return;
    if (typeof obj === "string") {
      if (obj.trim().length > 10) out.push(obj.trim());
      return;
    }
    if (typeof obj !== "object") return;

    if (typeof obj.s === "string" && obj.s.trim().length > 2) {
      out.push(obj.s.trim());
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        findStringsInObject(obj[key], out, depth + 1);
      }
    }
  }

  // 3. Responder a solicitudes directas de texto desde el script de contenido
  window.addEventListener("message", e => {
    if (e.data && e.data.type === "DOCENTELENS_REQ_GDOCS_TEXT") {
      const modelText = extractFromModelChunk();
      let combined = fullCapturedText;
      if (modelText && modelText.length > combined.length) {
        combined = modelText + "\n" + combined;
      }

      window.postMessage(
        {
          type: "DOCENTELENS_RESP_GDOCS_TEXT",
          text: combined.trim()
        },
        "*"
      );
    }
  });

  // 4. Emitir actualizaciones periódicas al script de contenido si se detecta texto en canvas
  setInterval(() => {
    if (fullCapturedText.length > 20 && fullCapturedText.length !== lastBroadcastLength) {
      lastBroadcastLength = fullCapturedText.length;
      const modelText = extractFromModelChunk();
      let combined = fullCapturedText;
      if (modelText && modelText.length > combined.length) {
        combined = modelText + "\n" + combined;
      }

      window.postMessage(
        {
          type: "DOCENTELENS_CANVAS_STREAM",
          text: combined.trim()
        },
        "*"
      );
    }
  }, 1200);
})();
