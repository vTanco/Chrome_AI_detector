/**
 * DocenteLens - Script de Contenido Principal
 * Gestiona la interacción "mantener pulsado el ratón para resaltar contenido IA en tiempo real"
 */

(function () {
  // Estado local y configuración por defecto
  const state = {
    isEnabled: true,
    triggerMode: "altClick", // "altClick" (recomendado para Mac), "middleClick", "rightClick", "pinned"
    sensitivity: "balanced",
    detectText: true,
    detectImages: true,
    isHolding: false,
    isPinned: false,
    highlightedElements: [],
    hudElement: null,
    tooltipElement: null
  };

  // Cargar configuración guardada
  chrome.storage.sync.get(
    {
      isEnabled: true,
      triggerMode: "altClick",
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
        <span>DocenteLens Activo • Resaltando contenido IA</span>
      `;
      document.body.appendChild(hud);
      state.hudElement = hud;
    }
  }

  // Comprobar si el evento de ratón coincide con el disparador configurado
  function matchesTrigger(e) {
    if (!state.isEnabled) return false;

    switch (state.triggerMode) {
      case "middleClick":
        return e.button === 1; // Clic en la rueda
      case "altClick":
        return e.altKey && e.button === 0; // Alt / Option + Clic izquierdo (Ideal en Mac)
      case "rightClick":
        return e.button === 2; // Clic derecho
      case "pinned":
        return false; // El modo fijado se activa con toggle
      default:
        return e.altKey && e.button === 0;
    }
  }

  // Evento Mousedown: Iniciar escaneo y resaltado mientras se mantenga presionado
  window.addEventListener(
    "mousedown",
    e => {
      if (matchesTrigger(e)) {
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

  // Evento Mouseup: Al soltar la tecla del ratón, restaurar la página original
  window.addEventListener(
    "mouseup",
    e => {
      if (state.isHolding && !state.isPinned) {
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

    // 1. Análisis de Texto
    if (state.detectText && typeof AITextDetector !== "undefined") {
      const textNodes = getInspectableTextElements();

      textNodes.forEach(el => {
        const text = el.innerText || el.textContent;
        const result = AITextDetector.analyze(text, state.sensitivity);

        if (result.eligible && result.level !== "none") {
          const highlightClass = result.level === "high" ? "docentelens-highlight-high" : "docentelens-highlight-medium";
          el.classList.add(highlightClass);

          // Crear badge informativo
          const badge = document.createElement("span");
          badge.className = `docentelens-badge ${result.level === "high" ? "docentelens-badge-high" : "docentelens-badge-medium"}`;
          badge.textContent = `IA ~${result.score}%`;
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

  // Obtener elementos de texto relevantes para inspeccionar
  function getInspectableTextElements() {
    const candidates = Array.from(
      document.querySelectorAll("p, li, article, blockquote, div > p, section > p")
    );

    // Filtrar elementos visibles con texto suficiente y fuera de scripts/navs
    return candidates.filter(el => {
      if (el.closest("nav, header, footer, script, style, noscript, [aria-hidden='true']")) {
        return false;
      }
      const text = el.innerText || "";
      return text.trim().length > 80 && isElementInViewport(el);
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

    scoreBadge.textContent = `${data.score}% Probabilidad`;
    scoreBadge.className = `tt-score ${data.level === "high" ? "tt-score-high" : "tt-score-medium"}`;

    factorsList.innerHTML = "";
    (data.indicators || []).forEach(factor => {
      const li = document.createElement("li");
      li.textContent = factor;
      factorsList.appendChild(li);
    });

    pedagogyText.textContent = data.pedagogicalAdvice || "";

    const rect = target.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    state.tooltipElement.style.top = `${rect.bottom + scrollY + 8}px`;
    state.tooltipElement.style.left = `${Math.min(rect.left + scrollX, window.innerWidth - 340)}px`;
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
