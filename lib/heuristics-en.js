// Diccionario de heurísticas y patrones léxicos para detección de IA en Inglés
const DocenteLensHeuristicsEN = {
  cliches: [
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
    "it is worth noting",
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
    "catalyst for change"
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
    "robust"
  ],

  patterns: [
    /^(in conclusion|furthermore|moreover|on the other hand)[,:]/i,
    /^(firstly|secondly|finally)[,:]/i,
    /\*\*[^*]+\*\*:\s+/g
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DocenteLensHeuristicsEN;
}
