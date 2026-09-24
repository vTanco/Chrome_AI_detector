/**
 * DocenteLens - Detector de Imágenes generadas con IA
 * Analiza metadatos, fuentes, dimensiones y atributos en el navegador de forma 100% gratuita.
 * Soporta firmas de OpenAI DALL-E, Google Imagen (SynthID), Midjourney, Adobe Firefly y Anthropic.
 */
class AIImageDetector {
  static analyze(imgElement) {
    if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
      return { score: 0, isAI: false, reasons: [] };
    }

    const src = (imgElement.src || "").toLowerCase();
    const alt = (imgElement.alt || "").toLowerCase();
    const title = (imgElement.title || "").toLowerCase();
    const className = (imgElement.className || "").toLowerCase();
    
    // Obtener dimensiones con fallbacks (para SVGs inline, atributos HTML o imágenes cargadas)
    const naturalWidth = imgElement.naturalWidth || 
                         imgElement.width || 
                         parseInt(imgElement.getAttribute("width") || "0", 10) || 
                         imgElement.clientWidth || 0;
    const naturalHeight = imgElement.naturalHeight || 
                          imgElement.height || 
                          parseInt(imgElement.getAttribute("height") || "0", 10) || 
                          imgElement.clientHeight || 0;

    // Descartar elementos miniatura, iconos, avatares pequeños o tracking pixels
    if (naturalWidth < 120 || naturalHeight < 120) {
      return { score: 0, isAI: false, reasons: ["Elemento gráfico o icono menor de 120px."] };
    }

    let score = 0;
    const reasons = [];

    // 1. Detección en Atributos de Accesibilidad y Metadatos en el DOM
    const textAttributes = `${alt} ${title} ${className} ${src}`;
    const aiKeywords = [
      { kw: "dall-e", label: "OpenAI DALL·E" },
      { kw: "dalle", label: "OpenAI DALL·E" },
      { kw: "midjourney", label: "Midjourney" },
      { kw: "stable diffusion", label: "Stable Diffusion" },
      { kw: "firefly", label: "Adobe Firefly" },
      { kw: "generada por ia", label: "Marcado como generado por IA" },
      { kw: "generado con ia", label: "Marcado como generado por IA" },
      { kw: "generated with ai", label: "Marcado como generado por IA" },
      { kw: "ai generated", label: "Marcado como generado por IA" },
      { kw: "c2pa", label: "Metadatos C2PA de procedencia sintética" },
      { kw: "imagen 3", label: "Google Imagen 3" },
      { kw: "google imagen", label: "Google Imagen" },
      { kw: "synthid", label: "Google DeepMind SynthID" },
      { kw: "gemini", label: "Google Gemini" },
      { kw: "claude", label: "Anthropic Claude" },
      { kw: "anthropic", label: "Anthropic" }
    ];

    aiKeywords.forEach(item => {
      if (textAttributes.includes(item.kw)) {
        score += 55;
        reasons.push(`Etiqueta identificativa de IA encontrada: "${item.label}".`);
      }
    });

    // 2. URLs y Servidores de origen conocidos de generadores de IA
    const aiOriginPatterns = [
      { pattern: /oaidalleapiprodscus/i, label: "CDN oficial de OpenAI DALL-E" },
      { pattern: /midjourney/i, label: "Servidor de Midjourney" },
      { pattern: /replicate\.delivery/i, label: "Plataforma de generación Replicate" },
      { pattern: /civitai/i, label: "Repositorio de modelos Stable Diffusion Civitai" },
      { pattern: /leonardo\.ai/i, label: "Leonardo.ai" },
      { pattern: /generativelanguage\.googleapis\.com/i, label: "API de generación Google Gemini / Imagen" },
      { pattern: /ai\.google\.dev|gemini\.google\.com|bard\.google\.com/i, label: "Plataforma Google Gemini" },
      { pattern: /claude\.ai|anthropic\.com/i, label: "Servidor de Anthropic Claude" }
    ];

    aiOriginPatterns.forEach(item => {
      if (item.pattern.test(src)) {
        score += 70;
        reasons.push(`URL de imagen alojada en ${item.label}.`);
      }
    });

    // 3. Resolución nativa característica de modelos de difusión
    // Muchos modelos exportan nativamente en cuadrículas exactas: 1024x1024, 512x512, 768x768
    const isClassicAISize = (naturalWidth === 1024 && naturalHeight === 1024) ||
                            (naturalWidth === 512 && naturalHeight === 512) ||
                            (naturalWidth === 768 && naturalHeight === 768);

    if (isClassicAISize) {
      score += 20;
      reasons.push(`Resolución exacta (${naturalWidth}x${naturalHeight}px) típica de exportación por defecto de modelos generativos.`);
    }

    score = Math.min(score, 99);
    const isAI = score >= 45;

    let modelAttribution = null;
    if (isAI && typeof AIModelProfiler !== "undefined") {
      modelAttribution = AIModelProfiler.attributeImage(imgElement, { score, reasons });
    }

    return {
      score,
      isAI,
      reasons,
      dimensions: `${naturalWidth}x${naturalHeight}`,
      modelAttribution,
      pedagogicalAdvice: isAI 
        ? "Orientación: La imagen contiene marcas, metadatos o resoluciones frecuentes en generadores sintéticos. Solicite al alumno las fuentes originales."
        : "Imagen sin evidencias concluyentes de origen sintético."
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AIImageDetector;
}
