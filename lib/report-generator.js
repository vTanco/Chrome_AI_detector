/**
 * DocenteLens - Generador de Informes Periciales Pedagógicos y Rúbricas Formativas
 * Genera informes imprimibles y descargables en PDF de forma 100% local (sin dependencias ni telemetría).
 * Diseñado conforme a la ética pedagógica y las directrices del Reglamento Europeo de IA (EU AI Act).
 */

class DocenteLensReportGenerator {
  /**
   * Genera preguntas formativas de contraste oral para que el docente
   * verifique en 30 segundos si el alumno comprende el contenido entregado.
   */
  static generateOralDefenseQuestions(text, result) {
    const questions = [];
    if (!text || typeof text !== "string") return questions;

    const lower = text.toLowerCase();
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];

    // Extraer sustantivos técnicos o palabras especializadas (> 6 letras no comunes)
    const stopWords = new Set([
      "porque", "cuando", "donde", "aunque", "durante", "mediante", "también", "además",
      "nuestro", "nuestra", "vuestro", "vuestra", "primer", "primera", "segundo", "segunda",
      "importante", "fundamental", "general", "posible", "diferente", "ejemplo", "conclusión"
    ]);

    const technicalTerms = [];
    words.forEach(w => {
      const lw = w.toLowerCase();
      if (lw.length >= 6 && !stopWords.has(lw) && !technicalTerms.includes(w)) {
        // Filtrar términos de interés (sustantivos relevantes)
        if (/[A-ZÁÉÍÓÚ]/.test(w) || lw.endsWith("ción") || lw.endsWith("dor") || lw.endsWith("ico") || lw.endsWith("ica") || lw.endsWith("miento")) {
          technicalTerms.push(w);
        }
      }
    });

    const term1 = technicalTerms[0] || "los conceptos principales";
    const term2 = technicalTerms[1] || "las especificaciones técnicas";
    const term3 = technicalTerms[2] || "la conclusión del proyecto";

    // Pregunta 1: Definición y comprensión conceptual profunda
    questions.push({
      topic: "Comprensión conceptual",
      question: `Explícame con tus propias palabras qué entiendes por "${term1}" y por qué decidiste incluirlo en esta parte de tu trabajo.`
    });

    // Pregunta 2: Justificación del proceso y toma de decisiones
    if (lower.includes("presupuesto") || lower.includes("precio") || lower.includes("coste") || lower.includes("€") || lower.includes("%")) {
      questions.push({
        topic: "Criterio y justificación cuantitativa",
        question: "En el trabajo mencionas cifras y porcentajes concretos. ¿De qué fuentes obtuviste esos valores y cómo verificaste que eran razonables?"
      });
    } else {
      questions.push({
        topic: "Criterio metodológico",
        question: `En relación a "${term2}", ¿qué alternativas consideraste antes de decantarte por esta opción y cuál fue tu criterio?`
      });
    }

    // Pregunta 3: Transferencia práctica y defensa oral
    questions.push({
      topic: "Defensa práctica en pizarra / clase",
      question: `Si tuvieras que resumirle en un minuto a un compañero en la pizarra cómo afecta "${term3}" al resultado final, ¿cómo se lo explicarías de forma práctica?`
    });

    return questions;
  }

  /**
   * Construye el documento HTML completo del informe pericial con estilos @media print
   */
  static buildReportHTML(data) {
    const {
      title = "Informe Pericial de Originalidad y Procedencia de IA",
      url = (typeof window !== "undefined" && window.location) ? window.location.href : "https://documento-analizado.local",
      date = new Date().toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" }),
      score = 0,
      level = "none",
      modelAttribution = null,
      indicators = [],
      textSnippet = "",
      wordCount = 0,
      studentName = "Estudiante / Autor no especificado"
    } = data;

    const questions = this.generateOralDefenseQuestions(textSnippet, { score, level, modelAttribution });

    const isHigh = level === "high";
    const isMedium = level === "medium";
    const isOrganic = level === "none";

    const badgeColor = isHigh ? "#ef4444" : isMedium ? "#f59e0b" : "#10b981";
    const badgeText = isHigh ? `${score}% • Alta Probabilidad de IA` : isMedium ? `${score}% • Probabilidad Media` : `${score}% • Redacción Orgánica`;

    const modelName = modelAttribution ? modelAttribution.predictedModel : (isOrganic ? "Sin indicios sintéticos" : "Modelo IA Genérico");
    const modelConfidence = modelAttribution?.confidence ? `(~${modelAttribution.confidence}% certeza de firma)` : "";
    const modelWatermark = modelAttribution?.watermarkInfo || "Firma probabilística de tokens y estilo discursivo";

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocenteLens - Peritaje: ${title}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.55;
      font-size: 13.5px;
    }
    .report-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      font-size: 14px;
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .header-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 3px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      background: #f1f5f9;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 12.5px;
    }
    .meta-item strong { color: #334155; }
    .verdict-box {
      border: 2px solid ${badgeColor};
      background: ${isHigh ? "#fef2f2" : isMedium ? "#fffbeb" : "#f0fdf4"};
      border-radius: 10px;
      padding: 18px 22px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .verdict-info h3 {
      margin: 0 0 6px 0;
      font-size: 17px;
      color: #0f172a;
    }
    .verdict-info p {
      margin: 0;
      font-size: 13px;
      color: #475569;
    }
    .verdict-score {
      background: ${badgeColor};
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 30px;
      white-space: nowrap;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin: 24px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .snippet-box {
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #334155;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .indicators-list {
      margin: 0;
      padding-left: 20px;
      color: #334155;
    }
    .indicators-list li {
      margin-bottom: 6px;
    }
    .questions-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px 20px;
      margin-top: 10px;
    }
    .question-item {
      margin-bottom: 12px;
    }
    .question-item:last-child { margin-bottom: 0; }
    .question-tag {
      font-size: 11px;
      font-weight: 700;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .question-text {
      font-size: 13px;
      color: #1e3a8a;
      font-weight: 500;
    }
    .pedagogy-note {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 12.5px;
      color: #525252;
      margin-top: 20px;
    }
    .actions-bar {
      margin-top: 30px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      padding: 9px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: #0f172a;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1e293b;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .footer-stamp {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .report-container {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .actions-bar {
        display: none !important;
      }
      .snippet-box {
        max-height: none;
        overflow: visible;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div class="header-logo">
        <span class="logo-badge">DocenteLens</span>
        <div>
          <h1 class="header-title">Informe Pericial de Originalidad</h1>
          <div class="header-subtitle">Auditoría Ética y Formativa de Redacción Escolar</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; color: #64748b;">Conforme a EU AI Act Art. 50</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><strong>Fecha de emisión:</strong> ${date}</div>
      <div class="meta-item"><strong>Volumen analizado:</strong> ${wordCount} palabras</div>
      <div class="meta-item"><strong>Entorno auditado:</strong> ${url.includes("classroom.google.com") ? "Google Classroom" : url.includes("docs.google.com") ? "Google Docs" : "Entorno Web / LMS"}</div>
      <div class="meta-item"><strong>Estudiante / Autor:</strong> ${studentName}</div>
    </div>

    <div class="verdict-box">
      <div class="verdict-info">
        <h3>Dictamen: ${modelName} ${modelConfidence}</h3>
        <p>${modelWatermark}</p>
      </div>
      <div class="verdict-score">${badgeText}</div>
    </div>

    <div class="section-title">🔍 Indicadores y Huellas Lingüísticas Detectadas</div>
    <ul class="indicators-list">
      ${indicators.length > 0 ? indicators.map(ind => `<li>${ind}</li>`).join("") : "<li>No se han detectado marcadores sintéticos ni marcas de agua de IA. Estilo compatible con redacción humana orgánica.</li>"}
    </ul>

    <div class="section-title">📄 Fragmento Analizado Evidenciado</div>
    <div class="snippet-box">${escapeHTML(textSnippet)}</div>

    <div class="section-title">🗣️ Banco de Preguntas Sugeridas para Contraste Oral en Clase</div>
    <div class="questions-box">
      ${questions.map((q, idx) => `
        <div class="question-item">
          <div class="question-tag">${idx + 1}. ${q.topic}</div>
          <div class="question-text">"${q.question}"</div>
        </div>
      `).join("")}
    </div>

    <div class="pedagogy-note">
      <strong>⚖️ Orientación Formativa para el Docente:</strong> Los detectores estadísticos son herramientas de apoyo pedagógico para orientar el diálogo con el estudiante. Se recomienda utilizar las preguntas de contraste oral anteriores en un entorno distendido para evaluar el dominio real de las competencias curriculares antes de aplicar medidas sancionadoras.
    </div>

    <div class="actions-bar">
      <button class="btn btn-secondary" onclick="window.close()">✕ Cerrar</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    </div>

    <div class="footer-stamp">
      <span>DocenteLens 1.0 • Software Libre y Gratuito para la Comunidad Docente</span>
      <span>100% Procesamiento Local • Cumplimiento Estricto RGPD</span>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Abre el informe pericial en una nueva ventana limpia lista para imprimir o guardar en PDF
   */
  static openPrintableReport(data) {
    const reportHtml = this.buildReportHTML(data);
    const reportWindow = window.open("", "_blank");
    if (reportWindow) {
      reportWindow.document.open();
      reportWindow.document.write(reportHtml);
      reportWindow.document.close();
      // Asegurar que el título de la pestaña se refleje para el nombre de guardado del PDF
      reportWindow.document.title = `DocenteLens_Peritaje_${new Date().toISOString().slice(0, 10)}.pdf`;
      return true;
    }
    return false;
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DocenteLensReportGenerator;
}
