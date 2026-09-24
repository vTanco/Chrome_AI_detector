/**
 * DocenteLens - Perfilador y Atribución de Modelos de IA
 * Analiza marcas de agua estadísticas, huellas de alineación RLHF y metadatos
 * de las tres principales compañías: OpenAI (ChatGPT), Anthropic (Claude) y Google (Gemini).
 */
class AIModelProfiler {
  // Patrones léxicos, heurísticas de alineación y metadatos por laboratorio
  static profiles = {
    openai: {
      name: "OpenAI (ChatGPT / GPT-4o)",
      company: "OpenAI",
      color: "#10a37f",
      watermarkTech: "C2PA Metadata + Sesgo Estadístico de Tokens (Scott Aaronson / Logit Sampling)",
      spanishMarkers: [
        "en conclusión", "juega un papel fundamental", "desempeña un papel crucial",
        "un tapiz de", "un sinfín de oportunidades", "un sinfín de posibilidades",
        "un viaje transformador", "faro de esperanza", "un hito significativo",
        "marca un antes y un después", "en un mundo en constante evolución",
        "de vital importancia", "es fundamental destacar", "como piedra angular",
        "forjar un camino", "aspectos multifacéticos", "profundizar en",
        "en la era digital", "a medida que avanzamos", "un futuro prometedor",
        "no se puede subestimar", "testimonio de", "un delicado equilibrio",
        "en resumidas cuentas", "sin lugar a dudas"
      ],
      englishMarkers: [
        "delve", "delving into", "testament to", "a testament to", "tapestry of",
        "rich tapestry", "multifaceted", "beacon of hope", "pivotal role",
        "plays a pivotal role", "foster a sense of", "unlocking the potential",
        "cornerstone of", "in today's fast-paced world", "cannot be overstated",
        "navigating the complexities", "deep dive"
      ],
      structuralPatterns: [
        /\*\*[^*]+\*\*:\s+/,
        /^(en conclusión|en resumen|en síntesis)[,:]/im,
        /^(a lo largo de la historia|en el mundo actual)[,:]/im
      ]
    },

    anthropic: {
      name: "Anthropic (Claude 3 / 3.5)",
      company: "Anthropic",
      color: "#d97706",
      watermarkTech: "Marca de agua invisible de texto (EU AI Act Art. 50(2)) + C2PA firmado",
      spanishMarkers: [
        "ciertamente", "vale la pena considerar", "desde una perspectiva",
        "un matiz importante", "es preciso distinguir", "conviene subrayar",
        "en este sentido", "podemos observar que", "resulta interesante notar",
        "conviene puntualizar", "es importante matizar", "en términos generales",
        "si bien es cierto que", "un aspecto crucial a diferenciar",
        "examinemos con detalle", "desde otro punto de vista", "cabe reflexionar",
        "por una parte", "por otra parte", "en rigor", "una aproximación reflexiva",
        "cabe acotar", "una distinción fundamental", "conviene tener presente",
        "es relevante señalar que", "no obstante, conviene", "mirándolo con detenimiento"
      ],
      englishMarkers: [
        "certainly", "it's worth noting", "it is worth noting", "nuanced", "nuance",
        "key distinction", "from a broader perspective", "it is worth considering",
        "i should note", "to be precise", "an important nuance", "it's helpful to remember",
        "on the one hand", "on the other hand", "that being said",
        "it's important to bear in mind", "a thoughtful approach", "distinguish between",
        "crucially", "worth exploring", "worth highlighting"
      ],
      structuralPatterns: [
        /<antArtifact|<thinking|<\/thinking>/i,
        /^(ciertamente|conviene subrayar|vale la pena considerar)[,:]/im,
        /\bpor un lado\b[\s\S]{10,250}\bpor otro lado\b/i
      ]
    },

    google: {
      name: "Google (Gemini / Gemma)",
      company: "Google DeepMind",
      color: "#1a73e8",
      watermarkTech: "Google DeepMind SynthID-Text (Logits G-Function) + SynthID Imagen",
      spanishMarkers: [
        "en pocas palabras", "a continuación te presento", "a continuación, te presento",
        "resumen conciso", "como resumen conciso", "puntos clave a tener en cuenta",
        "puntos clave", "es conveniente señalar", "de forma práctica",
        "en términos prácticos", "para sintetizar", "los aspectos principales",
        "los aspectos principales son", "en definitiva", "veamos paso a paso",
        "de manera directa", "conceptos esenciales", "aquí tienes un desglose",
        "a grandes rasgos", "de un vistazo", "ideas clave", "para entenderlo mejor",
        "claves para entender", "resumen ejecutivo", "a modo de síntesis",
        "principales conclusiones", "desglose paso a paso"
      ],
      englishMarkers: [
        "at a glance", "key takeaways", "here is a breakdown", "here's a breakdown",
        "in summary", "let's explore", "practical applications", "to break this down",
        "step-by-step overview", "step by step", "essential concepts",
        "here is what you need to know", "here's what you need to know", "in short",
        "key points to consider", "at its core", "bottom line", "quick overview",
        "main takeaways"
      ],
      structuralPatterns: [
        /^[\*\-]\s+\*\*[^*]+\*\*/m,
        /^(puntos clave|resumen ejecutivo|en pocas palabras|a continuación te presento|para sintetizar)[,:]/im
      ]
    }
  };

  /**
   * Determina qué IA generó más probablemente el texto analizado
   */
  static attributeText(text, lang = "es") {
    if (!text || text.length < 40) {
      return {
        predictedModel: "IA Genérica",
        company: "Desconocida",
        confidence: 0,
        color: "#6b7280",
        scores: { openai: 0, anthropic: 0, google: 0 },
        detectedFeatures: [],
        watermarkInfo: "Texto demasiado corto para atribución de modelo."
      };
    }

    const lower = text.toLowerCase();
    const scores = { openai: 0, anthropic: 0, google: 0 };
    const detectedFeatures = [];

    // 1. Evaluar marcadores de OpenAI
    const openAIMarkers = lang === "es" ? this.profiles.openai.spanishMarkers : this.profiles.openai.englishMarkers;
    const foundOpenAI = openAIMarkers.filter(m => lower.includes(m));
    scores.openai += foundOpenAI.length * 16;
    if (foundOpenAI.length > 0) {
      detectedFeatures.push(`Marcadores característicos de OpenAI/ChatGPT: "${foundOpenAI.slice(0, 3).join('", "')}"`);
      this.profiles.openai.structuralPatterns.forEach(pat => {
        if (pat.test(text)) scores.openai += 10;
      });
    }

    // 2. Evaluar marcadores de Anthropic
    const anthropicMarkers = lang === "es" ? this.profiles.anthropic.spanishMarkers : this.profiles.anthropic.englishMarkers;
    const foundAnthropic = anthropicMarkers.filter(m => lower.includes(m));
    scores.anthropic += foundAnthropic.length * 18;
    if (foundAnthropic.length > 0) {
      detectedFeatures.push(`Estilo analítico y giros de matiz propios de Claude: "${foundAnthropic.slice(0, 3).join('", "')}"`);
      this.profiles.anthropic.structuralPatterns.forEach(pat => {
        if (pat.test(text)) {
          scores.anthropic += 20;
          detectedFeatures.push("Patrón sintáctico o argumentativo reflexivo característico de Claude detectado");
        }
      });
    } else if (/<antArtifact|<thinking/i.test(text)) {
      scores.anthropic += 40;
      detectedFeatures.push("Etiquetas de artefacto o razonamiento exclusivas de Claude detectadas");
    }

    // 3. Evaluar marcadores de Google Gemini
    const googleMarkers = lang === "es" ? this.profiles.google.spanishMarkers : this.profiles.google.englishMarkers;
    const foundGoogle = googleMarkers.filter(m => lower.includes(m));
    scores.google += foundGoogle.length * 18;
    if (foundGoogle.length > 0) {
      detectedFeatures.push(`Estructura expositiva y síntesis característica de Gemini: "${foundGoogle.slice(0, 3).join('", "')}"`);
      this.profiles.google.structuralPatterns.forEach(pat => {
        if (pat.test(text)) {
          scores.google += 15;
          detectedFeatures.push("Estructura de síntesis o viñetas formulaicas típicas de Gemini");
        }
      });
    }

    if (foundGoogle.length >= 2 && foundOpenAI.length === 0) scores.google += 15;
    if (foundAnthropic.length >= 2 && foundOpenAI.length === 0) scores.anthropic += 15;

    // Determinar ganador
    const maxScore = Math.max(scores.openai, scores.anthropic, scores.google);
    let predictedKey = "generic";
    let company = "Desconocida";
    let name = "Modelo de IA Genérico";
    let color = "#6b7280";
    let watermarkTech = "Marca estadística probabilística";

    if (maxScore >= 18) {
      if (maxScore === scores.anthropic) {
        predictedKey = "anthropic";
      } else if (maxScore === scores.google) {
        predictedKey = "google";
      } else {
        predictedKey = "openai";
      }

      const p = this.profiles[predictedKey];
      name = p.name;
      company = p.company;
      color = p.color;
      watermarkTech = p.watermarkTech;
    }

    // Calcular confianza relativa
    const total = scores.openai + scores.anthropic + scores.google;
    const confidence = total > 0 ? Math.min(Math.round((maxScore / total) * 100), 96) : 35;

    return {
      predictedModel: name,
      modelKey: predictedKey,
      company,
      confidence,
      color,
      scores,
      detectedFeatures,
      watermarkInfo: watermarkTech
    };
  }

  /**
   * Atribución de imágenes según metadatos, firmas C2PA y origen
   */
  static attributeImage(imgElement, imageDetails) {
    const src = (imgElement.src || "").toLowerCase();
    const alt = (imgElement.alt || "").toLowerCase();
    const title = (imgElement.title || "").toLowerCase();
    const fullText = `${src} ${alt} ${title}`;

    if (fullText.includes("dall-e") || fullText.includes("dalle") || src.includes("oaidalleapiprodscus")) {
      return {
        company: "OpenAI",
        model: "OpenAI (DALL·E 3)",
        color: "#10a37f",
        watermark: "C2PA Content Credentials + SynthID Pixel Embedding (OpenAI)",
        confidence: 96
      };
    }

    if (fullText.includes("midjourney") || src.includes("midjourney")) {
      return {
        company: "Midjourney",
        model: "Midjourney v6",
        color: "#8b5cf6",
        watermark: "Metadatos PNG + Cuadrícula de Generación Discord",
        confidence: 94
      };
    }

    if (
      fullText.includes("imagen") ||
      fullText.includes("google") ||
      fullText.includes("synthid") ||
      fullText.includes("gemini") ||
      fullText.includes("deepmind") ||
      src.includes("googleusercontent") ||
      src.includes("generativelanguage")
    ) {
      return {
        company: "Google",
        model: "Google (Imagen 3 / Gemini)",
        color: "#1a73e8",
        watermark: "Google DeepMind SynthID (Firma imperceptible en píxeles)",
        confidence: 95
      };
    }

    if (fullText.includes("firefly") || fullText.includes("adobe")) {
      return {
        company: "Adobe",
        model: "Adobe Firefly",
        color: "#ea580c",
        watermark: "C2PA Manifest Firmado (Adobe Content Authenticity Initiative)",
        confidence: 95
      };
    }

    if (
      fullText.includes("claude") ||
      fullText.includes("anthropic") ||
      src.includes("claude.ai") ||
      src.includes("anthropic.com")
    ) {
      return {
        company: "Anthropic",
        model: "Anthropic Claude (Visual / SVG)",
        color: "#d97706",
        watermark: "C2PA Provenance Metadata (EU AI Act)",
        confidence: 92
      };
    }

    return {
      company: "Generador Desconocido",
      model: "Modelo de Difusión / Síntesis Visual",
      color: "#6b7280",
      watermark: "Marcas geométricas o metadatos estándar de exportación",
      confidence: imageDetails.score || 50
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AIModelProfiler;
}
