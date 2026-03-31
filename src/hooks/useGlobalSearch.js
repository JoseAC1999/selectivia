import { useEffect, useMemo, useState } from 'react'

const SUBJECT_META = {
  biologia: { name: 'Biología', icon: '🧬', color: '#10B981' },
  historia: { name: 'Historia', icon: '🏛️', color: '#F59E0B' },
  lengua: { name: 'Lengua', icon: '📚', color: '#EC4899' },
  ingles: { name: 'Inglés', icon: '🌍', color: '#06B6D4' },
  'mates-sociales': { name: 'Mat. Sociales', icon: '📊', color: '#8B5CF6' },
  matematicas: { name: 'Matemáticas II', icon: '📐', color: '#7C3AED' },
  quimica: { name: 'Química', icon: '🧪', color: '#F97316' },
}

const flashcardModules = import.meta.glob('../data/flashcards/*.json')
const predictionModules = import.meta.glob('../data/predictions/*.json')
const examModules = import.meta.glob('../data/ebau/*.json')
const orientationModules = import.meta.glob('../data/orientaciones/*.json')

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function truncate(value, max = 180) {
  const text = compactText(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function examLabel(exam) {
  const typeMap = {
    Titular: 'Titular',
    Titular2: 'Titular 2',
    Reserva: 'Reserva',
    Suplente: 'Suplente',
    Suplente1: 'Suplente 1',
    Suplente2: 'Suplente 2',
  }
  return `${typeMap[exam.examType] ?? exam.examType} ${exam.option ? `· Opción ${exam.option}` : ''}`.trim()
}

function scoreItem(item, query) {
  const q = query.toLowerCase()
  const haystack = item.searchText
  let score = 0
  if (item.title.toLowerCase().includes(q)) score += 8
  if (item.subtitle.toLowerCase().includes(q)) score += 4
  if (haystack.includes(q)) score += 2
  if (item.type === 'subject') score += 2
  return score
}

async function loadSearchIndex() {
  const [flashcards, predictions, exams, orientations] = await Promise.all([
    Promise.all(Object.entries(flashcardModules).map(async ([path, loader]) => [path, await loader()])),
    Promise.all(Object.entries(predictionModules).map(async ([path, loader]) => [path, await loader()])),
    Promise.all(Object.entries(examModules).map(async ([path, loader]) => [path, await loader()])),
    Promise.all(Object.entries(orientationModules).map(async ([path, loader]) => [path, await loader()])),
  ])

  const items = Object.entries(SUBJECT_META).map(([slug, meta]) => ({
    id: `subject-${slug}`,
    type: 'subject',
    title: meta.name,
    subtitle: 'Materia',
    body: `Ir a recursos de ${meta.name}`,
    route: '/',
    meta,
    searchText: `${meta.name.toLowerCase()} ${slug} materia`,
  }))

  flashcards.forEach(([, mod]) => {
    const data = mod.default ?? mod
    const meta = SUBJECT_META[data.subject]
    data.flashcards.forEach((card) => {
      items.push({
        id: `flashcard-${data.subject}-${card.id}`,
        type: 'flashcard',
        title: card.front,
        subtitle: `${meta?.icon ?? '🃏'} ${meta?.name ?? data.subject} · ${card.topic}`,
        body: truncate(card.back, 140),
        route: '/flashcards',
        meta,
        searchText: compactText(`${card.front} ${card.back} ${card.topic} ${meta?.name ?? ''}`).toLowerCase(),
      })
    })
  })

  predictions.forEach(([, mod]) => {
    const data = mod.default ?? mod
    const slug = data.subject ?? data.predictions?.[0]?.subject
    const meta = SUBJECT_META[slug]
    ;(data.predictions ?? []).forEach((prediction, index) => {
      items.push({
        id: `prediction-${slug}-${index}`,
        type: 'prediction',
        title: prediction.topic,
        subtitle: `${meta?.icon ?? '🔮'} ${meta?.name ?? slug} · Predicción`,
        body: truncate(prediction.reason || prediction.studyTips || prediction.block, 140),
        route: '/predicciones',
        meta,
        searchText: compactText(`${prediction.topic} ${prediction.reason} ${prediction.studyTips} ${prediction.block} ${(prediction.likelyQuestions ?? []).join(' ')}`).toLowerCase(),
      })
    })
  })

  exams.forEach(([, mod]) => {
    const data = mod.default ?? mod
    const meta = SUBJECT_META[data.subject]
    ;(data.questions ?? []).forEach((exam) => {
      items.push({
        id: `exam-${exam.id}`,
        type: 'exam',
        title: `${meta?.name ?? data.subject} · ${exam.year}`,
        subtitle: `${meta?.icon ?? '📄'} ${examLabel(exam)}`,
        body: truncate(exam.rawQuestion, 140),
        route: '/examenes',
        meta,
        searchText: compactText(`${meta?.name ?? ''} ${exam.year} ${examLabel(exam)} ${exam.rawQuestion}`).toLowerCase(),
      })
    })
  })

  orientations.forEach(([, mod]) => {
    const data = mod.default ?? mod
    const meta = SUBJECT_META[data.subject]
    items.push({
      id: `orientation-${data.subject}`,
      type: 'orientation',
      title: `${meta?.name ?? data.subject} · Orientaciones`,
      subtitle: `${meta?.icon ?? '🧭'} Guía oficial`,
      body: truncate(data.text, 160),
      route: '/predicciones',
      meta,
      searchText: compactText(`${meta?.name ?? ''} orientaciones ${data.text}`).toLowerCase(),
    })
  })

  return items
}

export default function useGlobalSearch(enabled, query) {
  const [index, setIndex] = useState([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled || ready) return
    let cancelled = false
    setLoading(true)
    loadSearchIndex()
      .then((items) => {
        if (cancelled) return
        setIndex(items)
        setReady(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, ready])

  const results = useMemo(() => {
    const q = compactText(query).toLowerCase()
    if (!q || q.length < 2) return []

    return index
      .filter((item) => item.searchText.includes(q) || item.title.toLowerCase().includes(q))
      .map((item) => ({ ...item, score: scoreItem(item, q) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
  }, [index, query])

  return { loading, ready, results }
}
