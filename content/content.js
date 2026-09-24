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
    const isMac = (navigator.platform || "").toUpperCase().indexOf("MAC") >= 0;
    if (isMac) {
      return e.key === "Meta" || e.code === "MetaLeft" || e.code === "MetaRight" || e.metaKey;
    } else {
      return e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight" || e.ctrlKey;
    }
  }

  // Si nos encontramos en un sub-iframe (como el iframe de teclado de Google Docs o Classroom)
  if (!isTopFrame) {
    window.addEventListener(
      "keydown",
      e => {
        if (isCommandKey(e)) {
          try {
            window.top.postMessage(
              { type: "DOCENTELENS_KEY", action: "keydown", repeat: e.repeat },
              "*"
            );
          } catch (err) {}
        }
      },
      true
    );

    window.addEventListener(
      "keyup",
      e => {
        if (isCommandKey(e)) {
          try {
            window.top.postMessage({ type: "DOCENTELENS_KEY", action: "keyup" }, "*");
          } catch (err) {}
        }
      },
      true
    );

    window.addEventListener(
      "paste",
      e => {
        try {
          const text = e.clipboardData?.getData("text/plain");
          if (text && text.trim().length > 15) {
            window.top.postMessage({ type: "DOCENTELENS_CLIPBOARD", action: "paste", text: text.trim() }, "*");
          }
        } catch (err) {}
      },
      true
    );

    window.addEventListener(
      "copy",
      e => {
        try {
          const text = e.clipboardData?.getData("text/plain");
          if (text && text.trim().length > 15) {
            window.top.postMessage({ type: "DOCENTELENS_CLIPBOARD", action: "copy", text: text.trim() }, "*");
          }
        } catch (err) {}
      },
      true
    );

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

    // 2. HUD Flotante Activo Superior
    if (!state.hudElement) {
      const hud = document.createElement("div");
      hud.id = "docentelens-hud";
      hud.style.display = "none";
      hud.innerHTML = `
        <span class="hud-pulse"></span>
        <span id="docentelens-hud-text">DocenteLens Activo • Iluminando contenido IA (⌘)</span>
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
            <span class="gdocs-badge-env">📄 Google Docs • Peritaje de Redacción IA</span>
            <span class="tt-score" id="gdocs-score-badge">0%</span>
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
        </div>
      `;
      document.body.appendChild(gdocsCard);
      state.gdocsCardElement = document.getElementById("docentelens-gdocs-card");
    }

    hookAllInputsAndIframes();
  }

  // Escuchar mensajes provenientes de sub-iframes (teclado de Google Docs / Classroom)
  window.addEventListener("message", e => {
    if (e.data?.type === "DOCENTELENS_KEY") {
      if (e.data.action === "keydown" && !e.data.repeat) {
        handleHoldStart();
      } else if (e.data.action === "keyup") {
        handleHoldEnd();
      }
    } else if (e.data?.type === "DOCENTELENS_CLIPBOARD") {
      if (e.data.text && e.data.text.trim().length > 15) {
        lastPastedOrCopiedText = e.data.text.trim();
        cachedGoogleDocsText = e.data.text.trim();
      }
    }
  });

  // Vincular eventos de teclado y portapapeles a todos los iframes presentes y futuros
  function hookAllInputsAndIframes() {
    function attachToIframes() {
      const iframes = document.querySelectorAll(".docs-texteventtarget-iframe, iframe");
      iframes.forEach(iframe => {
        if (!iframe._docenteLensHooked) {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.addEventListener(
                "keydown",
                e => {
                  if (state.triggerMode === "commandKey" && isCommandKey(e)) {
                    if (e.repeat) return;
                    handleHoldStart();
                  }
                },
                true
              );

              iframe.contentWindow.addEventListener(
                "keyup",
                e => {
                  if (state.triggerMode === "commandKey" && isCommandKey(e)) {
                    handleHoldEnd();
                  }
                },
                true
              );

              iframe.contentWindow.addEventListener(
                "paste",
                e => {
                  const text = e.clipboardData?.getData("text/plain");
                  if (text && text.trim().length > 15) {
                    lastPastedOrCopiedText = text.trim();
                    cachedGoogleDocsText = text.trim();
                  }
                },
                true
              );

              iframe._docenteLensHooked = true;
            }
          } catch (e) {}
        }
      });
    }

    attachToIframes();
    const observer = new MutationObserver(attachToIframes);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // Interceptar copy y paste en la ventana superior para alimentar el buffer de texto
  window.addEventListener(
    "paste",
    e => {
      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 15) {
        lastPastedOrCopiedText = text.trim();
        cachedGoogleDocsText = text.trim();
      }
    },
    true
  );

  window.addEventListener(
    "copy",
    e => {
      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim().length > 15) {
        lastPastedOrCopiedText = text.trim();
      }
    },
    true
  );

  // Extraer el identificador del documento de Google Docs
  function getGoogleDocsId() {
    const match = window.location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Extraer el texto completo del documento de Google Docs (Export Nativo + Fallbacks DOM)
  async function getGoogleDocsContent() {
    const docId = getGoogleDocsId();
    const now = Date.now();

    // 1. Usar export nativo mediante la sesión autenticada de Google Docs
    if (docId) {
      if (cachedGoogleDocsText && now - lastGoogleDocsFetchTime < 3000) {
        return cachedGoogleDocsText;
      }

      try {
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const res = await fetch(exportUrl, { credentials: "include" });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 15) {
            cachedGoogleDocsText = text.trim();
            lastGoogleDocsFetchTime = now;
            return cachedGoogleDocsText;
          }
        }
      } catch (err) {
        // En caso de bloqueo por red, proceder con los siguientes fallbacks
      }
    }

    // 2. Si hay texto recién pegado o copiado en este documento
    if (lastPastedOrCopiedText && lastPastedOrCopiedText.length > 20) {
      return lastPastedOrCopiedText;
    }

    // 3. Inspeccionar capas de accesibilidad y nodos DOM de Google Docs
    const accNodes = document.querySelectorAll(
      '[aria-label="Document content"], [role="textbox"], .docs-texteventtarget-iframe, [data-paragraph-id], .kix-lineview'
    );
    let domText = "";
    accNodes.forEach(n => {
      const t = n.innerText || n.textContent || "";
      if (t) domText += " " + t;
    });
    if (domText.trim().length > 25) {
      return domText.trim();
    }

    // 4. Selección manual tradicional
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 20) {
      return sel.trim();
    }

    return null;
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
    state.gdocsCardElement.style.display = "block";
  }

  function hideGoogleDocsCard() {
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

  // Eventos de teclado en la ventana superior
  window.addEventListener(
    "keydown",
    e => {
      if (state.triggerMode === "commandKey" && isCommandKey(e)) {
        if (e.repeat) return;
        handleHoldStart();
      }
    },
    true
  );

  window.addEventListener(
    "keyup",
    e => {
      if (state.triggerMode === "commandKey" && isCommandKey(e)) {
        handleHoldEnd();
      }
    },
    true
  );

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

  window.addEventListener("blur", () => {
    if (state.isHolding && !state.isPinned) {
      state.isHolding = false;
      hideHUD();
      clearHighlights();
      hideTooltip();
      hideGoogleDocsCard();
    }
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
    hideGoogleDocsCard();

    // A. Tratamiento específico e iluminación para Google Docs
    if (isGoogleDocs) {
      const hudText = document.getElementById("docentelens-hud-text");
      if (hudText) {
        hudText.textContent = "DocenteLens Activo • Analizando Documento de Google...";
      }

      const docContent = await getGoogleDocsContent();
      if (!state.isHolding && !state.isPinned) return; // Se soltó la tecla antes de finalizar

      if (docContent) {
        const result = AITextDetector.analyze(docContent, state.sensitivity);
        if (result.eligible && result.level !== "none") {
          // Iluminar la superficie del Canvas y Páginas de Google Docs
          const gdocsElements = document.querySelectorAll(
            ".kix-page, .kix-page-paginated, .kix-canvas-tile-content, .docs-editor-container, #docs-editor, .kix-zoom-wrapper"
          );

          let highlightClass = "docentelens-gdocs-highlight";
          if (result.modelAttribution) {
            const comp = result.modelAttribution.company || "";
            if (comp === "OpenAI") highlightClass = "docentelens-gdocs-highlight-openai";
            else if (comp === "Anthropic") highlightClass = "docentelens-gdocs-highlight-anthropic";
            else if (comp.includes("Google")) highlightClass = "docentelens-gdocs-highlight-google";
          }

          gdocsElements.forEach(el => {
            el.classList.add(highlightClass);
            state.highlightedElements.push({ element: el, badge: null });
          });

          showGoogleDocsCard(result);

          if (hudText) {
            const mName = result.modelAttribution ? result.modelAttribution.predictedModel : "IA";
            hudText.textContent = `DocenteLens Activo • ${mName} detectado (~${result.score}%) en Google Docs`;
          }
          return;
        } else if (hudText) {
          hudText.textContent = "DocenteLens Activo • Google Docs: Redacción orgánica o humana detectada";
          return;
        }
      } else if (hudText) {
        hudText.textContent = "Google Docs: Escribe, pega o selecciona texto y mantén presionado ⌘";
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
          const highlightClass = result.level === "high" ? "docentelens-highlight-high" : "docentelens-highlight-medium";
          el.classList.add(highlightClass);

          const badge = document.createElement("span");
          badge.className = `docentelens-badge ${result.level === "high" ? "docentelens-badge-high" : "docentelens-badge-medium"}`;

          let modelTag = "IA";
          if (result.modelAttribution) {
            const comp = result.modelAttribution.company || "";
            if (comp === "OpenAI") modelTag = "ChatGPT";
            else if (comp === "Anthropic") modelTag = "Claude";
            else if (comp.includes("Google")) modelTag = "Gemini";
          }
          badge.textContent = `${modelTag} ~${result.score}%`;
          el.appendChild(badge);

          el._docenteLensData = result;
          el.addEventListener("mouseenter", onElementMouseEnter);
          el.addEventListener("mouseleave", onElementMouseLeave);

          state.highlightedElements.push({ element: el, badge });
        }
      });
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
      hudText.textContent = "DocenteLens Activo • Iluminando contenido IA (⌘)";
    }

    state.highlightedElements.forEach(({ element, badge }) => {
      element.classList.remove(
        "docentelens-highlight-high",
        "docentelens-highlight-medium",
        "docentelens-image-highlight",
        "docentelens-gdocs-highlight",
        "docentelens-gdocs-highlight-anthropic",
        "docentelens-gdocs-highlight-google",
        "docentelens-gdocs-highlight-openai"
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

  // Obtener elementos de texto relevantes para inspeccionar
  function getInspectableTextElements() {
    const rawElements = Array.from(
      document.querySelectorAll(
        "p, li, blockquote, dd, [role='paragraph'], [role='document'] p, article p, section p, main p, div[class*='paragraph'], div[class*='text'], div[class*='comment'], div[data-message-author], .MuiTypography-root, [aria-label]"
      )
    );

    const leafContainers = Array.from(document.querySelectorAll("div, section, td, [role='listitem']")).filter(container => {
      if (container.querySelector("p, ul, ol, table, article, div")) return false;
      const text = (container.innerText || "").trim();
      return text.length > 60;
    });

    const combined = [...new Set([...rawElements, ...leafContainers])];

    return combined.filter(el => {
      if (el.closest("nav, header, footer, script, style, noscript, [aria-hidden='true'], svg, button, .docs-title-widget, .docs-menubar")) {
        return false;
      }
      const text = el.innerText || "";
      return text.trim().length > 45 && isElementInViewport(el);
    });
  }

  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
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
