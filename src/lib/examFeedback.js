function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function truncate(value, max = 96) {
  const text = compact(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function inferQuestionType(subjectSlug, exam = {}) {
  const raw = compact(`${exam.rawQuestion ?? ''} ${exam.rawAnswer ?? ''}`).toLowerCase()
  if (raw.includes('comentario')) return 'comentario'
  if (raw.includes('test') || raw.includes('opción múltiple') || raw.includes('opcion multiple')) return 'test'
  if (
    ['matematicas', 'mates-sociales', 'quimica', 'biologia'].includes(subjectSlug) &&
    /(calcula|resuelve|problema|ejercicio)/i.test(raw)
  ) {
    return 'practico'
  }
  return 'desarrollo'
}

export function buildTomorrowTasks({
  checklistItems = [],
  selectedGroups = new Set(),
  fallbackSuggestion = null,
  maxTasks = 3,
}) {
  const hasSelectedGroups = selectedGroups && selectedGroups.size > 0
  const pendingChecklist = checklistItems
    .filter((item) => !item.checked)
    .filter((item) => !hasSelectedGroups || selectedGroups.has(item.groupId))
    .sort((a, b) => b.points - a.points)
    .map((item) => ({
      kind: 'criterio',
      label: `Repasar criterio: ${truncate(item.description)}`,
      confidence: item.points,
    }))

  const missingKeywords = (fallbackSuggestion?.missingKeywords ?? [])
    .slice(0, 4)
    .map((keyword) => ({
      kind: 'keyword',
      label: `Incluir concepto clave: ${keyword}`,
      confidence: 0.5,
    }))

  const merged = [...pendingChecklist, ...missingKeywords]
  const seen = new Set()
  const tasks = []

  for (const task of merged) {
    const key = task.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tasks.push(task)
    if (tasks.length >= maxTasks) break
  }

  if (tasks.length === 0) {
    return [
      { kind: 'fallback', label: 'Rehacer una pregunta similar al examen de hoy', confidence: 1 },
      { kind: 'fallback', label: 'Repasar criterios oficiales y subrayar conceptos clave', confidence: 1 },
      { kind: 'fallback', label: 'Autoevaluarte en 10 minutos con respuesta estructurada', confidence: 1 },
    ]
  }

  return tasks
}
