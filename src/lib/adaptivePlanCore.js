export const SUBJECT_META = {
  biologia: { name: 'Biología', color: '#10B981', icon: '🧬' },
  historia: { name: 'Historia', color: '#F59E0B', icon: '🏛️' },
  lengua: { name: 'Lengua', color: '#EC4899', icon: '📚' },
  ingles: { name: 'Inglés', color: '#06B6D4', icon: '🌍' },
  'mates-sociales': { name: 'Mat. Sociales', color: '#8B5CF6', icon: '📊' },
  matematicas: { name: 'Matemáticas II', color: '#7C3AED', icon: '📐' },
  quimica: { name: 'Química', color: '#F97316', icon: '🧪' },
}

const SUBJECTS = Object.keys(SUBJECT_META)

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function normalizeConfidence(raw) {
  const value = String(raw ?? '').toLowerCase()
  if (value === 'muy alta') return 1
  if (value === 'alta') return 0.82
  if (value === 'media-alta') return 0.65
  if (value === 'media') return 0.45
  return 0.2
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function buildWeakTopicMap(testHistory) {
  const weakBySubject = {}
  for (const entry of testHistory.slice(-60)) {
    if (!entry?.subject) continue
    if (!weakBySubject[entry.subject]) weakBySubject[entry.subject] = new Map()
    const target = weakBySubject[entry.subject]
    for (const raw of entry.wrongAnswers ?? []) {
      const topic = String(raw ?? '').replace(/\s+/g, ' ').trim()
      if (!topic) continue
      target.set(topic, (target.get(topic) ?? 0) + 1)
    }
  }
  return Object.fromEntries(
    Object.entries(weakBySubject).map(([slug, map]) => [
      slug,
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, count]) => ({ topic, count })),
    ])
  )
}

function countMissedRecentDays(today, examDate, studyPlanCompleted = []) {
  const completed = new Set(studyPlanCompleted)
  const lookbackStart = addDays(today, -14)
  const first = examDate ? addDays(examDate, -120) : lookbackStart
  const start = first > lookbackStart ? first : lookbackStart
  const end = addDays(today, -1)
  let cursor = start
  let missed = 0
  while (cursor <= end && cursor < examDate) {
    if (!completed.has(cursor)) missed += 1
    cursor = addDays(cursor, 1)
  }
  return missed
}

function buildSubjectPressure({ slug, progress, flashcardWrongIds, testHistory, daysLeft, weakTopicsMap }) {
  const pct = progress[slug] ?? 0
  const wrongFlashcards = flashcardWrongIds[slug]?.length ?? 0
  const recentTests = testHistory.filter((entry) => entry.subject === slug).slice(-4)
  const avgRecentScore = recentTests.length
    ? recentTests.reduce((sum, entry) => sum + entry.score, 0) / recentTests.length
    : null
  const lowProgressWeight = (100 - pct) / 100
  const wrongFlashcardsWeight = clamp(wrongFlashcards / 12, 0, 1)
  const lowScoreWeight = avgRecentScore == null ? 0.35 : clamp((7 - avgRecentScore) / 7, 0, 1)
  const examUrgencyWeight = daysLeft == null ? 0.4 : clamp(1 - daysLeft / 90, 0.25, 1)
  const weakTopicWeight = clamp((weakTopicsMap[slug]?.length ?? 0) / 5, 0, 1)
  return {
    pct,
    wrongFlashcards,
    avgRecentScore,
    weakTopics: weakTopicsMap[slug] ?? [],
    pressure:
      lowProgressWeight * 0.31 +
      wrongFlashcardsWeight * 0.24 +
      lowScoreWeight * 0.2 +
      examUrgencyWeight * 0.15 +
      weakTopicWeight * 0.1,
  }
}

function pickPredictionTopics(slug, predictionsBySubject, count = 3) {
  return (predictionsBySubject[slug] ?? [])
    .map((prediction) => ({
      topic: prediction.topic,
      confidenceWeight: normalizeConfidence(prediction.confidence),
      reason: prediction.reason || prediction.studyTips || prediction.block || '',
    }))
    .sort((a, b) => b.confidenceWeight - a.confidenceWeight)
    .slice(0, count)
}

function truncateRationale(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 110) return normalized
  return `${normalized.slice(0, 109)}…`
}

export function generateAdaptivePlanCore({
  examDate,
  progress,
  flashcardWrongIds,
  hoursPerDay,
  testHistory = [],
  studyPlanCompleted = [],
  predictionsBySubject = {},
}) {
  const today = toDateStr(new Date())
  if (!examDate || examDate <= today) return []
  const days = daysBetween(today, examDate)
  if (days <= 0 || days > 300) return []

  const minsPerDayBase = hoursPerDay * 60
  const urgencyMode = days <= 14
  const weakTopicsMap = buildWeakTopicMap(testHistory)
  const missedRecentDays = countMissedRecentDays(today, examDate, studyPlanCompleted)
  const recoveryBoostDays = Math.min(5, missedRecentDays)

  const subjectStats = SUBJECTS
    .map((slug) => ({
      slug,
      ...buildSubjectPressure({ slug, progress, flashcardWrongIds, testHistory, daysLeft: days, weakTopicsMap }),
      predictions: pickPredictionTopics(slug, predictionsBySubject),
    }))
    .sort((a, b) => b.pressure - a.pressure)

  const plan = []
  for (let dayIndex = 0; dayIndex < Math.min(days, 120); dayIndex++) {
    const date = addDays(today, dayIndex)
    const tasks = []
    const recoveryMins = dayIndex < recoveryBoostDays ? Math.min(20, 8 + missedRecentDays * 3) : 0
    const urgencyBoost = urgencyMode ? 15 : 0
    let remaining = minsPerDayBase + urgencyBoost + recoveryMins
    const rotation = subjectStats.slice(dayIndex % 2, subjectStats.length).concat(subjectStats.slice(0, dayIndex % 2))

    if (recoveryMins > 0) {
      const main = subjectStats[0]
      tasks.push({
        subject: main.slug,
        topic: 'Recuperación de días no completados',
        mins: recoveryMins,
        kind: 'recovery',
        rationale: `Has acumulado ${missedRecentDays} días pendientes recientes. Recupera lo más crítico primero.`,
      })
      remaining -= recoveryMins
    }

    for (const subject of rotation) {
      if (remaining < 20) break
      const weakTopic = subject.weakTopics[dayIndex % Math.max(1, subject.weakTopics.length)]
      const prediction = subject.predictions[dayIndex % Math.max(1, subject.predictions.length)]
      const flashcardsBlock = subject.wrongFlashcards > 0
        ? {
            subject: subject.slug,
            topic: `Repaso activo de ${subject.wrongFlashcards} flashcards falladas`,
            mins: clamp(15 + subject.wrongFlashcards * 2, 15, 30),
            kind: 'flashcards',
            rationale: 'Tus errores recientes necesitan repetición espaciada.',
          }
        : null
      const conceptBlock = {
        subject: subject.slug,
        topic: weakTopic?.topic
          ? `Tema débil detectado: ${weakTopic.topic}`
          : prediction?.topic
            ? `Tema prioritario: ${prediction.topic}`
            : 'Repaso de conceptos base',
        mins: clamp(20 + Math.round(subject.pressure * 25) + (urgencyMode ? 6 : 0), 20, 45),
        kind: 'concept',
        rationale: weakTopic?.topic
          ? `Ha fallado recientemente en tus pruebas (${weakTopic.count} incidencias).`
          : prediction?.reason
            ? truncateRationale(prediction.reason)
            : subject.pct < 50
              ? 'Materia con progreso bajo: conviene consolidar la base.'
              : 'Mantén fresca esta materia antes del examen.',
      }
      const examBlock = {
        subject: subject.slug,
        topic: subject.avgRecentScore != null && subject.avgRecentScore < 6
          ? 'Bloque de examen corto y autocorrección'
          : 'Pregunta tipo examen y autoevaluación',
        mins: clamp(15 + Math.round((1 - (subject.avgRecentScore ?? 6) / 10) * 20) + (urgencyMode ? 4 : 0), 15, 34),
        kind: 'exam',
        rationale: subject.avgRecentScore != null && subject.avgRecentScore < 6
          ? 'Tus últimos resultados aquí piden práctica de examen.'
          : 'Practica recuperación activa con formato EBAU.',
      }

      for (const block of [flashcardsBlock, conceptBlock, examBlock].filter(Boolean)) {
        if (remaining < 15) break
        const mins = Math.min(block.mins, remaining)
        tasks.push({ ...block, mins })
        remaining -= mins
        if (tasks.length >= (urgencyMode ? 5 : 4)) break
      }
      if (tasks.length >= (urgencyMode ? 5 : 4)) break
    }

    plan.push({
      date,
      tasks,
      focusSubject: tasks[0]?.subject ?? subjectStats[0]?.slug ?? null,
      urgencyMode,
      missedRecentDays,
    })
  }
  return plan
}
