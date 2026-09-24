// Diccionario de heurísticas y patrones léxicos para detección de IA en Español
// Incluye huellas lingüísticas de OpenAI (ChatGPT), Anthropic (Claude) y Google (Gemini)
const DocenteLensHeuristicsES = {
  // Frases y marcadores recurrentes típicos de LLMs en español
  cliches: [
    // --- Marcadores comunes y OpenAI (ChatGPT) ---
    "en conclusión",
    "en resumen",
    "es fundamental destacar",
    "es importante señalar",
    "vale la pena mencionar",
    "cabe destacar",
    "cabe señalar",
    "juega un papel fundamental",
    "juega un papel crucial",
    "desempeña un papel crucial",
    "desempeña un rol fundamental",
    "a lo largo de la historia",
    "en el mundo actual",
    "hoy en día",
    "en la era digital",
    "en un mundo en constante evolución",
    "un abanico de posibilidades",
    "un sinfín de oportunidades",
    "un sinfín de posibilidades",
    "profundizar en",
    "un tapiz de",
    "un testimonio de",
    "no se puede subestimar",
    "a medida que avanzamos",
    "un futuro prometedor",
    "sin lugar a dudas",
    "en última instancia",
    "un equilibrio delicado",
    "un viaje transformador",
    "un faro de esperanza",
    "marca un antes y un después",
    "un hito significativo",
    "aspectos multifacéticos",
    "de vital importancia",
    "es menester recordar",
    "en resumidas cuentas",
    "a modo de conclusión",
    "de manera integral",
    "como piedra angular",
    "forjar un camino",

    // --- Marcadores y giros característicos de Anthropic (Claude) ---
    "ciertamente",
    "vale la pena considerar",
    "desde una perspectiva",
    "un matiz importante",
    "es preciso distinguir",
    "conviene subrayar",
    "en este sentido",
    "podemos observar que",
    "resulta interesante notar",
    "conviene puntualizar",
    "es importante matizar",
    "en términos generales",
    "si bien es cierto que",
    "un aspecto crucial a diferenciar",
    "examinemos con detalle",
    "desde otro punto de vista",
    "cabe reflexionar",
    "por una parte",
    "por otra parte",
    "en rigor",
    "una aproximación reflexiva",
    "cabe acotar",
    "una distinción fundamental",
    "conviene tener presente",
    "es relevante señalar que",

    // --- Marcadores y estructuras características de Google (Gemini) ---
    "en pocas palabras",
    "a continuación te presento",
    "resumen conciso",
    "como resumen conciso",
    "conceptos esenciales",
    "los aspectos principales",
    "aspectos principales a tener en cuenta",
    "para sintetizar",
    "puntos clave a tener en cuenta",
    "puntos clave",
    "en definitiva",
    "de forma práctica",
    "en términos prácticos",
    "veamos paso a paso",
    "de manera directa",
    "ideas clave",
    "aquí tienes un desglose",
    "a grandes rasgos",
    "de un vistazo",
    "claves para entender",
    "a modo de síntesis",
    "principales conclusiones"
  ],

  // Palabras individuales con sobre-representación estadística en texto generado por IA
  overusedWords: [
    // OpenAI / General
    "fundamental",
    "crucial",
    "integral",
    "multifacético",
    "trascendental",
    "inherente",
    "intrínseco",
    "enriquecedor",
    "catalizador",
    "resiliencia",
    "paradigma",
    "sinergia",
    "holístico",
    "emblemático",
    "faro",
    "tapiz",
    "omnipresente",
    "perenne",

    // Anthropic (Claude)
    "matiz",
    "matizada",
    "matizado",
    "perspectiva",
    "distinción",
    "reflexión",
    "ponderar",
    "rigor",
    "equidad",
    "proporcionalidad",
    "diferenciar",
    "puntualizar",

    // Google (Gemini)
    "desglose",
    "conciso",
    "esencial",
    "síntesis",
    "sintetizar",
    "práctico",
    "panorámica",
    "cúbits",
    "cúbit"
  ],

  // Patrones estructurales típicos (expresiones regulares sin /g para evitar bugs de statefulness en .test())
  patterns: [
    // Introducciones formulaicas
    /^(en primer lugar|por un lado|para comenzar|es necesario destacar|ciertamente|vale la pena considerar|a continuación te presento)[,:]/i,
    // Conclusiones formulaicas
    /^(en conclusión|en resumen|en síntesis|para finalizar|a modo de cierre|en definitiva|en pocas palabras)[,:]/i,
    // Estructuras de lista con negrita típicas: **Concepto:** Explicación
    /\*\*[^*]+\*\*:\s+/,
    // Viñetas con negrita típicas de Gemini / resúmenes
    /^[\*\-]\s+\*\*[^*]+\*\*/m
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DocenteLensHeuristicsES;
}
