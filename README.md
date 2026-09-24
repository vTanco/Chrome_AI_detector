# 🎓 DocenteLens

> **Detector y resaltador visual de contenido generado por IA en tiempo real para educadores.**  
> *100% gratuito, de código abierto, respetuoso con la privacidad del estudiante y diseñado específicamente para el ámbito pedagógico.*

---

## 🌟 ¿Qué es DocenteLens?

**DocenteLens** es una extensión para Google Chrome (Manifest V3) creada para que docentes, profesores y evaluadores académicos puedan identificar indicios de texto e imágenes generados mediante Inteligencia Artificial (ChatGPT, Claude, Gemini, Midjourney, DALL-E) **de forma instantánea y no destructiva**.

A diferencia de los detectores de pago tradicionales basados en "cajas negras" que emiten porcentajes opacos sin explicación, DocenteLens:
1. **Funciona bajo demanda ("Hold-to-Highlight"):** Mientras mantienes pulsada una combinación del ratón (por defecto `Alt + Clic` o el botón central de la rueda), los párrafos e imágenes sospechosos se iluminan en la pantalla con un indicador de confianza y métricas explicativas.
2. **Restauración instantánea y limpia:** Al soltar el ratón o la tecla, la página vuelve inmediatamente a su estado original sin alterar el diseño ni recargar el navegador.
3. **100% Local y Privado:** No envía los trabajos de los estudiantes a ningún servidor externo. El procesamiento se realiza 100% en el navegador del docente.
4. **Enfoque Pedagógico Transparente:** Muestra exactamente los factores analizados (varianza de longitud de oraciones o *burstiness*, densidad de clichés sintéticos, fórmulas rígidas) para fomentar una conversación formativa con el alumno en lugar de acusaciones infundadas.

---

## 🖱️ Modos de Activación con el Ratón

Puedes seleccionar el disparador que mejor se adapte a tu forma de trabajar desde el icono de la extensión:

| Disparador | Ideal para | Descripción |
| :--- | :--- | :--- |
| **`Alt / Option + Clic`** *(Por defecto)* | **Mac y Trackpads** | Mantén pulsada la tecla `Alt`/`Option` y haz clic sostenido sobre la página. |
| **`Botón Central (Rueda)`** | **Ratones de sobremesa** | Mantén pulsada la rueda del ratón hacia abajo para activar la lente. |
| **`Clic Derecho sostenido`** | **Navegación con ratón estándar** | Mantén pulsado el botón derecho (suprime el menú contextual mientras inspeccionas). |
| **`Fijar Resaltado` (Pin)** | **Revisión prolongada** | Activa el resaltado de forma continua en la pestaña activa con un solo clic. |

---

## 🔬 ¿Cómo funciona el Motor de Detección?

### 1. Detección de Texto (Múltiples factores lingüísticos)
- **Análisis de *Burstiness* (Cadencia rítmica):** Los textos humanos combinan oraciones muy breves con estructuras complejas (alto coeficiente de variación). Los modelos LLM producen longitudes de frase extremadamente uniformes y predecibles.
- **Densidad de Marcadores y Clichés:** Detección ponderada de conectores y muletillas recurrentes en IA en español e inglés (*"en conclusión"*, *"un tapiz de"*, *"juega un papel fundamental"*, *"a medida que avanzamos"*, *"delve into"*, *"testament to"*).
- **Diversidad Léxica (TTR):** Evaluación de la riqueza y dispersión de vocabulario.
- **Estructuras formulaicas:** Reconocimiento de introducciones y cierres sintéticos estereotipados.

### 2. Detección en Imágenes
- **Metadatos e identificadores:** Rastreo de etiquetas de procedencia sintética (`C2PA`, `Midjourney`, `DALL-E`, `Adobe Firefly`, `Stable Diffusion`).
- **Orígenes de red:** Detección de URLs provenientes de servidores y CDNs de plataformas generativas.
- **Geometría sintética:** Verificación de cuadrículas nativas habituales en modelos de difusión (1024x1024px, 512x512px sin metadatos EXIF fotográficos).

---

## 🚀 Instalación en Google Chrome

Al ser una extensión de código abierto sin intermediarios, puedes instalarla en menos de 1 minuto:

1. Clona o descarga esta carpeta en tu ordenador.
2. Abre Google Chrome y navega a:
   ```
   chrome://extensions/
   ```
3. En la esquina superior derecha, activa el interruptor **"Modo de desarrollador"** (Developer mode).
4. Haz clic en el botón **"Cargar descomprimida"** (Load unpacked).
5. Selecciona la carpeta `docente-ai-lens` de este proyecto.
6. ¡Listo! Verás el icono del birrete 🎓 en la barra de herramientas de Chrome. Fíjalo para tenerlo siempre a mano.

---

## 🧪 Cómo Probar la Extensión

Hemos incluido una página de prueba con ejemplos reales de redacción humana frente a redacción de ChatGPT:

1. Abre el archivo [`test/sample_page.html`](file:///Users/vicentetanco/.gemini/antigravity/scratch/docente-ai-lens/test/sample_page.html) en tu navegador Chrome.
2. Mantén presionado `Alt + Clic izquierdo` (o el botón central del ratón).
3. Observa cómo DocenteLens detecta y resalta el ensayo generado con IA, dejando intacto el texto auténtico del alumno.
4. Pasa el cursor por encima del texto resaltado para ver la tarjeta pedagógica interactiva.

---

## ⚖️ Compromiso Ético para Educadores

> **Nota pedagógica crucial:** Ningún algoritmo de detección de IA es infalible. Las herramientas probabilísticas pueden arrojar falsos positivos, en particular con estudiantes con estilos de redacción muy formales, estructurados o que no son hablantes nativos.
>
> **DocenteLens está concebida como un instrumento de orientación y diálogo formativo**, no como un sistema punitivo o prueba concluyente para sancionar alumnos.

---

## 📁 Estructura del Proyecto

```
docente-ai-lens/
├── manifest.json            # Configuración Manifest V3 para Chrome
├── popup/                   # Ventana emergente de control rápido
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                 # Panel de ajustes y simulador de textos
│   ├── options.html
│   ├── options.css
│   └── options.js
├── content/                 # Lógica inyectada en la página web
│   ├── content.js           # Manejador del ratón ("hold to highlight")
│   └── content.css          # Estilos de resaltado y tooltips
├── background/              # Service Worker en segundo plano
│   └── background.js
├── lib/                     # Motores y heurísticas de detección
│   ├── ai-text-detector.js  # Análisis de burstiness y métricas de texto
│   ├── ai-image-detector.js # Análisis de metadatos e imágenes
│   ├── heuristics-es.js     # Diccionario léxico en Español
│   └── heuristics-en.js     # Diccionario léxico en Inglés
├── icons/                   # Iconos de la extensión (16, 32, 48, 128)
├── test/                    # Entorno de pruebas con ejemplos reales
│   └── sample_page.html
├── LICENSE                  # Licencia abierta MIT
└── README.md
```

---

## 📄 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo [`LICENSE`](file:///Users/vicentetanco/.gemini/antigravity/scratch/docente-ai-lens/LICENSE) para más detalles.
