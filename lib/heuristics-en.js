// Diccionario de heurísticas y patrones léxicos para detección de IA en Inglés
// Incluye huellas de OpenAI (ChatGPT), Anthropic (Claude) y Google (Gemini)
const DocenteLensHeuristicsEN = {
  cliches: [
    // --- OpenAI / Common ---
    "in conclusion",
    "to sum up",
    "it is crucial to",
    "it is important to note",
    "delve into",
    "delving into",
    "testament to",
    "a testament to",
    "tapestry of",
    "rich tapestry",
    "multifaceted",
    "beacon of hope",
    "pivotal role",
    "plays a pivotal role",
    "plays a crucial role",
    "in today's world",
    "in today's fast-paced world",
    "in the digital age",
    "ever-evolving landscape",
    "cannot be overstated",
    "cannot be understated",
    "sheds light on",
    "serves as a reminder",
    "foster a sense of",
    "navigating the complexities",
    "at the forefront of",
    "unlocking the potential",
    "a myriad of",
    "poised to",
    "game-changer",
    "cornerstone of",
    "deep dive",
    "intertwined with",
    "catalyst for change",

    // --- Anthropic (Claude) ---
    "it's worth noting",
    "it is worth noting",
    "it is worth considering",
    "nuanced approach",
    "key distinction",
    "from a broader perspective",
    "i should note",
    "to be precise",
    "an important nuance",
    "it's helpful to remember",
    "on the one hand",
    "on the other hand",
    "that being said",
    "it's important to bear in mind",
    "a thoughtful approach",
    "distinguish between",
    "worth exploring",
    "worth highlighting",

    // --- Google (Gemini) ---
    "at a glance",
    "key takeaways",
    "here is a breakdown",
    "here's a breakdown",
    "practical applications",
    "to break this down",
    "step-by-step overview",
    "essential concepts",
    "here's what you need to know",
    "key points to consider",
    "at its core",
    "bottom line",
    "quick overview",
    "main takeaways"
  ],

  overusedWords: [
    "delve",
    "tapestry",
    "multifaceted",
    "pivotal",
    "crucial",
    "paramount",
    "testament",
    "myriad",
    "foster",
    "holistic",
    "synergy",
    "catalyst",
    "beacon",
    "underscore",
    "seamlessly",
    "robust",
    // Claude
    "nuance",
    "nuanced",
    "distinction",
    "thoughtful",
    "delineate",
    "proportional",
    // Gemini
    "breakdown",
    "takeaway",
    "concise",
    "essential",
    "actionable"
  ],

  patterns: [
    /^(in conclusion|furthermore|moreover|on the other hand|it is worth noting|certainly|here is a breakdown)[,:]/i,
    /^(firstly|secondly|finally|step [0-9]+)[,:]/i,
    /\*\*[^*]+\*\*:\s+/,
    /^[\*\-]\s+\*\*[^*]+\*\*/m
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DocenteLensHeuristicsEN;
}
