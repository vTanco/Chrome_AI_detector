document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggle-enabled");
  const selectTrigger = document.getElementById("select-trigger");
  const selectSensitivity = document.getElementById("select-sensitivity");
  const checkText = document.getElementById("check-text");
  const checkImages = document.getElementById("check-images");
  const btnTogglePin = document.getElementById("btn-toggle-pin");
  const pinBtnText = document.getElementById("pin-btn-text");
  const currentTriggerDesc = document.getElementById("current-trigger-desc");

  const triggerLabels = {
    commandKey: "Mantén presionada la tecla <code>Comando ⌘</code> (o Ctrl)",
    altClick: "Mantén presionado <code>Alt + Clic</code>",
    middleClick: "Mantén presionado el <code>Botón central (Rueda)</code>",
    rightClick: "Mantén presionado el <code>Clic derecho</code>"
  };

  // Cargar estado inicial
  chrome.storage.sync.get(
    {
      isEnabled: true,
      triggerMode: "commandKey",
      sensitivity: "balanced",
      detectText: true,
      detectImages: true
    },
    items => {
      toggleEnabled.checked = items.isEnabled;
      selectTrigger.value = items.triggerMode;
      selectSensitivity.value = items.sensitivity;
      checkText.checked = items.detectText;
      checkImages.checked = items.detectImages;
      updateTriggerDescription(items.triggerMode);
    }
  );

  // Consultar estado de la pestaña activa para ver si el modo fijado está activo
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getStatus" }, response => {
        if (chrome.runtime.lastError || !response) return;
        if (response.isPinned) {
          setPinButtonState(true);
        }
      });
    }
  });

  // Guardar cambios al interactuar con los controles
  toggleEnabled.addEventListener("change", () => {
    chrome.storage.sync.set({ isEnabled: toggleEnabled.checked });
  });

  selectTrigger.addEventListener("change", () => {
    const mode = selectTrigger.value;
    chrome.storage.sync.set({ triggerMode: mode });
    updateTriggerDescription(mode);
  });

  selectSensitivity.addEventListener("change", () => {
    chrome.storage.sync.set({ sensitivity: selectSensitivity.value });
  });

  checkText.addEventListener("change", () => {
    chrome.storage.sync.set({ detectText: checkText.checked });
  });

  checkImages.addEventListener("change", () => {
    chrome.storage.sync.set({ detectImages: checkImages.checked });
  });

  // Acción de fijar resaltado
  btnTogglePin.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "togglePinned" }, response => {
        if (chrome.runtime.lastError || !response) return;
        setPinButtonState(response.isPinned);
      });
    });
  });

  function updateTriggerDescription(mode) {
    currentTriggerDesc.innerHTML = triggerLabels[mode] || triggerLabels.altClick;
  }

  function setPinButtonState(isPinned) {
    if (isPinned) {
      btnTogglePin.classList.add("active");
      pinBtnText.textContent = "Quitar fijado (Pestaña activa)";
    } else {
      btnTogglePin.classList.remove("active");
      pinBtnText.textContent = "Fijar resaltado permanente";
    }
  }
});
