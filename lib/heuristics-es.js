// Diccionario de heurísticas y patrones léxicos para detección de IA en Español
const DocenteLensHeuristicsES = {
  // Frases y marcadores recurrentes típicos de LLMs en español
  cliches: [
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
    "en síntesis",
    "a modo de conclusión",
    "de manera integral",
    "como piedra angular",
    "forjar un camino"
  ],

  // Palabras individuales con sobre-representación estadística en texto generado por IA
  overusedWords: [
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
    "abismal",
    "omnipresente",
    "perenne"
  ],

  // Patrones estructurales típicos (expresiones regulares)
  patterns: [
    // Introducciones formulaicas
    /^(en primer lugar|por un lado|para comenzar|es necesario destacar)[,:]/i,
    // Conclusiones formulaicas
    /^(en conclusión|en resumen|en síntesis|para finalizar|a modo de cierre)[,:]/i,
    // Estructuras de lista con negrita típicas de ChatGPT: **Concepto:** Explicación
    /\*\*[^*]+\*\*:\s+/g
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DocenteLensHeuristicsES;
}
