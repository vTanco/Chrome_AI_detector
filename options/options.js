document.addEventListener("DOMContentLoaded", () => {
  const prefTrigger = document.getElementById("pref-trigger");
  const prefSensitivity = document.getElementById("pref-sensitivity");
  const prefText = document.getElementById("pref-text");
  const prefImages = document.getElementById("pref-images");
  const btnSavePrefs = document.getElementById("btn-save-prefs");
  const saveStatus = document.getElementById("save-status");

  const testInput = document.getElementById("test-input");
  const btnRunTest = document.getElementById("btn-run-test");
  const testResult = document.getElementById("test-result");
  const resScoreBadge = document.getElementById("res-score-badge");
  const resLevelText = document.getElementById("res-level-text");
  const resIndicatorsList = document.getElementById("res-indicators-list");
  const resModelBox = document.getElementById("res-model-box");
  const resModelIcon = document.getElementById("res-model-icon");
  const resModelName = document.getElementById("res-model-name");
  const resWatermarkInfo = document.getElementById("res-watermark-info");

  // Cargar preferencias actuales
  chrome.storage.sync.get(
    {
      triggerMode: "commandKey",
      sensitivity: "balanced",
      detectText: true,
      detectImages: true
    },
    items => {
      prefTrigger.value = items.triggerMode;
      prefSensitivity.value = items.sensitivity;
      prefText.checked = items.detectText;
      prefImages.checked = items.detectImages;
    }
  );

  // Guardar preferencias
  btnSavePrefs.addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        triggerMode: prefTrigger.value,
        sensitivity: prefSensitivity.value,
        detectText: prefText.checked,
        detectImages: prefImages.checked
      },
      () => {
        saveStatus.textContent = "✓ Configuración guardada correctamente";
        setTimeout(() => {
          saveStatus.textContent = "";
        }, 2500);
      }
    );
  });

  // Ejecutar simulador de prueba
  btnRunTest.addEventListener("click", () => {
    const text = testInput.value.trim();
    if (!text) {
      alert("Por favor escribe o pega un texto para analizar.");
      return;
    }

    const result = AITextDetector.analyze(text, prefSensitivity.value);

    testResult.style.display = "block";
    resScoreBadge.textContent = `${result.score}%`;

    resScoreBadge.className = "score-badge";
    if (result.level === "high") {
      resScoreBadge.classList.add("high");
      resLevelText.textContent = "Alta probabilidad de redacción generada por IA";
    } else if (result.level === "medium") {
      resScoreBadge.classList.add("medium");
      resLevelText.textContent = "Probabilidad moderada / Asistencia de IA";
    } else {
      resScoreBadge.classList.add("low");
      resLevelText.textContent = "Estilo de redacción orgánico o humano";
    }

    // Mostrar atribución de modelo
    if (result.modelAttribution && resModelBox) {
      resModelBox.style.display = "flex";
      const ma = result.modelAttribution;
      resModelName.textContent = `${ma.predictedModel} (~${ma.confidence}% certeza de estilo)`;
      resWatermarkInfo.textContent = `Trazabilidad: ${ma.watermarkInfo}`;
      resModelBox.style.borderLeftColor = ma.color;

      if (ma.company === "OpenAI") {
        resModelIcon.textContent = "🟢";
      } else if (ma.company === "Anthropic") {
        resModelIcon.textContent = "🟠";
      } else if (ma.company === "Google DeepMind" || ma.company === "Google") {
        resModelIcon.textContent = "🔵";
      } else {
        resModelIcon.textContent = "🤖";
      }
    } else if (resModelBox) {
      resModelBox.style.display = "none";
    }

    resIndicatorsList.innerHTML = "";
    const allIndicators = [...(result.indicators || [])];
    if (result.modelAttribution?.detectedFeatures) {
      result.modelAttribution.detectedFeatures.forEach(feat => {
        if (!allIndicators.includes(feat)) {
          allIndicators.unshift(feat);
        }
      });
    }

    if (allIndicators.length > 0) {
      allIndicators.forEach(ind => {
        const li = document.createElement("li");
        li.textContent = ind;
        resIndicatorsList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No se encontraron marcadores repetitivos ni patrones sintéticos anómalos.";
      resIndicatorsList.appendChild(li);
    }

    resPedagogy.textContent = result.pedagogicalAdvice || "";
  });
});
