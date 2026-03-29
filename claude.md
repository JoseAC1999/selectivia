# app_selectividad — Contexto del Proyecto

## Qué es esta app
Web de estudio para la EBAU (Selectividad) española. Permite estudiar con
exámenes reales, flashcards, tests cronometrados, predicciones para 2026 y
temporizador Pomodoro. Usa IA (Claude API) para generar preguntas similares,
explicar errores y recomendar qué estudiar.

## Stack técnico
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Routing:** React Router v6
- **Estado global:** Zustand + localStorage (sin backend)
- **IA:** Anthropic API — modelo `claude-sonnet-4-20250514`
- **Gráficas:** Recharts
- **PDF parsing:** pdf-parse (para leer exámenes si son PDF)

## Estructura de carpetas
```
app_selectividad/
├── selectividad_preguntas/     ← FUENTE DE DATOS OFICIAL (no modificar)
│   ├── Biologia/
│   │   ├── Biologia 2024/      ← preguntas + respuestas + puntuación
│   │   └── Biologia 2025/
│   ├── Fisica/
│   ├── Historia de España/
│   ├── Lengua castellana y literatura II-2/
│   ├── Lengua_Extranjera_Ingles/
│   ├── Matemáticas Aplicadas a las Ciencias Sociales II/
│   ├── Matematicas II/
│   └── Quimica/
├── src/
│   ├── components/             ← componentes reutilizables
│   ├── pages/                  ← una carpeta por página
│   │   ├── Dashboard/
│   │   ├── ExamenesOficiales/
│   │   ├── Predicciones2026/
│   │   ├── Flashcards/
│   │   ├── Tests/
│   │   └── Pomodoro/
│   ├── data/
│   │   ├── ebau/               ← JSON generados de selectividad_preguntas/
│   │   ├── analysis/           ← análisis de frecuencia por materia
│   │   └── predictions/        ← predicciones 2026 por materia
│   ├── store/
│   │   └── useStudyStore.js    ← Zustand: progreso, racha, sesiones
│   └── lib/
│       └── claude.js           ← wrapper Anthropic API
├── scripts/
│   └── parse-exams.js          ← script Node para parsear PDFs a JSON
└── CLAUDE.md                   ← este archivo
```

## Materias incluidas (8 asignaturas)
| Slug | Nombre completo |
|------|----------------|
| `biologia` | Biología |
| `historia` | Historia de España |
| `lengua` | Lengua castellana y literatura II-2 |
| `ingles` | Lengua Extranjera — Inglés |
| `mates-sociales` | Matemáticas Aplicadas a las Ciencias Sociales II |
| `matematicas` | Matemáticas II |
| `quimica` | Química |

## Páginas de la app

### 1. Dashboard `/`
- Tarjetas por materia con % de progreso
- Racha de días estudiados
- Temas más débiles (basado en respuestas falladas)
- Botón "Sesión sugerida" → llama a Claude API con el historial

### 2. Exámenes Oficiales `/examenes`
- Examenes reales 2024 y 2025 por materia
- Modo cronometrado (tiempo real EBAU) o modo revisión
- Corrección automática con puntuación oficial
- Guarda resultado en Zustand

### 3. Predicciones 2026 `/predicciones`
- Basadas en análisis de frecuencia de `src/data/analysis/`
- Badge de confianza: Alta / Media / Baja
- Preguntas modelo generadas por Claude API
- Explicación: "Este tema no apareció en 2025, suele alternar cada año"

### 4. Flashcards `/flashcards`
- Generadas automáticamente desde las respuestas oficiales
- Animación flip (frente = pregunta, dorso = respuesta oficial)
- Repetición espaciada: tarjetas falladas aparecen antes
- Filtro por materia y tema

### 5. Tests `/tests`
- 5 preguntas aleatorias por materia
- Cronómetro visible
- Al terminar: puntuación + Claude AI explica cada error
- Historial de resultados en Zustand

### 6. Pomodoro `/pomodoro`
- 25 min trabajo / 5 min descanso
- Vincular sesión a una materia
- Gráfica semanal de horas por materia (Recharts)

## Wrapper Claude API — src/lib/claude.js
```js
export async function askClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}
```

## Formato JSON de exámenes — src/data/ebau/{slug}.json
```json
{
  "subject": "biologia",
  "questions": [
    {
      "id": "bio-2024-01",
      "year": 2024,
      "topic": "Genética",
      "question": "Texto exacto de la pregunta",
      "answer": "Respuesta oficial completa",
      "points": 2.5,
      "type": "development"
    }
  ]
}
```

## Formato JSON de análisis — src/data/analysis/{slug}-analysis.json
```json
{
  "subject": "biologia",
  "topicFrequency": [
    { "topic": "Genética", "appearances": 2, "totalYears": 2, "avgPoints": 3.0 }
  ],
  "yearlyPatterns": {
    "2024": ["Genética", "Inmunología"],
    "2025": ["Evolución", "Ecología"]
  }
}
```

## Formato JSON de predicciones — src/data/predictions/2026-predictions.json
```json
{
  "year": 2026,
  "subjects": {
    "biologia": [
      {
        "topic": "Genética",
        "confidence": "high",
        "reason": "Apareció en 2024, ausente en 2025 — patrón alternante",
        "predictedQuestion": "...",
        "modelAnswer": "..."
      }
    ]
  }
}
```

## Convenciones de código
- Componentes en PascalCase, archivos en kebab-case
- Un componente por archivo
- Props tipadas con PropTypes o JSDoc
- Sin CSS externo — solo clases Tailwind
- Comentarios en español
- Commits en español y descriptivos

## Variables de entorno — .env
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
Nunca hardcodear la API key. Acceder siempre via `import.meta.env.VITE_ANTHROPIC_API_KEY`.

## Datos de orientaciones 2025-2026
Disponibles en `src/data/orientaciones/{slug}.json` — documentos oficiales
de la Junta de Andalucía con temas que pueden caer en EBAU 2026.
Usar como fuente principal para la página de Predicciones 2026.

## Reglas importantes
1. `selectividad_preguntas` es solo lectura — nunca modificar esos archivos
2. Todo el estado persiste en localStorage vía Zustand
3. Sin backend — la app funciona 100% en el navegador
4. Las predicciones 2026 se generan una vez y se guardan en JSON, no en cada render
5. La API de Anthropic solo se llama cuando el usuario lo pide explícitamente (no en cada carga de página)