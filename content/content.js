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
    gdocsCardElement: null
  };

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

    // 1. Tooltip Pedagógico Universal
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
        </div>
      `;
      document.body.appendChild(tooltip);
      state.tooltipElement = document.getElementById("docentelens-tooltip");
    }

    // 2. HUD Flotante Activo (Discreto inferior izquierdo)
    if (!state.hudElement) {
      const hud = document.createElement("div");
      hud.id = "docentelens-hud";
      hud.style.display = "none";
      hud.innerHTML = `
        <span class="hud-pulse"></span>
        <span id="docentelens-hud-text">DocenteLens (⌘)</span>
      `;
      document.body.appendChild(hud);
      state.hudElement = hud;
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
      quickBtn.title = "DocenteLens • Analizar Documento de Google";
      quickBtn.innerHTML = `
        <span class="gdocs-btn-icon">🔍</span>
        <span class="gdocs-btn-text">DocenteLens IA</span>
      `;
      document.body.appendChild(quickBtn);

      quickBtn.addEventListener("click", async e => {
        e.stopPropagation();
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

  // Inicio de activación (mantener pulsado)
  function handleHoldStart() {
    if (!state.isEnabled) return;
    state.isHolding = true;
    showHUD();
    scanAndHighlight();
  }

  // Fin de activación (soltar tecla)
  function handleHoldEnd() {
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

          let modelTag = "IA";
          if (result.modelAttribution) {
            const comp = result.modelAttribution.company || "";
            if (comp === "OpenAI") {
              modelTag = "ChatGPT";
              highlightClass += " docentelens-highlight-high-openai";
            } else if (comp === "Anthropic") {
              modelTag = "Claude";
              highlightClass += " docentelens-highlight-high-anthropic";
            } else if (comp.includes("Google")) {
              modelTag = "Gemini";
              highlightClass += " docentelens-highlight-high-google";
            }
          }
          highlightClass.split(" ").filter(Boolean).forEach(c => el.classList.add(c));

          const badge = document.createElement("span");
          badge.className = `docentelens-badge ${result.level === "high" ? "docentelens-badge-high" : "docentelens-badge-medium"}`;
          badge.textContent = `${modelTag} ~${result.score}%`;
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
        "docentelens-highlight-high-openai"
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
        if (text.length >= 25 && isElementInViewport(el)) {
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

      if (hasPoints && hasLevels && isElementInViewport(container)) {
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

  // Obtener elementos de texto relevantes para inspeccionar
  function getInspectableTextElements() {
    // 1. Google Classroom: Rúbricas y Tarjetas de Criterios especializadas
    const rubricCards = findClassroomRubricsAndCards();

    // 2. Selectores específicos de Google Classroom (instrucciones, consignas, tareas, publicaciones)
    const classroomElements = Array.from(
      document.querySelectorAll(
        '[dir="auto"], .QRiHXd, .tLDEHd, .k330Eb, .asQXV, .Y5v0kf, .b95Du, [data-topic-id] [dir="auto"], div[data-item-id] [dir="auto"], div[data-stream-item-id] [dir="auto"], div[data-item-id] div, div[data-stream-item-id] div, .VfPpkd-WsjYwc'
      )
    );

    // 3. Elementos de texto estándar
    const standardElements = Array.from(
      document.querySelectorAll(
        "p, blockquote, dd, dt, li, [role='paragraph'], [role='document'] p, article p, section p, main p, div[class*='paragraph' i], div[class*='text' i], div[class*='comment' i], div[data-message-author], .MuiTypography-root"
      )
    );

    // 4. Contenedores de contenido educativo y bloques semánticos (instrucciones, tareas, celdas de nivel)
    const contentBlocks = Array.from(
      document.querySelectorAll(
        "div[role='region'], div[role='article'], div[class*='instruction' i], div[class*='description' i], div[class*='assignment' i], div[class*='submission' i], div[class*='criterion' i], div[class*='rubric' i], div[class*='cell' i], div[class*='level' i], div[class*='card' i], div[class*='content' i], div[class*='body' i]"
      )
    );

    // 5. Todos los candidatos a texto
    const allCandidates = [...new Set([...classroomElements, ...standardElements, ...contentBlocks])];

    // Filtrar candidatos válidos en el viewport con texto sustancial (mínimo 8 palabras) y fuera de elementos de UI
    const validCandidates = allCandidates.filter(el => {
      if (el.closest("nav, header, footer, script, style, noscript, [aria-hidden='true'], svg, button, input, textarea, select, option, .docs-title-widget, .docs-menubar, #docentelens-hud, #docentelens-tooltip, #docentelens-gdocs-root, #docentelens-gdocs-quick-button")) {
        return false;
      }
      const text = (el.innerText || "").trim();
      const words = text.match(/[\p{L}\p{N}]+/gu) || [];
      return words.length >= 8 && isElementInViewport(el);
    });

    // 6. Algoritmo de Bloques Hoja (Leaf Text Blocks):
    // Si un contenedor ancestro contiene a otro elemento hijo que también es un bloque de texto válido,
    // se descarta el ancestro para iluminar únicamente el párrafo o bloque hoja específico.
    const leafTextBlocks = validCandidates.filter(cand => {
      return !validCandidates.some(other => other !== cand && cand.contains(other));
    });

    // Combinar rúbricas especializadas y bloques hoja evitando duplicación
    const finalInspectable = [];
    rubricCards.forEach(card => finalInspectable.push(card));

    leafTextBlocks.forEach(block => {
      const isInsideRubric = rubricCards.some(rc => rc !== block && rc.contains(block));
      if (!isInsideRubric) {
        finalInspectable.push(block);
      }
    });

    return [...new Set(finalInspectable)];
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
    const target = e.currentTarget;
    const data = target._docenteLensData;
    if (!data || !state.tooltipElement) return;

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
    hideTooltip();
  }

  function hideTooltip() {
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
