/**
 * DocenteLens - Detector de Imágenes generadas con IA
 * Analiza metadatos, fuentes, dimensiones y atributos en el navegador de forma 100% gratuita.
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
    const naturalWidth = imgElement.naturalWidth || imgElement.width || 0;
    const naturalHeight = imgElement.naturalHeight || imgElement.height || 0;

    // Descartar imágenes miniatura, iconos, avatares pequeños o tracking pixels
    if (naturalWidth < 120 || naturalHeight < 120) {
      return { score: 0, isAI: false, reasons: ["Elemento gráfico o icono menor de 120px."] };
    }

    let score = 0;
    const reasons = [];

    // 1. Detección en Atributos de Accesibilidad y Metadatos en el DOM
    const textAttributes = `${alt} ${title} ${className}`;
    const aiKeywords = [
      { kw: "dall-e", label: "DALL·E" },
      { kw: "dalle", label: "DALL·E" },
      { kw: "midjourney", label: "Midjourney" },
      { kw: "stable diffusion", label: "Stable Diffusion" },
      { kw: "firefly", label: "Adobe Firefly" },
      { kw: "generada por ia", label: "Marcado como generado por IA" },
      { kw: "generated with ai", label: "Marcado como generado por IA" },
      { kw: "ai generated", label: "Marcado como generado por IA" },
      { kw: "c2pa", label: "Metadatos C2PA de procedencia sintética" },
      { kw: "imagen 3", label: "Google Imagen 3" }
    ];

    aiKeywords.forEach(item => {
      if (textAttributes.includes(item.kw) || src.includes(item.kw)) {
        score += 60;
        reasons.push(`Etiqueta identificativa de IA encontrada: "${item.label}".`);
      }
    });

    // 2. URLs y Servidores de origen conocidos de generadores de IA
    const aiOriginPatterns = [
      { pattern: /oaidalleapiprodscus/i, label: "CDN oficial de OpenAI DALL-E" },
      { pattern: /midjourney/i, label: "Servidor de Midjourney" },
      { pattern: /replicate\.delivery/i, label: "Plataforma de generación Replicate" },
      { pattern: /civitai/i, label: "Repositorio de modelos Stable Diffusion Civitai" },
      { pattern: /leonardo\.ai/i, label: "Leonardo.ai" }
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

    return {
      score,
      isAI,
      reasons,
      dimensions: `${naturalWidth}x${naturalHeight}`,
      pedagogicalAdvice: isAI 
        ? "Orientación: La imagen contiene marcas, metadatos o resoluciones frecuentes en generadores sintéticos. Solicite al alumno las fuentes originales."
        : "Imagen sin evidencias concluyentes de origen sintético."
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AIImageDetector;
}
