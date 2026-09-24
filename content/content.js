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
    tooltipElement: null
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
        <span>DocenteLens Activo • Iluminando contenido IA (⌘)</span>
      `;
      document.body.appendChild(hud);
      state.hudElement = hud;
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

  // Evento Keydown: Iluminar contenido generado por IA al pulsar la tecla Comando ⌘
  window.addEventListener(
    "keydown",
    e => {
      if (!state.isEnabled) return;
      if (state.triggerMode === "commandKey" && isCommandKey(e)) {
        if (e.repeat) return; // Evitar disparos repetidos mientras se mantiene presionada
        state.isHolding = true;
        showHUD();
        scanAndHighlight();
      }
    },
    true
  );

  // Evento Keyup: Al soltar la tecla Comando ⌘, restaurar la página
  window.addEventListener(
    "keyup",
    e => {
      if (state.triggerMode === "commandKey" && isCommandKey(e)) {
        if (state.isHolding && !state.isPinned) {
          state.isHolding = false;
          hideHUD();
          clearHighlights();
          hideTooltip();
        }
      }
    },
    true
  );

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

  // Obtener elementos de texto relevantes para inspeccionar de forma universal
  function getInspectableTextElements() {
    // Buscar párrafos, citas y contenedores de texto estándar
    const rawElements = Array.from(
      document.querySelectorAll(
        "p, li, blockquote, dd, [role='paragraph'], article p, section p, main p, div[class*='paragraph'], div[class*='text'], div[class*='comment']"
      )
    );

    // Contenedores tipo div/section que tienen texto directo sustancial sin etiquetas p hijas
    const leafContainers = Array.from(document.querySelectorAll("div, section, td")).filter(container => {
      if (container.querySelector("p, ul, ol, table, article, div")) return false; // Solo contenedores hoja
      const text = (container.innerText || "").trim();
      return text.length > 70;
    });

    const combined = [...new Set([...rawElements, ...leafContainers])];

    // Filtrar elementos visibles con texto suficiente y fuera de elementos de navegación/scripts
    return combined.filter(el => {
      if (el.closest("nav, header, footer, script, style, noscript, [aria-hidden='true'], svg, button")) {
        return false;
      }
      const text = el.innerText || "";
      return text.trim().length > 60 && isElementInViewport(el);
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
