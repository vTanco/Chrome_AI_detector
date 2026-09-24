/**
 * DocenteLens - Script de Contenido Principal
 * Gestiona la interacción "mantener pulsado el ratón para resaltar contenido IA en tiempo real"
 */

(function () {
  // Estado local y configuración por defecto
  const state = {
    isEnabled: true,
    triggerMode: "commandKey", // "commandKey" (Tecla Comando ⌘ en Mac / Ctrl), "altClick", "middleClick", "rightClick", "pinned"
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

  // Cargar configuración guardada
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

  // Escuchar cambios de configuración desde el popup
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

  // Inicializar contenedores de HUD y Tooltip
  function initUIElements() {
    if (!document.body) return;

    // Tooltip Pedagógico
    if (!state.tooltipElement) {
      const tooltip = document.createElement("div");
      tooltip.id = "docente-lens-tooltip-root";
      tooltip.innerHTML = `
        <div id="docentelens-tooltip">
          <div class="tt-header">
            <span class="tt-title">DocenteLens • Análisis</span>
            <span class="tt-score" id="tt-score-badge">0%</span>
          </div>
          <!-- Atribución de Modelo / Compañía y Marca de Agua -->
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

    // HUD Flotante Activo
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

    // Tarjeta Especial de Análisis para Google Docs y Classroom
    if (!state.gdocsCardElement) {
      const gdocsCard = document.createElement("div");
      gdocsCard.id = "docentelens-gdocs-root";
      gdocsCard.innerHTML = `
        <div id="docentelens-gdocs-card" style="display: none;">
          <div class="gdocs-header">
            <span class="gdocs-badge-env">📄 Google Docs & Classroom • Análisis</span>
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

    hookGoogleDocsEvents();
  }

  const isGoogleDocs = window.location.hostname.includes("docs.google.com");
  const isGoogleClassroom = window.location.hostname.includes("classroom.google.com");

  // Capturar eventos de teclado dentro de los iframes internos de Google Docs
  function hookGoogleDocsEvents() {
    if (!isGoogleDocs) return;

    function attach() {
      const iframes = document.querySelectorAll(".docs-texteventtarget-iframe, iframe");
      iframes.forEach(iframe => {
        if (!iframe._docenteLensHooked) {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.addEventListener("keydown", handleKeyDown, true);
              iframe.contentWindow.addEventListener("keyup", handleKeyUp, true);
              iframe._docenteLensHooked = true;
            }
          } catch (e) {}
        }
      });
    }

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // Obtener texto seleccionado en Google Docs
  function getGoogleDocsSelectedText() {
    try {
      const iframes = document.querySelectorAll(".docs-texteventtarget-iframe, iframe");
      for (const iframe of iframes) {
        if (iframe.contentDocument) {
          const sel = iframe.contentDocument.getSelection()?.toString();
          if (sel && sel.trim().length > 20) return sel.trim();
        }
      }
    } catch (e) {}

    const winSel = window.getSelection()?.toString();
    if (winSel && winSel.trim().length > 20) return winSel.trim();

    return null;
  }

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
      modelName.textContent = `${ma.predictedModel} (~${ma.confidence}% de certeza)`;
      watermarkDesc.textContent = ma.watermarkInfo || "Firma estadística de procedencia";
      modelBox.style.borderLeftColor = ma.color;
      modelIcon.textContent = ma.company === "OpenAI" ? "🟢" : ma.company === "Anthropic" ? "🟠" : "🔵";
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

  // Comprobar si es la tecla Comando (⌘ en Mac) o Control
  function isCommandKey(e) {
    const isMac = (navigator.platform || "").toUpperCase().indexOf("MAC") >= 0;
    if (isMac) {
      return e.key === "Meta" || e.code === "MetaLeft" || e.code === "MetaRight";
    } else {
      return e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight";
    }
  }

  // Comprobar si el evento de ratón coincide con el disparador (si está en modo ratón)
  function matchesMouseTrigger(e) {
    if (!state.isEnabled) return false;

    switch (state.triggerMode) {
      case "middleClick":
        return e.button === 1; // Clic en la rueda
      case "altClick":
        return e.altKey && e.button === 0; // Alt / Option + Clic izquierdo
      case "rightClick":
        return e.button === 2; // Clic derecho
      default:
        return false;
    }
  }

  function handleKeyDown(e) {
    if (!state.isEnabled) return;
    if (state.triggerMode === "commandKey" && isCommandKey(e)) {
      if (e.repeat) return;
      state.isHolding = true;
      showHUD();
      scanAndHighlight();
    }
  }

  function handleKeyUp(e) {
    if (state.triggerMode === "commandKey" && isCommandKey(e)) {
      if (state.isHolding && !state.isPinned) {
        state.isHolding = false;
        hideHUD();
        clearHighlights();
        hideTooltip();
        hideGoogleDocsCard();
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);

  // Evento Mousedown: Si está configurado en modo ratón
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

  // Evento Mouseup: Restaurar si se usa disparador de ratón
  window.addEventListener(
    "mouseup",
    e => {
      if (state.triggerMode !== "commandKey" && state.isHolding && !state.isPinned) {
        state.isHolding = false;
        hideHUD();
        clearHighlights();
        hideTooltip();
      }
    },
    true
  );

  // Si la ventana pierde el foco, limpiar por seguridad
  window.addEventListener("blur", () => {
    if (state.isHolding && !state.isPinned) {
      state.isHolding = false;
      hideHUD();
      clearHighlights();
      hideTooltip();
    }
  });

  // Prevenir menú contextual si se usa el clic derecho como disparador
  window.addEventListener(
    "contextmenu",
    e => {
      if (state.triggerMode === "rightClick" && (state.isHolding || state.isPinned)) {
        e.preventDefault();
      }
    },
    true
  );

  // Escanear el DOM y aplicar resaltados
  function scanAndHighlight() {
    clearHighlights();
    hideGoogleDocsCard();

    // Soporte especial en Google Docs (Editor y Vistas de Tareas)
    if (isGoogleDocs) {
      const selectedText = getGoogleDocsSelectedText();
      if (selectedText) {
        const result = AITextDetector.analyze(selectedText, state.sensitivity);
        if (result.eligible) {
          showGoogleDocsCard(result);
        }
      } else {
        const hudText = document.getElementById("docentelens-hud-text");
        if (hudText) {
          hudText.textContent = "Google Docs: Selecciona texto (o Cmd+A) y mantén presionado ⌘";
        }
      }
    }

    // 1. Análisis de Texto
    if (state.detectText && typeof AITextDetector !== "undefined") {
      const textNodes = getInspectableTextElements();

      textNodes.forEach(el => {
        const text = el.innerText || el.textContent;
        const result = AITextDetector.analyze(text, state.sensitivity);

        if (result.eligible && result.level !== "none") {
          const highlightClass = result.level === "high" ? "docentelens-highlight-high" : "docentelens-highlight-medium";
          el.classList.add(highlightClass);

          // Crear badge informativo con atribución de modelo
          const badge = document.createElement("span");
          badge.className = `docentelens-badge ${result.level === "high" ? "docentelens-badge-high" : "docentelens-badge-medium"}`;
          
          let modelTag = "IA";
          if (result.modelAttribution) {
            if (result.modelAttribution.company === "OpenAI") modelTag = "ChatGPT";
            else if (result.modelAttribution.company === "Anthropic") modelTag = "Claude";
            else if (result.modelAttribution.company === "Google DeepMind" || result.modelAttribution.company === "Google") modelTag = "Gemini";
          }
          badge.textContent = `${modelTag} ~${result.score}%`;
          el.appendChild(badge);

          // Guardar metadatos para tooltip interactivo
          el._docenteLensData = result;
          el.addEventListener("mouseenter", onElementMouseEnter);
          el.addEventListener("mouseleave", onElementMouseLeave);

          state.highlightedElements.push({ element: el, badge });
        }
      });
    }

    // 2. Análisis de Imágenes
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
        "docentelens-image-highlight"
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

  // Obtener elementos de texto relevantes para inspeccionar de forma universal (incluyendo Classroom y Google Docs)
  function getInspectableTextElements() {
    // Buscar párrafos, citas y contenedores de texto estándar y educativos (Classroom / Docs)
    const rawElements = Array.from(
      document.querySelectorAll(
        "p, li, blockquote, dd, [role='paragraph'], [role='document'] p, article p, section p, main p, div[class*='paragraph'], div[class*='text'], div[class*='comment'], div[data-message-author], .MuiTypography-root, .kix-lineview, .kix-paragraphrenderer, .kix-wordhtmlgenerator-wordnode, [aria-label]"
      )
    );

    // Contenedores tipo div/section que tienen texto directo sustancial sin etiquetas p hijas
    const leafContainers = Array.from(document.querySelectorAll("div, section, td, [role='listitem']")).filter(container => {
      if (container.querySelector("p, ul, ol, table, article, div")) return false; // Solo contenedores hoja
      const text = (container.innerText || "").trim();
      return text.length > 60;
    });

    const combined = [...new Set([...rawElements, ...leafContainers])];

    // Filtrar elementos visibles con texto suficiente y fuera de elementos de navegación/scripts
    return combined.filter(el => {
      if (el.closest("nav, header, footer, script, style, noscript, [aria-hidden='true'], svg, button, .docs-title-widget, .docs-menubar")) {
        return false;
      }
      const text = el.innerText || "";
      return text.trim().length > 50 && isElementInViewport(el);
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

  // Tooltip Pedagógico para docentes al pasar el cursor sobre un bloque detectado
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

    // Mostrar atribución de modelo y marca de agua
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
})();
