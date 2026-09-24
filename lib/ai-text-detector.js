/**
 * DocenteLens - Detector Heurístico y Estadístico de Texto IA
 * Diseñado específicamente para entornos educativos: 100% gratuito, local y transparente.
 */
class AITextDetector {
  static analyze(text, sensitivity = "balanced") {
    if (!text || typeof text !== "string") {
      return { score: 0, level: "none", eligible: false, reasons: [] };
    }

    const cleanText = text.trim();
    const words = cleanText.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const wordCount = words.length;

    // Los textos muy cortos (< 25 palabras) producen altas tasas de falsos positivos
    if (wordCount < 25) {
      return {
        score: 0,
        level: "none",
        eligible: false,
        wordCount,
        reasons: ["Fragmento demasiado corto para análisis fiable (mínimo 25 palabras)."]
      };
    }

    // 1. Detectar idioma predominante (ES o EN)
    const lang = this.detectLanguage(cleanText, words);
    const heuristics = lang === "es" ? DocenteLensHeuristicsES : DocenteLensHeuristicsEN;

    // 2. Análisis de "Burstiness" (Uniformidad en la longitud de oraciones)
    const sentences = cleanText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    const sentenceLengths = sentences.map(s => (s.match(/[\p{L}\p{N}]+/gu) || []).length).filter(l => l > 0);
    const burstinessMetrics = this.calculateBurstiness(sentenceLengths);

    // 3. Diversidad Léxica (Type-Token Ratio ajustado)
    const uniqueWords = new Set(words);
    const ttr = (uniqueWords.size / wordCount) * 100;

    // 4. Búsqueda de Marcadores Léxicos y Clichés típicos de IA
    const lowerText = cleanText.toLowerCase();
    const foundCliches = [];
    heuristics.cliches.forEach(cliche => {
      if (lowerText.includes(cliche)) {
        foundCliches.push(cliche);
      }
    });

    const foundOverusedWords = [];
    heuristics.overusedWords.forEach(w => {
      const regex = new RegExp(`\\b${w}\\b`, "gi");
      const matches = cleanText.match(regex);
      if (matches && matches.length >= 2) {
        foundOverusedWords.push(`${w} (${matches.length}x)`);
      }
    });

    // 5. Patrones estructurales y viñetas formulaicas
    let structuralPoints = 0;
    heuristics.patterns.forEach(pat => {
      if (pat.test(cleanText)) {
        structuralPoints += 12;
      }
    });

    // 6. Cálculo Ponderado de Probabilidad
    let score = 0;
    const indicators = [];

    // Factor A: Burstiness (LLMs tienden a un ritmo y longitud de frases muy parejo)
    // Coeficiente de variación (CV): Humano > 0.45, IA suele rondar 0.15 - 0.35
    if (burstinessMetrics.sentenceCount >= 3) {
      if (burstinessMetrics.cv < 0.28) {
        score += 35;
        indicators.push(`Ritmo de oraciones muy uniforme (CV: ${burstinessMetrics.cv.toFixed(2)}). Las personas suelen variar más entre oraciones cortas y complejas.`);
      } else if (burstinessMetrics.cv < 0.38) {
        score += 20;
        indicators.push(`Cadencia de oraciones regular (CV: ${burstinessMetrics.cv.toFixed(2)}).`);
      }
    }

    // Factor B: Densidad de clichés
    const clicheDensity = (foundCliches.length / wordCount) * 100;
    if (foundCliches.length >= 3 || clicheDensity >= 1.2) {
      score += 35;
      indicators.push(`Presencia elevada de frases y transiciones típicas de LLM: "${foundCliches.slice(0, 3).join('", "')}".`);
    } else if (foundCliches.length >= 1) {
      score += 15;
      indicators.push(`Uso de conectores característicos de IA: "${foundCliches.join('", "')}".`);
    }

    // Factor C: Palabras recurrentes
    if (foundOverusedWords.length >= 2) {
      score += 15;
      indicators.push(`Repetición de términos comunes en redacción sintética: ${foundOverusedWords.slice(0, 3).join(", ")}.`);
    }

    // Factor D: Patrones estructurales
    score += Math.min(structuralPoints, 20);
    if (structuralPoints > 0) {
      indicators.push("Estructura formulaica o introducción/conclusión rígida detectada.");
    }

    // Factor E: Ajuste por sensibilidad seleccionada por el docente
    let thresholdMedium = 40;
    let thresholdHigh = 65;
    if (sensitivity === "conservative") {
      thresholdMedium = 55;
      thresholdHigh = 75;
      score = Math.round(score * 0.85);
    } else if (sensitivity === "sensitive") {
      thresholdMedium = 35;
      thresholdHigh = 55;
      score = Math.round(score * 1.15);
    }

    score = Math.min(Math.max(score, 0), 99);

    let level = "none";
    if (score >= thresholdHigh) {
      level = "high";
    } else if (score >= thresholdMedium) {
      level = "medium";
    }

    return {
      score,
      level,
      eligible: true,
      language: lang,
      wordCount,
      sentenceCount: burstinessMetrics.sentenceCount,
      burstinessCV: burstinessMetrics.cv,
      ttr: ttr.toFixed(1),
      foundCliches,
      indicators,
      pedagogicalAdvice: this.getPedagogicalAdvice(level, indicators)
    };
  }

  static detectLanguage(text, words) {
    const spanishCommonWords = new Set(["el", "la", "de", "que", "y", "a", "en", "un", "ser", "se", "no", "haber", "por", "con", "su", "para", "como", "estar", "tener", "le", "lo", "lo", "todo", "pero", "más", "hacer", "o", "poder", "decir", "este", "ir", "otro", "ese", "la", "si", "me", "ya", "ver", "porque", "dar", "cuando", "él", "muy", "sin", "vez", "mucho", "saber", "qué", "sobre", "mi", "alguno", "mismo", "yo", "también", "hasta"]);
    let spanishMatches = 0;
    words.slice(0, 50).forEach(w => {
      if (spanishCommonWords.has(w)) spanishMatches++;
    });
    return spanishMatches >= 4 ? "es" : "en";
  }

  static calculateBurstiness(lengths) {
    if (!lengths || lengths.length < 2) {
      return { sentenceCount: lengths.length || 0, mean: lengths[0] || 0, stdDev: 0, cv: 0.5 };
    }
    const n = lengths.length;
    const mean = lengths.reduce((acc, val) => acc + val, 0) / n;
    const variance = lengths.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    return { sentenceCount: n, mean, stdDev, cv };
  }

  static getPedagogicalAdvice(level, indicators) {
    if (level === "high") {
      return "Orientación para el docente: Este fragmento presenta fuertes indicios estilísticos y de regularidad propios de redacción asistida por IA. No constituye una prueba concluyente; se sugiere conversar con el estudiante sobre el proceso de elaboración de sus ideas.";
    }
    if (level === "medium") {
      return "Orientación para el docente: Contiene algunos patrones típicos de IA o redacción muy estandarizada. Puede corresponder a un uso parcial de herramientas de ayuda o a un estilo formal académico.";
    }
    return "Orientación: Estilo de redacción orgánico con variaciones naturales de longitud y vocabulario.";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AITextDetector;
}
