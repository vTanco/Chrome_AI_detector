/**
 * DocenteLens - Script de Contenido Principal
 * Gestiona la interacción "mantener pulsada la tecla Comando ⌘ para iluminar contenido IA en tiempo real"
 * Compatible con cualquier página web, Google Classroom y Documentos de Google (Canvas & Text Layers).
 */

(function () {
  // 1. Detección de Frame: Los iframes ocultos (como .docs-texteventtarget-iframe en Google Docs)
  // deben capturar las pulsaciones y reenviarlas al marco superior (window.top) vía postMessage.
  const isTopFrame = window === window.top;
  const isGoogleDocs = window.location.hostname.includes("docs.google.com");
  const isGoogleClassroom = window.location.hostname.includes("classroom.google.com");

  // Comprobar si es la tecla Comando (⌘ en Mac) o Control (Windows/Linux)
  function isCommandKey(e) {
    if (!e) return false;
    const key = e.key;
    const code = e.code || "";
    return key === "Meta" || key === "Control" || code.startsWith("Meta") || code.startsWith("Control");
  }

  // Si nos encontramos en un sub-iframe (como el iframe de teclado de Google Docs o Classroom)
  if (!isTopFrame) {
    const forwardKey = (e, action) => {
      if (isCommandKey(e)) {
        try {
          window.top.postMessage(
            { type: "DOCENTELENS_KEY", action, repeat: Boolean(e.repeat) },
            "*"
          );
        } catch (err) {}
      }
    };

    window.addEventListener("keydown", e => forwardKey(e, "keydown"), true);
    document.addEventListener("keydown", e => forwardKey(e, "keydown"), true);
    window.addEventListener("keyup", e => forwardKey(e, "keyup"), true);
    document.addEventListener("keyup", e => forwardKey(e, "keyup"), true);

    const forwardClipboard = (e, action) => {
      try {
        const text = e.clipboardData?.getData("text/plain");
        if (text && text.trim().length > 10) {
          window.top.postMessage(
            { type: "DOCENTELENS_CLIPBOARD", action, text: text.trim() },
            "*"
          );
        }
      } catch (err) {}
    };

    window.addEventListener("paste", e => forwardClipboard(e, "paste"), true);
    document.addEventListener("paste", e => forwardClipboard(e, "paste"), true);
    window.addEventListener("copy", e => forwardClipboard(e, "copy"), true);
    document.addEventListener("copy", e => forwardClipboard(e, "copy"), true);

    // Los sub-iframes no deben instanciar elementos UI en su DOM invisible
    return;
  }

  // Prevenir inyecciones duplicadas en el marco principal
  if (window._docenteLensInitialized) return;
  window._docenteLensInitialized = true;

  // Estado local y configuración por defecto
  const state = {
    isEnabled: true,
    triggerMode: "commandKey", // "commandKey" (Comando ⌘ en Mac / Ctrl), "altClick", "middleClick", "rightClick", "pinned"
    sensitivity: "balanced",
    detectText: true,
    detectImages: true,
    isHolding: false,
    isPinned: false,
    highlightedElements: [],
    hudElement: null,
    tooltipElement: null,
    gdocsCardElement: null,
    currentTooltipData: null,
    currentTooltipText: "",
    currentTooltipAuthor: "",
    currentGDocsResult: null,
    classSummaryData: null
  };

  let hideTooltipTimer = null;

  // Variables de caché para Google Docs y portapapeles
  let cachedGoogleDocsText = null;
  let lastGoogleDocsFetchTime = 0;
  let lastPastedOrCopiedText = null;

  // Cargar configuración guardada
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        {
          isEnabled: true,
          triggerMode: "commandKey",
          sensitivity: "balanced",
          detectText: true,
          detectImages: true
        },
        items => {
          Object.assign(state, items);
          initUIElements();
        }
      );

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          for (const [key, { newValue }] of Object.entries(changes)) {
            state[key] = newValue;
          }
          if (!state.isEnabled && state.isHolding) {
            clearHighlights();
          }
        }
      });
    } else {
      initUIElements();
    }
  } catch (e) {
    initUIElements();
  }

  // Inicializar contenedores de HUD, Tooltip y Tarjeta de Google Docs
  function initUIElements() {
    if (!document.body) return;

    // 1. Tooltip Pedagógico Universal con botón de exportación de informe
    if (!state.tooltipElement) {
      const tooltip = document.createElement("div");
      tooltip.id = "docente-lens-tooltip-root";
      tooltip.innerHTML = `
        <div id="docentelens-tooltip">
          <div class="tt-header">
            <span class="tt-title">DocenteLens • Análisis</span>
            <span class="tt-score" id="tt-score-badge">0%</span>
          </div>
          <div class="tt-model-attribution" id="tt-model-box">
            <span class="tt-model-icon" id="tt-model-icon">🤖</span>
            <div class="tt-model-info">
              <strong id="tt-model-name">Identificando modelo...</strong>
              <small id="tt-watermark-desc">Marcas de agua e indicios de procedencia</small>
            </div>
          </div>
          <div id="tt-content">
            <ul class="tt-factors" id="tt-factors-list"></ul>
          </div>
          <div class="tt-pedagogy" id="tt-pedagogy-text"></div>
          <div id="tt-actions" style="margin-top: 10px;">
            <button id="tt-report-btn" class="docentelens-btn-export" type="button">📄 Exportar Informe Pericial PDF</button>
          </div>
        </div>
      `;
      document.body.appendChild(tooltip);
      state.tooltipElement = document.getElementById("docentelens-tooltip");

      const ttReportBtn = document.getElementById("tt-report-btn");
      if (ttReportBtn) {
        ttReportBtn.addEventListener("click", e => {
          e.stopPropagation();
          if (state.currentTooltipData && typeof DocenteLensReportGenerator !== "undefined") {
            DocenteLensReportGenerator.openPrintableReport({
              studentName: state.currentTooltipAuthor || "Estudiante",
              documentTitle: document.title || "Contenido analizado",
              textSnippet: state.currentTooltipText || "",
              result: state.currentTooltipData
            });
          }
        });
      }

      if (state.tooltipElement) {
        state.tooltipElement.addEventListener("mouseenter", () => {
          if (hideTooltipTimer) {
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;
          }
        });
        state.tooltipElement.addEventListener("mouseleave", () => {
          hideTooltip();
        });
      }
    }

    // 2. HUD Flotante Activo con Panel de Configuración Rápida
    if (!state.hudElement) {
      const hud = document.createElement("div");
      hud.id = "docentelens-hud";
      hud.style.display = "none";
      hud.innerHTML = `
        <span class="hud-pulse"></span>
        <span id="docentelens-hud-text">DocenteLens (⌘)</span>
        <div class="hud-toolbar" id="docentelens-hud-toolbar">
          <div class="hud-divider"></div>
          <div class="hud-pill-group" id="docentelens-hud-sens-group">
            <button type="button" class="hud-pill-btn ${state.sensitivity === 'conservative' ? 'active' : ''}" data-sens="conservative" title="Sensibilidad Conservadora (Menor tasa de falsos positivos)">Conservadora</button>
            <button type="button" class="hud-pill-btn ${state.sensitivity === 'balanced' ? 'active' : ''}" data-sens="balanced" title="Sensibilidad Equilibrada (Recomendada)">Equilibrada</button>
            <button type="button" class="hud-pill-btn ${state.sensitivity === 'sensitive' ? 'active' : ''}" data-sens="sensitive" title="Sensibilidad Alta (Detecta fragmentos breves)">Sensible</button>
          </div>
          <div class="hud-divider"></div>
          <button type="button" class="hud-action-btn ${state.isPinned ? 'pinned' : ''}" id="hud-pin-toggle" title="Fijar o desfijar iluminador">📌</button>
          <button type="button" class="hud-action-btn" id="hud-report-btn" title="Exportar informe pericial en PDF">📄 PDF</button>
        </div>
      `;
      document.body.appendChild(hud);
      state.hudElement = hud;

      const sensBtns = hud.querySelectorAll(".hud-pill-btn");
      sensBtns.forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const sens = btn.getAttribute("data-sens");
          setSensitivity(sens);
        });
      });

      const hudPinBtn = hud.querySelector("#hud-pin-toggle");
      if (hudPinBtn) {
        hudPinBtn.addEventListener("click", e => {
          e.stopPropagation();
          state.isPinned = !state.isPinned;
          hudPinBtn.classList.toggle("pinned", state.isPinned);
          if (!state.isPinned) {
            state.isHolding = false;
            hideHUD();
            clearHighlights();
            hideTooltip();
            hideGoogleDocsCard();
          }
        });
      }

      const hudReportBtn = hud.querySelector("#hud-report-btn");
      if (hudReportBtn) {
        hudReportBtn.addEventListener("click", e => {
          e.stopPropagation();
          exportCurrentViewReport();
        });
      }
    }

    // 3. Tarjeta de Análisis Flotante para Google Docs y Classroom
    if (!state.gdocsCardElement) {
      const gdocsCard = document.createElement("div");
      gdocsCard.id = "docentelens-gdocs-root";
      gdocsCard.innerHTML = `
        <div id="docentelens-gdocs-card" style="display: none;">
          <div class="gdocs-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="gdocs-badge-env">📄 Google Docs • Peritaje IA</span>
              <span class="tt-score" id="gdocs-score-badge">0%</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button id="gdocs-pin-btn" type="button" title="Fijar tarjeta para leer detenidamente" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 11px; font-weight: 600; color: #475569;">📌 Fijar</button>
              <button id="gdocs-close-btn" type="button" title="Cerrar" style="background: none; border: none; cursor: pointer; font-size: 16px; font-weight: bold; color: #64748b; padding: 0 4px; line-height: 1;">✕</button>
            </div>
          </div>
          <div class="tt-model-attribution" id="gdocs-model-box">
            <span class="tt-model-icon" id="gdocs-model-icon">🤖</span>
            <div class="tt-model-info">
              <strong id="gdocs-model-name">IA Detectada</strong>
              <small id="gdocs-watermark-desc">Trazabilidad de procedencia</small>
            </div>
          </div>
          <ul class="tt-factors" id="gdocs-factors-list"></ul>
          <div class="tt-pedagogy" id="gdocs-pedagogy-text"></div>
          <button id="gdocs-report-btn" class="docentelens-btn-export" type="button" style="margin-top: 10px;">📄 Exportar Informe Pericial PDF</button>
          <div id="gdocs-manual-box" style="display: none; margin-top: 10px; padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-size: 11.5px; color: #475569; margin-bottom: 6px; font-weight: 500;">
              💡 <strong>Análisis directo:</strong> Si el lienzo Canvas oculta el texto, pega aquí la rúbrica o contenido:
            </div>
            <textarea id="gdocs-manual-input" placeholder="Pega aquí el contenido de la rúbrica o texto..." style="width: 100%; height: 60px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; box-sizing: border-box; resize: vertical; font-family: inherit;"></textarea>
            <button id="gdocs-manual-btn" type="button" style="margin-top: 6px; width: 100%; background: #1a73e8; color: #ffffff; border: none; border-radius: 6px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer;">🔍 Auditar Texto / Rúbrica</button>
          </div>
        </div>
      `;
      document.body.appendChild(gdocsCard);
      state.gdocsCardElement = document.getElementById("docentelens-gdocs-card");

      const pinBtn = document.getElementById("gdocs-pin-btn");
      if (pinBtn) {
        pinBtn.addEventListener("click", e => {
          e.stopPropagation();
          state.isPinned = !state.isPinned;
          pinBtn.textContent = state.isPinned ? "📌 Fijado" : "📌 Fijar";
          pinBtn.style.background = state.isPinned ? "#dbeafe" : "#f1f5f9";
          pinBtn.style.color = state.isPinned ? "#1d4ed8" : "#475569";
        });
      }

      const closeBtn = document.getElementById("gdocs-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", e => {
          e.stopPropagation();
          state.isPinned = false;
          hideGoogleDocsCard(true);
          clearHighlights();
          hideHUD();
        });
      }

      const gdocsReportBtn = document.getElementById("gdocs-report-btn");
      if (gdocsReportBtn) {
        gdocsReportBtn.addEventListener("click", e => {
          e.stopPropagation();
          if (typeof DocenteLensReportGenerator !== "undefined") {
            DocenteLensReportGenerator.openPrintableReport({
              studentName: "Estudiante / Autor",
              documentTitle: document.title || "Documento analizado",
              textSnippet: cachedGoogleDocsText || "",
              result: state.currentGDocsResult || { score: 0, level: "none", indicators: ["Sin indicios concluyentes"] }
            });
          }
        });
      }

      const manualBtn = document.getElementById("gdocs-manual-btn");
      const manualInput = document.getElementById("gdocs-manual-input");
      if (manualBtn && manualInput) {
        manualBtn.addEventListener("click", e => {
          e.stopPropagation();
          const text = manualInput.value.trim();
          if (text.length > 15) {
            cachedGoogleDocsText = text;
            state.isPinned = true;
            const res = AITextDetector.analyze(text, state.sensitivity);
            highlightGoogleDocsPages(res);
            showGoogleDocsCard(res);
          }
        });
      }
    }

    // 4. Botón Flotante de Acceso Rápido para Google Docs y Classroom
    if ((isGoogleDocs || isGoogleClassroom) && !document.getElementById("docentelens-gdocs-quick-button")) {
      const quickBtn = document.createElement("div");
      quickBtn.id = "docentelens-gdocs-quick-button";
      quickBtn.title = "DocenteLens • Analizar Documento / Tarea";
      quickBtn.innerHTML = `
        <span class="gdocs-btn-icon">🔍</span>
        <span class="gdocs-btn-text">DocenteLens IA</span>
      `;
      document.body.appendChild(quickBtn);

      quickBtn.addEventListener("click", async e => {
        e.stopPropagation();
        if (state.isPinned && state.highlightedElements.length > 0) {
          state.isPinned = false;
          clearHighlights();
          hideHUD();
          hideTooltip();
          hideGoogleDocsCard();
          return;
        }
        state.isPinned = true;
        showHUD();
        const hudText = document.getElementById("docentelens-hud-text");
        if (hudText) {
          hudText.textContent = "Analizando...";
        }
        await scanAndHighlight();
      });
    }

    // Inyectar el interceptor de canvas si estamos en Google Docs
    if (isGoogleDocs && isTopFrame) {
      try {
        const bridgeScript = document.createElement("script");
        bridgeScript.src = chrome.runtime.getURL("content/gdocs-canvas-bridge.js");
        bridgeScript.onload = () => bridgeScript.remove();
        (document.head || document.documentElement).appendChild(bridgeScript);
      } catch (e) {}
    }

    hookAllInputsAndIframes();

    // 5. Detectar y montar auditoría de PDFs y resumen de entregas en Classroom
    checkAndMountPDFViewerAuditor();
    checkAndMountClassroomSummaryWidget();

    // Comprobación periódica para SPAs dinámicas (Classroom / Drive / Visores PDF)
    setInterval(() => {
      checkAndMountPDFViewerAuditor();
      checkAndMountClassroomSummaryWidget();
    }, 2000);
  }

  // Modificar sensibilidad desde el HUD en vivo
  function setSensitivity(sens) {
    if (!sens) return;
    state.sensitivity = sens;
    const sensBtns = document.querySelectorAll("#docentelens-hud-sens-group .hud-pill-btn");
    sensBtns.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-sens") === sens);
    });

    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ sensitivity: sens });
      }
    } catch (e) {}

    if (state.isHolding || state.isPinned) {
      scanAndHighlight();
    }
  }

  // Almacén en memoria de texto interceptado por el canvas bridge
  let canvasBridgeText = "";

  // Escuchar mensajes de sub-iframes y del Canvas Bridge (MAIN world)
  window.addEventListener("message", e => {
    if (e.data?.type === "DOCENTELENS_KEY") {
      if (e.data.action === "keydown" && !e.data.repeat) {
        handleHoldStart();
      } else if (e.data.action === "keyup") {
        handleHoldEnd();
      }
    } else if (e.data?.type === "DOCENTELENS_CLIPBOARD") {
      if (e.data.text && e.data.text.trim().length > 10) {
        lastPastedOrCopiedText = e.data.text.trim();
        cachedGoogleDocsText = e.data.text.trim();
      }
    } else if (e.data?.type === "DOCENTELENS_CANVAS_STREAM" || e.data?.type === "DOCENTELENS_RESP_GDOCS_TEXT") {
      if (e.data.text && e.data.text.trim().length > 10) {
        canvasBridgeText = e.data.text.trim();
        cachedGoogleDocsText = e.data.text.trim();
      }
    }
  });

  // Solicitar texto fresco al Canvas Bridge
  function requestBridgeText() {
    return new Promise(resolve => {
      let resolved = false;
      const handler = e => {
        if (e.data?.type === "DOCENTELENS_RESP_GDOCS_TEXT") {
          window.removeEventListener("message", handler);
          resolved = true;
          resolve(e.data.text || "");
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ type: "DOCENTELENS_REQ_GDOCS_TEXT" }, "*");
      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener("message", handler);
          resolve(canvasBridgeText || "");
        }
      }, 350);
    });
  }

  // Interceptar copy y paste en la ventana superior y documento para alimentar el buffer
  function onClipboardPaste(e) {
    try {
      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 10) {
        lastPastedOrCopiedText = text.trim();
        cachedGoogleDocsText = text.trim();
      }
    } catch (err) {}
  }

  function onClipboardCopy(e) {
    try {
      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 10) {
        lastPastedOrCopiedText = text.trim();
      }
    } catch (err) {}
  }

  // Vincular eventos de teclado y portapapeles a todos los iframes presentes y futuros
  function hookAllInputsAndIframes() {
    function attachToIframes() {
      const iframes = document.querySelectorAll(".docs-texteventtarget-iframe, iframe");
      iframes.forEach(iframe => {
        try {
          const doc = iframe.contentDocument;
          const win = iframe.contentWindow;

          if (doc && !doc._docenteLensHooked) {
            doc._docenteLensHooked = true;
            doc.addEventListener("keydown", onKeydownHandler, true);
            doc.addEventListener("keyup", onKeyupHandler, true);
            doc.addEventListener("paste", onClipboardPaste, true);
            doc.addEventListener("copy", onClipboardCopy, true);
          }
          if (win && !win._docenteLensHooked) {
            win._docenteLensHooked = true;
            win.addEventListener("keydown", onKeydownHandler, true);
            win.addEventListener("keyup", onKeyupHandler, true);
            win.addEventListener("paste", onClipboardPaste, true);
            win.addEventListener("copy", onClipboardCopy, true);
          }
        } catch (e) {}
      });
    }

    attachToIframes();
    const observer = new MutationObserver(attachToIframes);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    // En Google Docs, el iframe editor se recicla periódicamente
    if (isGoogleDocs) {
      setInterval(attachToIframes, 350);
    }
  }

  window.addEventListener("paste", onClipboardPaste, true);
  document.addEventListener("paste", onClipboardPaste, true);
  window.addEventListener("copy", onClipboardCopy, true);
  document.addEventListener("copy", onClipboardCopy, true);

  // Extraer el identificador del documento de Google Docs
  function getGoogleDocsId() {
    const match = window.location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Extraer texto precargado en scripts DOM (DOCS_modelChunk y datos serializados)
  function extractTextFromPageScripts() {
    try {
      const scripts = document.querySelectorAll("script:not([src])");
      const stringFragments = [];

      for (let i = 0; i < scripts.length; i++) {
        const content = scripts[i].textContent || "";
        if (content.includes("DOCS_modelChunk") || content.includes('"ty":"is"') || content.includes('"ty": "is"')) {
          const regex = /"s"\s*:\s*"((?:\\.|[^"\\])+)"/g;
          let match;
          while ((match = regex.exec(content)) !== null) {
            try {
              const unescaped = JSON.parse('"' + match[1] + '"');
              if (unescaped && unescaped.trim().length > 2) {
                stringFragments.push(unescaped.trim());
              }
            } catch (e) {
              if (match[1].trim().length > 2) {
                stringFragments.push(match[1].trim());
              }
            }
          }
        }
      }

      if (stringFragments.length > 0) {
        return stringFragments.join("\n");
      }
    } catch (e) {}
    return null;
  }

  // Extraer el texto completo del documento de Google Docs (Multi-capa: Selección + Scripts + Canvas Bridge + Export SW + Clipboard + Iframes + DOM)
  async function getGoogleDocsContent() {
    const docId = getGoogleDocsId();
    const now = Date.now();

    // Capa 1: Selección manual de texto por el usuario (si ha seleccionado con el cursor o con ⌘+A)
    try {
      const sel = window.getSelection()?.toString();
      if (sel && sel.trim().length > 15) {
        cachedGoogleDocsText = sel.trim();
        lastGoogleDocsFetchTime = now;
        return cachedGoogleDocsText;
      }
    } catch (e) {}

    // Capa 2: Scripts DOM precargados (0ms de latencia, sin red)
    const scriptText = extractTextFromPageScripts();
    if (scriptText && scriptText.length > 25) {
      cachedGoogleDocsText = scriptText;
      lastGoogleDocsFetchTime = now;
      return scriptText;
    }

    // Capa 3: Texto interceptado en vivo desde el Canvas 2D
    if (canvasBridgeText && canvasBridgeText.length > 20) {
      return canvasBridgeText;
    }

    // Capa 4: Forzar actualización del Canvas Bridge si el buffer estaba vacío
    const bridgeText = await requestBridgeText();
    if (bridgeText && bridgeText.length > 20) {
      canvasBridgeText = bridgeText;
      return bridgeText;
    }

    // Capa 5: Export nativo mediante background service worker (usa cookies de sesión)
    if (docId) {
      if (cachedGoogleDocsText && now - lastGoogleDocsFetchTime < 10000) {
        return cachedGoogleDocsText;
      }

      try {
        const resp = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { type: "DOCENTELENS_FETCH_GDOCS_EXPORT", docId },
            response => resolve(response)
          );
          setTimeout(() => resolve(null), 1200);
        });

        if (resp && resp.ok && resp.text && resp.text.trim().length > 15) {
          cachedGoogleDocsText = resp.text.trim();
          lastGoogleDocsFetchTime = now;
          return cachedGoogleDocsText;
        }
      } catch (err) {}
    }

    // Capa 6: Intentar leer del portapapeles del sistema (requiere permiso clipboardRead)
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().length > 15) {
          lastPastedOrCopiedText = clipText.trim();
          cachedGoogleDocsText = clipText.trim();
          return cachedGoogleDocsText;
        }
      }
    } catch (e) {}

    // Capa 7: Texto copiado o pegado recientemente en este documento
    if (lastPastedOrCopiedText && lastPastedOrCopiedText.length > 15) {
      return lastPastedOrCopiedText;
    }

    // Capa 8: Inspeccionar iframe del editor (.docs-texteventtarget-iframe)
    const iframes = document.querySelectorAll(".docs-texteventtarget-iframe, iframe");
    for (let i = 0; i < iframes.length; i++) {
      try {
        const doc = iframes[i].contentDocument;
        if (doc && doc.body) {
          const frameText = (doc.body.innerText || doc.body.textContent || "").trim();
          if (frameText.length > 15) {
            cachedGoogleDocsText = frameText;
            return frameText;
          }
        }
      } catch (e) {}
    }

    // Capa 9: Inspeccionar capas de accesibilidad y nodos DOM de Google Docs
    const accNodes = document.querySelectorAll(
      '[aria-label="Document content"], [role="textbox"], [data-paragraph-id], .kix-lineview, .kix-paragraphrenderer'
    );
    let domText = "";
    accNodes.forEach(n => {
      const t = n.innerText || n.textContent || "";
      if (t) domText += " " + t;
    });
    if (domText.trim().length > 25) {
      cachedGoogleDocsText = domText.trim();
      return cachedGoogleDocsText;
    }

    if (cachedGoogleDocsText && cachedGoogleDocsText.length > 15) {
      return cachedGoogleDocsText;
    }

    return null;
  }

  // Iluminar la superficie de la página de Google Docs
  function highlightGoogleDocsPages(result) {
    if (!isGoogleDocs) return;
    const gdocsPages = document.querySelectorAll(".kix-page, .kix-page-paginated, .kix-zoom-wrapper, .kix-appview-editor");
    const targetElements = gdocsPages.length > 0
      ? gdocsPages
      : document.querySelectorAll(".docs-editor-container, #docs-editor");

    let highlightClass = "docentelens-gdocs-highlight";
    if (result && result.modelAttribution) {
      const comp = result.modelAttribution.company || "";
      if (comp === "OpenAI") highlightClass = "docentelens-gdocs-highlight-openai";
      else if (comp === "Anthropic") highlightClass = "docentelens-gdocs-highlight-anthropic";
      else if (comp.includes("Google")) highlightClass = "docentelens-gdocs-highlight-google";
    }

    targetElements.forEach(el => {
      el.classList.add(highlightClass);
      state.highlightedElements.push({ element: el, badge: null });
    });
  }

  // Mostrar tarjeta de análisis en Google Docs
  function showGoogleDocsCard(result) {
    if (!state.gdocsCardElement) return;
    state.currentGDocsResult = result;
    const scoreBadge = document.getElementById("gdocs-score-badge");
    const modelBox = document.getElementById("gdocs-model-box");
    const modelName = document.getElementById("gdocs-model-name");
    const watermarkDesc = document.getElementById("gdocs-watermark-desc");
    const modelIcon = document.getElementById("gdocs-model-icon");
    const factorsList = document.getElementById("gdocs-factors-list");
    const pedagogyText = document.getElementById("gdocs-pedagogy-text");
    const manualBox = document.getElementById("gdocs-manual-box");

    if (result.eligible && result.level !== "none") {
      scoreBadge.textContent = `${result.score}% Probabilidad`;
      scoreBadge.className = `tt-score ${result.level === "high" ? "tt-score-high" : "tt-score-medium"}`;

      if (result.modelAttribution) {
        modelBox.style.display = "flex";
        const ma = result.modelAttribution;
        modelName.textContent = `${ma.predictedModel} (~${ma.confidence}% certeza de estilo)`;
        watermarkDesc.textContent = ma.watermarkInfo || "Firma estadística de procedencia";
        modelBox.style.borderLeftColor = ma.color;
        modelIcon.textContent = ma.company === "OpenAI" ? "🟢" : ma.company === "Anthropic" ? "🟠" : (ma.company.includes("Google") ? "🔵" : "🤖");
      } else {
        modelBox.style.display = "none";
      }

      factorsList.innerHTML = "";
      const allIndicators = [...(result.indicators || [])];
      if (result.modelAttribution?.detectedFeatures) {
        result.modelAttribution.detectedFeatures.forEach(feat => {
          if (!allIndicators.includes(feat)) allIndicators.unshift(feat);
        });
      }

      allIndicators.forEach(ind => {
        const li = document.createElement("li");
        li.textContent = ind;
        factorsList.appendChild(li);
      });

      pedagogyText.textContent = result.pedagogicalAdvice || "";
      if (manualBox) manualBox.style.display = "none";
    } else if (result.eligible && result.level === "none") {
      scoreBadge.textContent = `${result.score}% Orgánico`;
      scoreBadge.className = "tt-score tt-score-organic";
      modelBox.style.display = "none";
      factorsList.innerHTML = "";
      (result.indicators || []).forEach(ind => {
        const li = document.createElement("li");
        li.textContent = ind;
        factorsList.appendChild(li);
      });
      pedagogyText.textContent = result.pedagogicalAdvice || "";
      if (manualBox) manualBox.style.display = "none";
    } else {
      scoreBadge.textContent = "Acción Requerida";
      scoreBadge.className = "tt-score tt-score-medium";
      modelBox.style.display = "none";
      factorsList.innerHTML = "";
      (result.indicators || []).forEach(ind => {
        const li = document.createElement("li");
        li.textContent = ind;
        factorsList.appendChild(li);
      });
      pedagogyText.textContent = result.pedagogicalAdvice || "";
      if (manualBox) manualBox.style.display = "block";
    }

    state.gdocsCardElement.style.display = "block";
  }

  function hideGoogleDocsCard(force = false) {
    if (!force && state.isPinned) return;
    if (state.gdocsCardElement) {
      state.gdocsCardElement.style.display = "none";
    }
  }

  let keyPressStartTime = 0;

  // Inicio de activación (mantener pulsado o pulsar para conmutar)
  function handleHoldStart() {
    if (!state.isEnabled) return;
    state.isHolding = true;
    showHUD();
    scanAndHighlight();
  }

  // Fin de activación (soltar tecla)
  function handleHoldEnd() {
    const elapsed = Date.now() - keyPressStartTime;

    // Si fue una pulsación corta (tap rápido < 260ms), actuar como conmutador (toggle) de fijado
    if (elapsed > 0 && elapsed < 260) {
      state.isPinned = !state.isPinned;
      if (!state.isPinned) {
        state.isHolding = false;
        hideHUD();
        clearHighlights();
        hideTooltip();
        hideGoogleDocsCard();
      }
      return;
    }

    // Si se mantuvo presionada más tiempo, limpiar al soltar (salvo si estaba fijado previamente)
    if (state.triggerMode === "commandKey" && state.isHolding && !state.isPinned) {
      state.isHolding = false;
      hideHUD();
      clearHighlights();
      hideTooltip();
      hideGoogleDocsCard();
    }
  }

  // Eventos de teclado en la ventana superior y documento
  function onKeydownHandler(e) {
    if (state.triggerMode === "commandKey" && isCommandKey(e)) {
      if (e.repeat) return;
      keyPressStartTime = Date.now();
      handleHoldStart();
    }
  }

  function onKeyupHandler(e) {
    if (state.triggerMode === "commandKey" && isCommandKey(e)) {
      handleHoldEnd();
    }
  }

  window.addEventListener("keydown", onKeydownHandler, true);
  document.addEventListener("keydown", onKeydownHandler, true);
  window.addEventListener("keyup", onKeyupHandler, true);
  document.addEventListener("keyup", onKeyupHandler, true);

  // Comprobar si el evento de ratón coincide con el disparador (si está en modo ratón)
  function matchesMouseTrigger(e) {
    if (!state.isEnabled) return false;
    switch (state.triggerMode) {
      case "middleClick":
        return e.button === 1;
      case "altClick":
        return e.altKey && e.button === 0;
      case "rightClick":
        return e.button === 2;
      default:
        return false;
    }
  }

  window.addEventListener(
    "mousedown",
    e => {
      if (matchesMouseTrigger(e)) {
        if (state.triggerMode === "rightClick" || state.triggerMode === "middleClick") {
          e.preventDefault();
        }
        state.isHolding = true;
        showHUD();
        scanAndHighlight();
      }
    },
    true
  );

  window.addEventListener(
    "mouseup",
    e => {
      if (state.triggerMode !== "commandKey" && state.isHolding && !state.isPinned) {
        state.isHolding = false;
        hideHUD();
        clearHighlights();
        hideTooltip();
        hideGoogleDocsCard();
      }
    },
    true
  );

  // Prevenir cierre prematuro en Google Docs cuando el foco salta al iframe editor
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.isHolding && !state.isPinned) {
      handleHoldEnd();
    }
  });

  window.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.visibilityState === "hidden" && state.isHolding && !state.isPinned) {
        handleHoldEnd();
      }
    }, 200);
  });

  window.addEventListener(
    "contextmenu",
    e => {
      if (state.triggerMode === "rightClick" && (state.isHolding || state.isPinned)) {
        e.preventDefault();
      }
    },
    true
  );

  // Exportar informe pericial del análisis visible actualmente
  function exportCurrentViewReport() {
    if (typeof DocenteLensReportGenerator === "undefined") return;

    // Caso 1: Google Docs
    if (isGoogleDocs && cachedGoogleDocsText) {
      const res = state.currentGDocsResult || AITextDetector.analyze(cachedGoogleDocsText, state.sensitivity);
      DocenteLensReportGenerator.openPrintableReport({
        studentName: "Estudiante / Autor",
        documentTitle: document.title || "Documento de Google Docs",
        textSnippet: cachedGoogleDocsText,
        result: res
      });
      return;
    }

    // Caso 2: Elemento con mayor probabilidad de IA en la vista actual
    if (state.highlightedElements.length > 0) {
      let best = null;
      for (const h of state.highlightedElements) {
        const d = h.element?._docenteLensData;
        if (d && (!best || (d.score || 0) > (best.data?.score || 0))) {
          best = {
            data: d,
            text: h.element.innerText || h.element.textContent || "",
            author: h.element._docenteLensAuthor || "Estudiante"
          };
        }
      }
      if (best) {
        DocenteLensReportGenerator.openPrintableReport({
          studentName: best.author,
          documentTitle: document.title || "Tarea o Examen",
          textSnippet: best.text,
          result: best.data
        });
        return;
      }
    }

    // Caso 3: Auditoría de selección o texto global
    const sel = window.getSelection()?.toString()?.trim();
    const textToAnalyze = (sel && sel.length > 20) ? sel : (document.body.innerText || "").slice(0, 3000);
    const res = AITextDetector.analyze(textToAnalyze, state.sensitivity);
    DocenteLensReportGenerator.openPrintableReport({
      studentName: "Estudiante / Autor",
      documentTitle: document.title || "Página analizada",
      textSnippet: textToAnalyze.slice(0, 800),
      result: res
    });
  }

  // Detección y montaje de auditoría para visores de PDF (Classroom / Drive / Visor nativo)
  function checkAndMountPDFViewerAuditor() {
    if (document.getElementById("docentelens-pdf-audit-btn")) return;

    const isPDF =
      document.querySelector(".textLayer, .drive-viewer-tool-strip, [data-page-number], .ndfHFb-c4YZDc-Wrql6b, embed[type='application/pdf']") !== null ||
      window.location.pathname.includes("/file/d/") ||
      window.location.pathname.endsWith(".pdf") ||
      window.location.pathname.includes("/viewer");

    if (!isPDF) return;

    const btn = document.createElement("button");
    btn.id = "docentelens-pdf-audit-btn";
    btn.type = "button";
    btn.innerHTML = `
      <span style="font-size: 15px;">📄</span>
      <span>Auditar PDF con DocenteLens</span>
    `;
    document.body.appendChild(btn);

    btn.addEventListener("click", async e => {
      e.stopPropagation();
      await auditPDFViewer();
    });
  }

  // Auditar texto del PDF presente en el visor
  async function auditPDFViewer() {
    const spans = Array.from(document.querySelectorAll(".textLayer span, [data-page-number] span, .ndfHFb-c4YZDc-Wrql6b span, .ndfHFb-c4YZDc-Wrql6b"));
    let extractedText = "";

    if (spans.length > 0) {
      extractedText = spans.map(s => s.innerText || s.textContent || "").join(" ").trim();
    } else {
      const container = document.querySelector(".drive-viewer-container, [role='main'], #viewer, .pdfViewer") || document.body;
      extractedText = (container.innerText || container.textContent || "").trim();
    }

    if (extractedText.length < 20) {
      showGoogleDocsCard({
        score: 0,
        level: "medium",
        eligible: false,
        modelAttribution: null,
        indicators: [
          "El visor de PDF no expone capas de texto seleccionable en este momento",
          "Selecciona texto dentro del documento o pégalo en la caja inferior para auditarlo"
        ],
        pedagogicalAdvice: "Si el archivo es un PDF escaneado (imagen), no cuenta con capa OCR de texto digital. Si tiene texto seleccionable, márcalo y pulsa ⌘."
      });
      const manualBox = document.getElementById("gdocs-manual-box");
      if (manualBox) manualBox.style.display = "block";
      state.isPinned = true;
      showHUD();
      return;
    }

    const result = AITextDetector.analyze(extractedText, state.sensitivity);
    state.currentGDocsResult = result;
    cachedGoogleDocsText = extractedText;
    state.isPinned = true;
    showHUD();

    // Iluminar páginas o capas de texto del visor
    if (result.eligible && result.level !== "none") {
      const parentPages = document.querySelectorAll(".textLayer, [data-page-number], .page, .ndfHFb-c4YZDc-Wrql6b");
      parentPages.forEach(p => {
        p.classList.add(result.level === "high" ? "docentelens-highlight-high" : "docentelens-highlight-medium");
        state.highlightedElements.push({ element: p, badge: null });
      });
    }

    showGoogleDocsCard(result);
    const envBadge = document.querySelector(".gdocs-badge-env");
    if (envBadge) {
      envBadge.textContent = "📄 Documento PDF • Peritaje IA";
    }
  }

  // Widget Flotante de Resumen Global de Entregas en Classroom
  function checkAndMountClassroomSummaryWidget() {
    if (!isGoogleClassroom) return;
    const isSubmissionsPage =
      window.location.pathname.includes("/submissions") ||
      window.location.pathname.includes("/sort-by-status") ||
      document.querySelector('[role="row"], [data-student-id], [data-submission-id]') !== null;

    if (!isSubmissionsPage) return;

    const studentRows = Array.from(document.querySelectorAll(
      'tr[role="row"], div[role="row"], [data-student-id], [data-submission-id], [class*="student-submission" i]'
    )).filter(r => r.innerText && r.innerText.trim().length > 10 && !r.closest("#docentelens-class-summary-widget"));

    if (studentRows.length === 0) return;

    let totalStudents = 0;
    let organicCount = 0;
    let aiCount = 0;
    let suspectCount = 0;
    const studentRecords = [];

    studentRows.forEach((row, idx) => {
      const existingBadge = row.querySelector(".docentelens-student-badge");
      if (existingBadge) existingBadge.remove();

      const nameEl = row.querySelector('[data-name], [dir="auto"], strong, h3, .name') || row.firstElementChild;
      const studentName = nameEl ? (nameEl.innerText || "").trim().split("\n")[0] : `Alumno ${idx + 1}`;

      const rowText = (row.innerText || "").trim();
      totalStudents++;

      const words = (rowText.match(/[\p{L}\p{N}]+/gu) || []).length;
      let verdict = "organic";
      let score = 0;
      let model = "";

      if (words >= 15) {
        const res = AITextDetector.analyze(rowText, state.sensitivity);
        score = res.score;
        if (res.eligible && res.level === "high") {
          verdict = "ai";
          aiCount++;
          model = res.modelAttribution?.predictedModel?.split(" ")[0] || "IA";
        } else if (res.eligible && res.level === "medium") {
          verdict = "suspect";
          suspectCount++;
          model = res.modelAttribution?.predictedModel?.split(" ")[0] || "IA";
        } else {
          organicCount++;
        }
      } else {
        organicCount++;
      }

      studentRecords.push({ name: studentName, verdict, score, model });

      const badge = document.createElement("span");
      badge.className = "docentelens-student-badge";
      if (verdict === "ai") {
        badge.classList.add("docentelens-student-badge-high");
        badge.textContent = `🔴 ${model || "IA"} ~${score}%`;
      } else if (verdict === "suspect") {
        badge.classList.add("docentelens-student-badge-medium");
        badge.textContent = `🟠 Revisar ~${score}%`;
      } else {
        badge.classList.add("docentelens-student-badge-organic");
        badge.textContent = `🟢 Orgánico`;
      }

      if (nameEl) {
        nameEl.appendChild(badge);
      } else {
        row.appendChild(badge);
      }
    });

    state.classSummaryData = {
      total: totalStudents,
      organic: organicCount,
      ai: aiCount,
      suspect: suspectCount,
      students: studentRecords
    };

    let widget = document.getElementById("docentelens-class-summary-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "docentelens-class-summary-widget";
      document.body.appendChild(widget);
    }

    widget.innerHTML = `
      <div class="summary-header">
        <span class="summary-title">📊 DocenteLens • Entregas</span>
        <button id="docentelens-widget-toggle-btn" type="button" title="Minimizar / Expandir" style="background: none; border: none; cursor: pointer; font-size: 13px; font-weight: bold; color: #64748b; padding: 0 4px;">−</button>
      </div>
      <div class="summary-body">
        <div class="summary-stats-grid">
          <div class="stat-box">
            <div class="stat-val">${totalStudents}</div>
            <div class="stat-label">Alumnos</div>
          </div>
          <div class="stat-box stat-success">
            <div class="stat-val">${organicCount}</div>
            <div class="stat-label">Orgánicos</div>
          </div>
          <div class="stat-box stat-danger">
            <div class="stat-val">${aiCount + suspectCount}</div>
            <div class="stat-label">Indicios IA</div>
          </div>
        </div>
      </div>
      <div class="summary-actions">
        <button id="docentelens-class-acta-btn" class="docentelens-btn-export" type="button">📄 Exportar Acta de Entregas PDF</button>
      </div>
    `;

    const toggleBtn = document.getElementById("docentelens-widget-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", e => {
        e.stopPropagation();
        widget.classList.toggle("minimized");
        toggleBtn.textContent = widget.classList.contains("minimized") ? "+" : "−";
      });
    }

    const actaBtn = document.getElementById("docentelens-class-acta-btn");
    if (actaBtn) {
      actaBtn.addEventListener("click", e => {
        e.stopPropagation();
        exportClassSummaryReport();
      });
    }
  }

  // Exportar acta formal imprimible en PDF con el resumen de entregas de la clase
  function exportClassSummaryReport() {
    if (!state.classSummaryData) return;
    const d = state.classSummaryData;
    const rowsHTML = d.students.map(s => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px 12px; font-weight: 600;">${s.name}</td>
        <td style="padding: 8px 12px;">
          ${s.verdict === 'ai' ? `<span style="background:#fee2e2; color:#b91c1c; font-weight:bold; padding:2px 8px; border-radius:12px;">🔴 Alta Probabilidad IA (~${s.score}%)</span>` :
            s.verdict === 'suspect' ? `<span style="background:#fef3c7; color:#b45309; font-weight:bold; padding:2px 8px; border-radius:12px;">🟠 Indicios Moderados (~${s.score}%)</span>` :
            `<span style="background:#dcfce7; color:#15803d; font-weight:bold; padding:2px 8px; border-radius:12px;">🟢 Redacción Orgánica</span>`
          }
        </td>
        <td style="padding: 8px 12px; color: #64748b;">${s.model || 'Patrón humano'}</td>
      </tr>
    `).join("");

    const reportHTML = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Acta de Auditoría de Entregas - DocenteLens</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .stats { display: flex; gap: 15px; margin-bottom: 25px; }
          .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 20px; flex: 1; text-align: center; }
          .stat-num { font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background:#1a73e8; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">🖨️ Imprimir / Guardar en PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 22px;">DocenteLens • Acta Pericial de Entregas</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Google Classroom • Auditoría Formativa de Integridad Académica</p>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div>Conforme al Art. 50 del Reglamento de IA de la UE</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat-card"><div class="stat-num">${d.total}</div><div>Entregas Evaluadas</div></div>
          <div class="stat-card" style="background:#f0fdf4;"><div class="stat-num" style="color:#16a34a;">${d.organic}</div><div>Orgánicas</div></div>
          <div class="stat-card" style="background:#fef2f2;"><div class="stat-num" style="color:#dc2626;">${d.ai + d.suspect}</div><div>Con Indicios de IA</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Estudiante / Tarea</th>
              <th>Veredicto Heurístico</th>
              <th>Atribución Estilométrica</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
        <div style="margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          * Este informe pericial se genera exclusivamente en el cliente local mediante análisis estilométrico (longitud de cláusula, perplejidad heurística y marcadores discursivos). No sustituye el criterio pedagógico del docente ni constituye sanción automática conforme al RGPD y la Ley de IA de la UE.
        </div>
      </body>
      </html>
    `;

    const reportWin = window.open("", "_blank");
    if (reportWin) {
      reportWin.document.open();
      reportWin.document.write(reportHTML);
      reportWin.document.close();
    }
  }

  // Escaneo y Resaltado Principal
  async function scanAndHighlight() {
    clearHighlights();

    // A. Tratamiento específico e iluminación para Google Docs
    if (isGoogleDocs) {
      const hudText = document.getElementById("docentelens-hud-text");
      if (hudText) {
        hudText.textContent = "Analizando...";
      }

      const docContent = await getGoogleDocsContent();

      if (docContent) {
        const result = AITextDetector.analyze(docContent, state.sensitivity);
        if (result.eligible && result.level !== "none") {
          highlightGoogleDocsPages(result);
          showGoogleDocsCard(result);

          if (hudText) {
            const mName = result.modelAttribution ? result.modelAttribution.predictedModel : "IA";
            hudText.textContent = `${mName} (~${result.score}%)`;
          }
          return;
        } else {
          showGoogleDocsCard({
            score: result.score || 0,
            level: "none",
            eligible: true,
            modelAttribution: null,
            indicators: [
              "Redacción con vocabulario y patrones de variabilidad humana",
              "Ausencia de marcadores léxicos ni marcas de agua de IA"
            ],
            pedagogicalAdvice: "El texto analizado no presenta firmas de IA (Claude, Gemini ni ChatGPT). Redacción consistente con autoría orgánica."
          });
          if (hudText) {
            hudText.textContent = "Redacción orgánica";
          }
          return;
        }
      } else {
        // Si el canvas no devolvió texto automáticamente, guiar al docente con la caja de análisis directo
        showGoogleDocsCard({
          score: 0,
          level: "medium",
          eligible: false,
          modelAttribution: null,
          indicators: [
            "El lienzo Canvas de Google Docs protege el texto contra lectura directa",
            "Selecciona texto en el documento (o pulsa ⌘+A) y vuelve a pulsar ⌘",
            "O pega el fragmento en la caja inferior para peritaje inmediato"
          ],
          pedagogicalAdvice: "Para auditar este documento, pega el texto de la rúbrica o tarea en la caja inferior o selecciona el texto en el documento."
        });
        const manualBox = document.getElementById("gdocs-manual-box");
        if (manualBox) manualBox.style.display = "block";

        if (hudText) {
          hudText.textContent = "Selecciona o pega texto";
        }
        return;
      }
    }

    // B. Análisis de Texto en Páginas Web Estándar y Google Classroom
    if (state.detectText && typeof AITextDetector !== "undefined") {
      const textNodes = getInspectableTextElements();

      textNodes.forEach(el => {
        const text = el.innerText || el.textContent;
        const result = AITextDetector.analyze(text, state.sensitivity);

        if (result.eligible && result.level !== "none") {
          let highlightClass = result.level === "high" ? "docentelens-highlight-high" : "docentelens-highlight-medium";
          let badgeClass = result.level === "high" ? "docentelens-badge-high" : "docentelens-badge-medium";

          let modelTag = "IA";
          if (result.modelAttribution) {
            const comp = result.modelAttribution.company || "";
            if (comp === "OpenAI") {
              modelTag = "ChatGPT";
              highlightClass += " docentelens-highlight-high-openai";
              badgeClass = "docentelens-badge-openai";
            } else if (comp === "Anthropic") {
              modelTag = "Claude";
              highlightClass += " docentelens-highlight-high-anthropic";
              badgeClass = "docentelens-badge-anthropic";
            } else if (comp.includes("Google")) {
              modelTag = "Gemini";
              highlightClass += " docentelens-highlight-high-google";
              badgeClass = "docentelens-badge-google";
            }
          }
          if (el._docenteLensAuthor || el.classList.contains("docentelens-comment-box")) {
            highlightClass += result.level === "high" ? " docentelens-comment-highlight-high" : " docentelens-comment-highlight";
          }
          highlightClass.split(" ").filter(Boolean).forEach(c => el.classList.add(c));

          const badge = document.createElement("span");
          badge.className = `docentelens-badge ${badgeClass}`;
          if (el._docenteLensAuthor) {
            badge.textContent = `${el._docenteLensAuthor} • ${modelTag} ~${result.score}%`;
          } else {
            badge.textContent = `${modelTag} ~${result.score}%`;
          }
          el.appendChild(badge);

          el._docenteLensData = result;
          el.addEventListener("mouseenter", onElementMouseEnter);
          el.addEventListener("mouseleave", onElementMouseLeave);

          state.highlightedElements.push({ element: el, badge });
        }
      });

      const hudText = document.getElementById("docentelens-hud-text");
      if (hudText && !isGoogleDocs) {
        const count = state.highlightedElements.length;
        if (count === 1 && state.highlightedElements[0]?.element?._docenteLensData) {
          const firstData = state.highlightedElements[0].element._docenteLensData;
          const mName = firstData.modelAttribution?.predictedModel?.split(" ")[0] || "IA";
          hudText.textContent = `${mName} (~${firstData.score}%)`;
        } else if (count > 1) {
          hudText.textContent = `${count} elementos IA`;
        } else {
          hudText.textContent = "Redacción orgánica";
        }
      }
    }

    // C. Análisis de Imágenes
    if (state.detectImages && typeof AIImageDetector !== "undefined") {
      const images = Array.from(document.querySelectorAll("img"));

      images.forEach(img => {
        const result = AIImageDetector.analyze(img);
        if (result.isAI) {
          img.classList.add("docentelens-image-highlight");

          img._docenteLensData = {
            score: result.score,
            level: "image",
            indicators: result.reasons,
            modelAttribution: result.modelAttribution,
            pedagogicalAdvice: result.pedagogicalAdvice
          };
          img.addEventListener("mouseenter", onElementMouseEnter);
          img.addEventListener("mouseleave", onElementMouseLeave);

          state.highlightedElements.push({ element: img, badge: null });
        }
      });
    }
  }

  // Eliminar todos los resaltados y badges sin alterar el DOM original
  function clearHighlights() {
    hideGoogleDocsCard();
    const hudText = document.getElementById("docentelens-hud-text");
    if (hudText) {
      hudText.textContent = "DocenteLens (⌘)";
    }

    state.highlightedElements.forEach(({ element, badge }) => {
      element.classList.remove(
        "docentelens-highlight-high",
        "docentelens-highlight-medium",
        "docentelens-image-highlight",
        "docentelens-gdocs-highlight",
        "docentelens-gdocs-highlight-anthropic",
        "docentelens-gdocs-highlight-google",
        "docentelens-gdocs-highlight-openai",
        "docentelens-highlight-high-anthropic",
        "docentelens-highlight-high-google",
        "docentelens-highlight-high-openai",
        "docentelens-comment-highlight",
        "docentelens-comment-highlight-high"
      );
      if (badge && badge.parentNode) {
        badge.parentNode.removeChild(badge);
      }
      element.removeEventListener("mouseenter", onElementMouseEnter);
      element.removeEventListener("mouseleave", onElementMouseLeave);
      delete element._docenteLensData;
    });
    state.highlightedElements = [];
  }

  // Búsqueda inteligente de componentes educativos (rúbricas de Classroom, tarjetas de criterios, cajas de nivel)
  function findClassroomRubricsAndCards() {
    const cards = [];

    // 1. Selectores directos de componentes de rúbrica en Google Classroom y plataformas LMS
    const specificSelectors = [
      '[data-criterion-id]',
      '[data-rubric-id]',
      '[class*="rubric" i]',
      '[class*="criterion" i]',
      '[aria-label*="rúbrica" i]',
      '[aria-label*="rubric" i]',
      'div[jscontroller][data-id]'
    ];

    try {
      const elements = document.querySelectorAll(specificSelectors.join(","));
      elements.forEach(el => {
        const text = (el.innerText || "").trim();
        if (text.length >= 25) {
          cards.push(el);
        }
      });
    } catch (e) {}

    // 2. Búsqueda estructural por contenido de tarjetas de criterios y niveles (como en Classroom)
    const potentialContainers = document.querySelectorAll('div, section, article, [role="region"], [role="listitem"]');
    potentialContainers.forEach(container => {
      if (container === document.body || container.children.length > 25) return;
      const text = (container.innerText || "").trim();
      if (text.length < 25 || text.length > 2500) return;

      const hasPoints = /\b\d+\s*puntos?\b|\/\s*\d+/i.test(text);
      const hasLevels = /\b(notable|sobresaliente|suficiente|insuficiente|sin hacer|excelente|muy bien|bien|regular|deficiente)\b/i.test(text);

      if (hasPoints && hasLevels) {
        // Evitar seleccionar un contenedor padre si un hijo ya es una tarjeta completa de criterio
        const hasChildCard = Array.from(container.children).some(child => {
          const ct = (child.innerText || "").trim();
          return /\b\d+\s*puntos?\b|\/\s*\d+/i.test(ct) && /\b(notable|sobresaliente|suficiente|insuficiente|sin hacer)\b/i.test(ct);
        });

        if (!hasChildCard) {
          cards.push(container);
        }
      }
    });

    return cards;
  }

  // Búsqueda inteligente de comentarios e hilos de debate en Classroom y foros educativos
  function findClassroomCommentElements() {
    const comments = [];
    const commentSelectors = [
      'div[data-comment-id]',
      'div[aria-label*="comentario" i]',
      'div[aria-label*="comment" i]',
      '.s8W54',
      '.docentelens-comment-box',
      '[data-message-id]',
      'div[jscontroller][data-comment-id]',
      '[class*="threaded-reply" i]',
      '[class*="stream-item-comment" i]'
    ];

    try {
      const elements = document.querySelectorAll(commentSelectors.join(","));
      elements.forEach(el => {
        const text = (el.innerText || "").trim();
        if (text.length >= 20) {
          const authorEl = el.querySelector('[data-author], .wDNjof, span[dir="auto"], h3, h4, strong');
          if (authorEl) {
            el._docenteLensAuthor = (authorEl.innerText || "").trim().split("\n")[0];
          }
          comments.push(el);
        }
      });
    } catch (e) {}

    return comments;
  }

  // Obtener elementos de texto relevantes para inspeccionar (Árbol DOM Universal + Shadow DOM + Rúbricas + Comentarios)
  function getInspectableTextElements() {
    const inspectable = [];

    // 1. Google Classroom y plataformas LMS: Rúbricas y Tarjetas de Criterios especializadas
    const rubricCards = findClassroomRubricsAndCards();
    rubricCards.forEach(card => inspectable.push(card));

    // 2. Google Classroom y Foros: Hilos de debate y comentarios de estudiantes
    const comments = findClassroomCommentElements();
    comments.forEach(comment => inspectable.push(comment));

    // 3. Recorrido Universal Exhaustivo del DOM (incluyendo Web Components y Shadow DOM)
    // Extrae CADA bloque de texto, párrafo o consigna del HTML sin depender de clases CSS ofuscadas o cambiantes.
    const BLOCK_TAGS = new Set(["P", "DIV", "LI", "BLOCKQUOTE", "DD", "DT", "SECTION", "ARTICLE", "MAIN"]);
    const IGNORE_TAGS = new Set([
      "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "INPUT", "TEXTAREA",
      "SELECT", "OPTION", "HEAD", "META", "LINK", "AUDIO", "VIDEO"
    ]);

    function countWords(str) {
      if (!str) return 0;
      const m = str.match(/[\p{L}\p{N}]+/gu);
      return m ? m.length : 0;
    }

    function traverseTree(node) {
      if (!node || node.nodeType !== 1) return;
      const tag = (node.tagName || "").toUpperCase();
      if (IGNORE_TAGS.has(tag)) return;
      if (node.id && typeof node.id === "string" && node.id.startsWith("docentelens-")) return;

      // Explorar Shadow Root abierto si el componente web lo utiliza
      if (node.shadowRoot) {
        traverseTree(node.shadowRoot);
      }

      // Si este nodo ya está contenido dentro de una tarjeta de rúbrica o comentario ya seleccionado, no duplicar
      if (rubricCards.some(rc => rc !== node && rc.contains(node)) || comments.some(c => c !== node && c.contains(node))) {
        return;
      }

      const isBlock = BLOCK_TAGS.has(tag) || (node.getAttribute && (node.getAttribute("dir") === "auto" || node.getAttribute("role") === "paragraph"));
      const text = (node.innerText || node.textContent || "").trim();
      const words = countWords(text);

      if (isBlock && words >= 8) {
        // Comprobar si tiene hijos directos o descendientes en bloque que contengan suficiente texto (>= 8 palabras)
        let hasChildBlockWithSubstantialText = false;
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          const cTag = (c.tagName || "").toUpperCase();
          if (BLOCK_TAGS.has(cTag)) {
            const cWords = countWords(c.innerText || c.textContent);
            if (cWords >= 8) {
              hasChildBlockWithSubstantialText = true;
              break;
            }
          }
        }

        // Si ningún hijo en bloque tiene texto sustancial, este nodo es un bloque hoja (párrafo o consigna completa)
        if (!hasChildBlockWithSubstantialText) {
          inspectable.push(node);
          return;
        }
      }

      // Si es un contenedor padre con hijos en bloque, recorrer a sus hijos para alcanzar los bloques hoja
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        traverseTree(children[i]);
      }
    }

    if (document.body) {
      traverseTree(document.body);
    }

    return [...new Set(inspectable)];
  }

  function isElementInViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return (
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Manejo de Tooltip Pedagógico
  function onElementMouseEnter(e) {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }

    const target = e.currentTarget;
    const data = target._docenteLensData;
    if (!data || !state.tooltipElement) return;

    state.currentTooltipData = data;
    state.currentTooltipText = target.innerText || target.textContent || "";
    state.currentTooltipAuthor = target._docenteLensAuthor || "Estudiante";

    const scoreBadge = document.getElementById("tt-score-badge");
    const factorsList = document.getElementById("tt-factors-list");
    const pedagogyText = document.getElementById("tt-pedagogy-text");
    const modelBox = document.getElementById("tt-model-box");
    const modelName = document.getElementById("tt-model-name");
    const watermarkDesc = document.getElementById("tt-watermark-desc");
    const modelIcon = document.getElementById("tt-model-icon");

    scoreBadge.textContent = `${data.score}% Probabilidad`;
    scoreBadge.className = `tt-score ${data.level === "high" ? "tt-score-high" : "tt-score-medium"}`;

    if (data.modelAttribution && modelBox) {
      modelBox.style.display = "flex";
      const ma = data.modelAttribution;
      const mName = ma.predictedModel || ma.model || "Modelo IA";
      const mConf = ma.confidence ? ` (~${ma.confidence}%)` : "";
      modelName.textContent = `${mName}${mConf}`;
      watermarkDesc.textContent = ma.watermarkInfo || ma.watermark || "Firma estadística de tokens";
      modelBox.style.borderLeftColor = ma.color || "#2563eb";

      if (ma.company === "OpenAI") {
        modelIcon.textContent = "🟢";
      } else if (ma.company === "Anthropic") {
        modelIcon.textContent = "🟠";
      } else if (ma.company === "Google DeepMind" || ma.company === "Google") {
        modelIcon.textContent = "🔵";
      } else if (ma.company === "Midjourney") {
        modelIcon.textContent = "🟣";
      } else if (ma.company === "Adobe") {
        modelIcon.textContent = "🔴";
      } else {
        modelIcon.textContent = "🤖";
      }
    } else if (modelBox) {
      modelBox.style.display = "none";
    }

    factorsList.innerHTML = "";
    const allIndicators = [...(data.indicators || [])];
    if (data.modelAttribution?.detectedFeatures) {
      data.modelAttribution.detectedFeatures.forEach(feat => {
        if (!allIndicators.includes(feat)) {
          allIndicators.unshift(feat);
        }
      });
    }

    allIndicators.forEach(factor => {
      const li = document.createElement("li");
      li.textContent = factor;
      factorsList.appendChild(li);
    });

    pedagogyText.textContent = data.pedagogicalAdvice || "";

    const rect = target.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    state.tooltipElement.style.top = `${rect.bottom + scrollY + 8}px`;
    state.tooltipElement.style.left = `${Math.min(rect.left + scrollX, window.innerWidth - 350)}px`;
    state.tooltipElement.style.display = "block";
  }

  function onElementMouseLeave() {
    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    hideTooltipTimer = setTimeout(() => {
      hideTooltip();
    }, 280);
  }

  function hideTooltip() {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
    if (state.tooltipElement) {
      state.tooltipElement.style.display = "none";
    }
  }

  function showHUD() {
    if (state.hudElement) {
      state.hudElement.style.display = "flex";
    }
  }

  function hideHUD() {
    if (state.hudElement) {
      state.hudElement.style.display = "none";
    }
  }

  // Escuchar mensajes desde el popup (para toggle manual o fijado)
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "togglePinned") {
        state.isPinned = !state.isPinned;
        if (state.isPinned) {
          showHUD();
          scanAndHighlight();
        } else {
          hideHUD();
          clearHighlights();
          hideTooltip();
          hideGoogleDocsCard();
        }
        sendResponse({ isPinned: state.isPinned });
      } else if (request.action === "getStatus") {
        sendResponse({
          isEnabled: state.isEnabled,
          isPinned: state.isPinned,
          highlightCount: state.highlightedElements.length
        });
      }
      return true;
    });
  }
})();
