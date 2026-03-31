import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, generateAdaptivePlanCore } from '../src/lib/adaptivePlanCore.js'
import { daysBetweenDateStrings, getTodayDateString, normalizeExamDate } from '../src/lib/examDate.js'
import { buildTomorrowTasks, inferQuestionType } from '../src/lib/examFeedback.js'

function baseInput(overrides = {}) {
  const today = getTodayDateString()
  return {
    examDate: addDays(today, 20),
    progress: {
      biologia: 70,
      historia: 35,
      lengua: 60,
      ingles: 68,
      'mates-sociales': 62,
      matematicas: 58,
      quimica: 55,
    },
    flashcardWrongIds: {
      historia: ['h1', 'h2', 'h3'],
      biologia: ['b1'],
    },
    hoursPerDay: 2,
    testHistory: [],
    studyPlanCompleted: [],
    predictionsBySubject: {
      historia: [{ topic: 'Guerra Fría', confidence: 'alta', reason: 'Tema recurrente' }],
      biologia: [{ topic: 'Genética', confidence: 'media-alta', reason: 'Suele aparecer en opción A' }],
    },
    ...overrides,
  }
}

test('adaptive plan activa modo urgencia cerca del examen', () => {
  const today = getTodayDateString()
  const plan = generateAdaptivePlanCore(baseInput({ examDate: addDays(today, 7) }))
  assert.ok(plan.length > 0)
  assert.equal(plan[0].urgencyMode, true)
})

test('examDate mantiene fechas válidas y cuenta días sin desfases', () => {
  assert.equal(normalizeExamDate('2026-06-09'), '2026-06-09')
  assert.equal(normalizeExamDate('2026-02-31'), null)
  assert.equal(daysBetweenDateStrings('2026-06-09', '2026-06-10'), 1)
})

test('adaptive plan añade bloque de recuperación al detectar días saltados', () => {
  const plan = generateAdaptivePlanCore(baseInput())
  assert.ok(plan.length > 0)
  assert.equal(plan[0].tasks[0].kind, 'recovery')
})

test('adaptive plan prioriza tema débil reciente por fallos en test', () => {
  const history = [
    { subject: 'historia', score: 4.5, wrongAnswers: ['Guerra Fría', 'Guerra Fría'], date: new Date().toISOString() },
    { subject: 'historia', score: 5.2, wrongAnswers: ['Transición Española'], date: new Date().toISOString() },
  ]
  const plan = generateAdaptivePlanCore(baseInput({ testHistory: history }))
  const allTopics = plan.slice(0, 4).flatMap((day) => day.tasks.map((task) => task.topic))
  assert.ok(allTopics.some((topic) => topic.includes('Tema débil detectado')))
})

test('buildTomorrowTasks devuelve 3 tareas concretas ordenadas', () => {
  const tasks = buildTomorrowTasks({
    checklistItems: [
      { id: 1, checked: false, points: 2, description: 'Definir marco histórico', groupId: 'a' },
      { id: 2, checked: false, points: 1, description: 'Citar dos causas', groupId: 'a' },
      { id: 3, checked: true, points: 2, description: 'Conclusión', groupId: 'b' },
    ],
    selectedGroups: new Set(['a']),
    fallbackSuggestion: { missingKeywords: ['contexto', 'cronología'] },
  })
  assert.equal(tasks.length, 3)
  assert.ok(tasks[0].label.includes('Repasar criterio'))
})

test('inferQuestionType clasifica comentario, test y práctico', () => {
  assert.equal(inferQuestionType('historia', { rawQuestion: 'Haz un comentario de texto histórico' }), 'comentario')
  assert.equal(inferQuestionType('ingles', { rawQuestion: 'Test de opción múltiple' }), 'test')
  assert.equal(inferQuestionType('matematicas', { rawQuestion: 'Resuelve el ejercicio 1' }), 'practico')
})
