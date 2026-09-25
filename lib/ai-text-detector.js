/**
 * DocenteLens - Detector Heurístico y Estadístico de Texto IA
 * Diseñado específicamente para entornos educativos: 100% gratuito, local y transparente.
 * Integra análisis multivariable con atribución específica para OpenAI, Anthropic y Google.
 */
class AITextDetector {
  static analyze(text, sensitivity = "balanced") {
    if (!text || typeof text !== "string") {
      return { score: 0, level: "none", eligible: false, reasons: [] };
    }

    const cleanText = text.trim();
    const words = cleanText.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const wordCount = words.length;

    // Los textos de menos de 3 palabras carecen de contenido lingüístico analizable
    if (wordCount < 3) {
      return {
        score: 0,
        level: "none",
        eligible: false,
        wordCount,
        reasons: ["Fragmento demasiado corto (mínimo 3 palabras)."]
      };
    }

    // 1. Detectar idioma predominante (ES o EN)
    const lang = this.detectLanguage(cleanText, words);
    const heuristics = lang === "es" ? DocenteLensHeuristicsES : DocenteLensHeuristicsEN;

    // 2. Búsqueda de Marcadores Léxicos y Clichés típicos de IA
    const lowerText = cleanText.toLowerCase();
    const foundCliches = [];
    heuristics.cliches.forEach(cliche => {
      if (lowerText.includes(cliche)) {
        foundCliches.push(cliche);
      }
    });

    const foundOverusedWords = [];
    heuristics.overusedWords.forEach(w => {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      if (regex.test(cleanText)) {
        foundOverusedWords.push(w);
      }
    });

    // 3. Patrones estructurales y viñetas formulaicas
    let structuralPoints = 0;
    heuristics.patterns.forEach(pat => {
      if (pat.test(cleanText)) {
        structuralPoints += 15;
      }
    });

    // 4. Peritaje específico de laboratorio (OpenAI, Anthropic Claude, Google Gemini)
    let modelAttribution = null;
    let maxModelScore = 0;
    if (typeof AIModelProfiler !== "undefined") {
      modelAttribution = AIModelProfiler.attributeText(cleanText, lang);
      maxModelScore = Math.max(
        modelAttribution.scores.openai,
        modelAttribution.scores.anthropic,
        modelAttribution.scores.google
      );
    }

    // Criterio de elegibilidad para fragmentos breves (3 a 7 palabras):
    // Solo elegible si contiene al menos un cliché, palabra sobreutilizada, patrón estructural o firma de modelo
    if (wordCount < 8 && foundCliches.length === 0 && foundOverusedWords.length === 0 && structuralPoints === 0 && maxModelScore < 16) {
      return {
        score: 0,
        level: "none",
        eligible: false,
        wordCount,
        reasons: ["Fragmento breve sin marcadores léxicos concluyentes."]
      };
    }

    // 5. Análisis de "Burstiness" (Uniformidad en la longitud de oraciones)
    const rawSentences = cleanText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    const sentences = rawSentences.filter(s => {
      if (s.endsWith(":")) return false;
      if (!/[.!?]$/.test(s) && (s.match(/[\p{L}\p{N}]+/gu) || []).length <= 5) return false;
      return true;
    });

    const sentenceLengths = sentences.map(s => (s.match(/[\p{L}\p{N}]+/gu) || []).length).filter(l => l > 0);
    const burstinessMetrics = this.calculateBurstiness(sentenceLengths);

    // 6. Diversidad Léxica (Type-Token Ratio ajustado)
    const uniqueWords = new Set(words);
    const ttr = (uniqueWords.size / wordCount) * 100;

    // 7. Cálculo Ponderado de Probabilidad
    let score = 0;
    const indicators = [];
    const isShort = wordCount <= 14;

    // Factor A: Burstiness (oraciones múltiples)
    if (burstinessMetrics.sentenceCount >= 2) {
      if (burstinessMetrics.cv < 0.22) {
        score += 30;
        indicators.push(`Ritmo de oraciones muy uniforme (CV: ${burstinessMetrics.cv.toFixed(2)}). Las personas suelen variar más entre oraciones cortas y complejas.`);
      } else if (burstinessMetrics.cv < 0.38) {
        score += 20;
        indicators.push(`Cadencia de oraciones regular (CV: ${burstinessMetrics.cv.toFixed(2)}).`);
      }
    }

    // Factor B: Densidad y presencia de clichés de IA
    const clicheDensity = (foundCliches.length / wordCount) * 100;
    if (foundCliches.length >= 2 || (foundCliches.length >= 1 && wordCount <= 8)) {
      score += isShort ? 60 : 35;
      indicators.push(`Presencia elevada de frases y transiciones típicas de LLM: "${foundCliches.slice(0, 3).join('", "')}".`);
    } else if (foundCliches.length >= 1) {
      score += isShort ? 45 : 20;
      indicators.push(`Uso de conectores o giros característicos de IA: "${foundCliches.slice(0, 3).join('", "')}".`);
    }

    // Factor C: Palabras recurrentes
    if (foundOverusedWords.length >= 2) {
      score += 20;
      indicators.push(`Términos sintéticos recurrentes detectados: ${foundOverusedWords.slice(0, 3).join(", ")}.`);
    } else if (foundOverusedWords.length >= 1 && isShort) {
      score += 15;
      indicators.push(`Términos sintéticos detectados: ${foundOverusedWords.slice(0, 3).join(", ")}.`);
    }

    // Factor D: Patrones estructurales
    score += Math.min(structuralPoints, 35);
    if (structuralPoints > 0) {
      indicators.push("Estructura formulaica, viñetas estandarizadas o consignas de IA detectadas.");
    }

    // Factor E: Atribución de modelo
    if (maxModelScore >= 35) {
      score += 40;
      if (modelAttribution?.detectedFeatures?.length > 0) {
        modelAttribution.detectedFeatures.forEach(feat => {
          if (!indicators.includes(feat)) indicators.unshift(feat);
        });
      }
    } else if (maxModelScore >= 16) {
      score += isShort ? 30 : 25;
      if (modelAttribution?.detectedFeatures?.length > 0) {
        modelAttribution.detectedFeatures.forEach(feat => {
          if (!indicators.includes(feat)) indicators.unshift(feat);
        });
      }
    }

    // Factor F: Ajuste por sensibilidad seleccionada por el docente
    let thresholdMedium = 38;
    let thresholdHigh = 60;
    if (sensitivity === "conservative") {
      thresholdMedium = 50;
      thresholdHigh = 72;
      score = Math.round(score * 0.85);
    } else if (sensitivity === "sensitive") {
      thresholdMedium = 30;
      thresholdHigh = 50;
      score = Math.round(score * 1.15);
    }

    score = Math.min(Math.max(score, 0), 99);

    let level = "none";
    if (score >= thresholdHigh) {
      level = "high";
    } else if (score >= thresholdMedium) {
      level = "medium";
    }

    // Si el nivel es none, no atribuir modelo de IA para evitar confusiones
    if (level === "none") {
      modelAttribution = null;
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
      modelAttribution,
      pedagogicalAdvice: this.getPedagogicalAdvice(level, indicators)
    };
  }

  static detectLanguage(text, words) {
    if (!text) return "es";
    // Caracteres inequívocamente del español
    if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(text)) return "es";

    const lower = text.toLowerCase();
    // Si contiene algún cliché o marcador directo de español
    if (typeof DocenteLensHeuristicsES !== "undefined" && DocenteLensHeuristicsES.cliches) {
      for (let i = 0; i < DocenteLensHeuristicsES.cliches.length; i++) {
        if (lower.includes(DocenteLensHeuristicsES.cliches[i])) return "es";
      }
    }

    const spanishCommonWords = new Set([
      "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a",
      "en", "con", "por", "para", "es", "son", "fue", "era", "se", "que", "y",
      "o", "no", "si", "su", "sus", "tu", "tus", "mi", "mis", "me", "te", "le", "les",
      "nos", "os", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "como",
      "mas", "pero", "sobre", "entre", "sin", "hasta", "desde", "tambien",
      "esta", "estan", "muy", "todo", "todos", "toda", "todas", "ya", "ha", "han", "hay",
      "cada", "otro", "otra", "otros", "otras", "mismo", "misma", "donde", "cuando", "cuanto",
      "quien", "porque", "pues", "sino", "tanto", "tan", "hacer", "hace", "parte", "partes",
      "punto", "puntos", "tarea", "tareas", "rubrica", "proyecto", "entrega", "criterio", "nivel"
    ]);

    const englishCommonWords = new Set([
      "the", "and", "is", "are", "was", "were", "of", "to", "in", "that", "it",
      "with", "as", "for", "on", "by", "this", "from", "at", "have", "has", "had",
      "not", "but", "what", "which", "when", "where", "who", "how"
    ]);

    let spanishMatches = 0;
    let englishMatches = 0;
    words.forEach(w => {
      if (spanishCommonWords.has(w)) spanishMatches++;
      if (englishCommonWords.has(w)) englishMatches++;
    });

    if (spanishMatches > 0 && spanishMatches >= englishMatches) return "es";
    if (englishMatches > spanishMatches) return "en";

    // Si no hay palabras funcionales claras (ej. títulos breves), consultar el entorno
    try {
      if (typeof document !== "undefined") {
        const docLang = (document.documentElement.lang || document.body?.lang || "").toLowerCase();
        if (docLang.startsWith("es")) return "es";
        if (docLang.startsWith("en")) return "en";
      }
      if (typeof navigator !== "undefined" && navigator.language && navigator.language.startsWith("es")) {
        return "es";
      }
    } catch (e) {}

    // Por defecto en DocenteLens (enfocado a la comunidad hispanohablante): español
    return "es";
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
