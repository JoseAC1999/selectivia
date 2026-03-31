import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useLocation } from 'react-router-dom'
import useStudyStore from '../../store/useStudyStore.js'
import { playSuccess, playWrong } from '../../lib/sounds.js'
import useIsMobile from '../../hooks/useIsMobile.js'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const SUBJECTS = [
  { slug: 'biologia',       name: 'Biología',                  icon: '🧬', color: '#10B981' },
  { slug: 'historia',       name: 'Historia de España',        icon: '🏛️', color: '#F59E0B' },
  { slug: 'lengua',         name: 'Lengua y Literatura',       icon: '📚', color: '#EC4899' },
  { slug: 'ingles',         name: 'Inglés',                    icon: '🌍', color: '#06B6D4' },
  { slug: 'mates-sociales', name: 'Mates CC. Sociales',        icon: '📊', color: '#8B5CF6' },
  { slug: 'matematicas',    name: 'Matemáticas II',            icon: '📐', color: '#7C3AED' },
  { slug: 'quimica',        name: 'Química',                   icon: '🧪', color: '#F97316' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Mezcla un array (Fisher-Yates) */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Construye la cola de la sesión con spaced repetition simple:
 * - Las wrongIds (no lo sabía) van al inicio con duplicados para que aparezcan antes.
 * - El resto se mezcla al final.
 */
function buildQueue(cards, wrongIds) {
  const wrongSet = new Set(wrongIds)
  const wrongCards  = shuffle(cards.filter(c => wrongSet.has(c.id)))
  const otherCards  = shuffle(cards.filter(c => !wrongSet.has(c.id)))
  // Las wrongCards aparecen primero, con un duplicado intercalado cada 5 cartas normales
  const queue = [...wrongCards]
  otherCards.forEach((c, i) => {
    queue.push(c)
    if (wrongCards[i % wrongCards.length] && i < wrongCards.length) {
      queue.push(wrongCards[i % wrongCards.length])
    }
  })
  return queue
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function SubjectGrid({ subjects, onSelect, wrongCounts, cardCounts, isMobile }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
          fontSize: isMobile ? 22 : 26, color: 'var(--text-primary)', marginBottom: 6,
        }}>
          Flashcards
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Repetición espaciada con tarjetas de las asignaturas EBAU
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {subjects.map(subject => {
          const wrong = wrongCounts[subject.slug] ?? 0
          const total = cardCounts[subject.slug] ?? 0
          return (
            <motion.button
              key={subject.slug}
              onClick={() => onSelect(subject)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'relative',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '20px 16px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = `0 8px 32px ${subject.color}30`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Barra de acento */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3, background: subject.color, borderRadius: '16px 0 0 16px',
              }} />
              {/* Icono */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, backgroundColor: `${subject.color}20`, marginBottom: 12,
              }}>
                {subject.icon}
              </div>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600,
                fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3,
              }}>
                {subject.name}
              </div>
              {total > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {total} tarjetas
                </div>
              )}
              {wrong > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#FCA5A5',
                  background: 'rgba(239,68,68,0.1)', borderRadius: 6,
                  padding: '2px 8px', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <span>⚠</span>
                  <span>{wrong} por repasar</span>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Selector de temas */
function TopicFilter({ topics, selected, onSelect, color, isMobile }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', marginBottom: 20, overflowX: isMobile ? 'auto' : 'visible', paddingBottom: 4,
    }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.15s',
          background: selected === null ? `${color}25` : 'var(--bg-elevated)',
          border: `1px solid ${selected === null ? color : 'var(--border)'}`,
          color: selected === null ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        Todos
      </button>
      {topics.map(topic => (
        <button
          key={topic}
          onClick={() => onSelect(topic)}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            background: selected === topic ? `${color}25` : 'var(--bg-elevated)',
            border: `1px solid ${selected === topic ? color : 'var(--border)'}`,
            color: selected === topic ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {topic}
        </button>
      ))}
    </div>
  )
}

/** Tarjeta con animación de flip 3D */
function FlipCard({ card, flipped, onFlip, color, isMobile }) {
  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        cursor: 'pointer',
        height: isMobile ? 320 : 280,
      }}
      onClick={onFlip}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Frente */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: 'var(--bg-card)',
          border: `1px solid ${color}40`,
          borderRadius: 20,
          padding: isMobile ? '22px 18px' : '28px 32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${color}20`,
        }}>
          {/* Topic badge */}
          <div style={{
            position: 'absolute', top: 16, left: 20,
            fontSize: 11, fontWeight: 600, color: color,
            background: `${color}15`, borderRadius: 6, padding: '2px 8px',
            border: `1px solid ${color}30`,
          }}>
            {card.topic}
          </div>
          {/* Dificultad dots */}
          <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: 4 }}>
            {[1,2,3].map(n => (
              <div key={n} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: n <= card.difficulty
                  ? card.difficulty === 3 ? '#EF4444' : card.difficulty === 2 ? '#F59E0B' : '#10B981'
                  : 'var(--border)',
              }} />
            ))}
          </div>
          <p style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: isMobile ? 16 : 18, fontWeight: 600, color: 'var(--text-primary)',
            textAlign: 'center', lineHeight: 1.5, margin: 0,
          }}>
            {card.front}
          </p>
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: 20, marginBottom: 0,
          }}>
            Toca para ver la respuesta
          </p>
        </div>

        {/* Reverso */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'var(--bg-card)',
          border: `1px solid ${color}60`,
          borderRadius: 20,
          padding: isMobile ? '22px 18px' : '28px 32px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${color}30`,
        }}>
          <div style={{
            position: 'absolute', top: 14, left: 20,
            fontSize: 11, fontWeight: 700, color: color,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Respuesta
          </div>
          <p style={{
            fontSize: isMobile ? 14 : 15, color: 'var(--text-primary)',
            textAlign: 'center', lineHeight: 1.7, margin: 0,
            maxHeight: isMobile ? 238 : 200, overflowY: 'auto',
          }}>
            {card.back}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

/** Botones de valoración */
function RatingButtons({ onRate, isMobile }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexDirection: isMobile ? 'column' : 'row' }}
    >
      {[
        { result: 0, label: 'No lo sabía', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
        { result: 1, label: 'Más o menos', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
        { result: 2, label: 'Lo sabía',    color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
      ].map(({ result, label, color, bg, border }) => (
        <button
          key={result}
          onClick={() => onRate(result)}
          style={{
            flex: 1, maxWidth: isMobile ? '100%' : 160,
            padding: '10px 0', borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: bg, border: `1px solid ${border}`, color,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {label}
        </button>
      ))}
    </motion.div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Flashcards() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [step, setStep] = useState('subjects')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [allCards, setAllCards] = useState([])
  const [topics, setTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [cardCounts, setCardCounts] = useState({})

  useEffect(() => {
    Promise.all(
      SUBJECTS.map(s =>
        import(`../../data/flashcards/${s.slug}.json`)
          .then(m => [s.slug, m.default.flashcards.length])
          .catch(() => [s.slug, 0])
      )
    ).then(entries => setCardCounts(Object.fromEntries(entries)))
  }, [])

  // Sesión
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionStudied, setSessionStudied] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [touchStartX, setTouchStartX] = useState(null)

  const flashcardHistory   = useStudyStore(s => s.flashcardHistory)
  const flashcardWrongIds  = useStudyStore(s => s.flashcardWrongIds)
  const addFlashcardResult = useStudyStore(s => s.addFlashcardResult)

  // Estadísticas derivadas
  const today = new Date().toISOString().split('T')[0]
  const studiedToday = flashcardHistory.filter(h => h.date.startsWith(today)).length
  const totalHistory = flashcardHistory.length
  const correctTotal = flashcardHistory.filter(h => h.result === 2).length
  const accuracyTotal = totalHistory > 0 ? Math.round((correctTotal / totalHistory) * 100) : 0

  // Recuentos de wrongIds por materia
  const wrongCounts = Object.fromEntries(
    Object.entries(flashcardWrongIds).map(([slug, ids]) => [slug, ids.length])
  )

  async function handleSelectSubject(subject) {
    setLoadError(null)
    setLoading(true)
    setSelectedSubject(subject)
    try {
      const mod = await import(`../../data/flashcards/${subject.slug}.json`)
      const data = mod.default
      setAllCards(data.flashcards)
      setTopics(data.topics ?? [])
      setSelectedTopic(null)
      setStep('study')
    } catch {
      setLoadError(`Error al cargar flashcards de ${subject.name}.`)
      setSelectedSubject(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step !== 'subjects') return
    const targetSlug = location.state?.subject
    if (!targetSlug) return
    const subject = SUBJECTS.find((s) => s.slug === targetSlug)
    if (!subject) return
    handleSelectSubject(subject)
  }, [location.state, step])

  // Construir/actualizar cola cuando cambia el topic o se arranca la sesión
  const startSession = useCallback(() => {
    const wrongIds = flashcardWrongIds[selectedSubject?.slug] ?? []
    const filtered = selectedTopic
      ? allCards.filter(c => c.topic === selectedTopic)
      : allCards
    const q = buildQueue(filtered, wrongIds)
    setQueue(q)
    setQueueIndex(0)
    setFlipped(false)
    setSessionStudied(0)
    setSessionCorrect(0)
    setSessionDone(false)
  }, [allCards, selectedTopic, selectedSubject, flashcardWrongIds])

  useEffect(() => {
    if (step === 'study' && allCards.length > 0) {
      startSession()
    }
  }, [step, allCards, selectedTopic])

  const currentCard = queue[queueIndex] ?? null
  const totalInSession = queue.length

  function handleFlip() {
    setFlipped(f => !f)
  }

  function handleRate(result) {
    if (!currentCard) return
    addFlashcardResult(selectedSubject.slug, currentCard.id, result)
    setSessionStudied(n => n + 1)

    if (result === 2) {
      playSuccess()
      setSessionCorrect(n => n + 1)
    } else if (result === 0) {
      playWrong()
    }

    const nextIdx = queueIndex + 1
    if (nextIdx >= queue.length) {
      // Confetti si todas correctas
      const newCorrect = (result === 2 ? sessionCorrect + 1 : sessionCorrect)
      if (newCorrect === queue.length) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })
      }
      setSessionDone(true)
    } else {
      setQueueIndex(nextIdx)
      setFlipped(false)
    }
  }

  function handleTouchStart(event) {
    if (!isMobile) return
    setTouchStartX(event.changedTouches?.[0]?.clientX ?? null)
  }

  function handleTouchEnd(event) {
    if (!isMobile || !flipped || touchStartX == null) return
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX
    const deltaX = endX - touchStartX
    if (Math.abs(deltaX) < 70) return
    if (deltaX > 0) handleRate(2)
    else handleRate(0)
    setTouchStartX(null)
  }

  function handleBack() {
    setStep('subjects')
    setSelectedSubject(null)
    setAllCards([])
    setQueue([])
    setSessionDone(false)
  }

  const accentColor = selectedSubject?.color ?? '#7C3AED'
  const pct = totalInSession > 0 ? Math.round((queueIndex / totalInSession) * 100) : 0

  // ── Paso 1: Selector de materia ──────────────────────────────────────────
  if (step === 'subjects') {
    return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>
        <AnimatePresence mode="wait">
          <SubjectGrid
            key="subjects"
            subjects={SUBJECTS}
            onSelect={handleSelectSubject}
            wrongCounts={wrongCounts}
            cardCounts={cardCounts}
            isMobile={isMobile}
          />
        </AnimatePresence>

        {/* Stats globales */}
        <div style={{
          display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Estudiadas hoy', value: studiedToday, icon: '📅' },
            { label: 'Total estudiadas', value: totalHistory, icon: '🃏' },
            { label: 'Precisión global', value: `${accuracyTotal}%`, icon: '🎯' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{
              flex: '1 1 120px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700, fontSize: 22, color: 'var(--text-primary)',
              }}>
                {value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
            Cargando tarjetas...
          </div>
        )}
        {loadError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '12px 16px', color: '#FCA5A5',
            fontSize: 14, marginTop: 16,
          }}>
            {loadError}
          </div>
        )}
      </div>
    )
  }

  // ── Paso 2: Sesión de estudio ─────────────────────────────────────────────
  return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>

      {/* Cabecera */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10,
      }}>
        <button
          onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 14, padding: 0,
            fontFamily: '"Inter", sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {selectedSubject?.icon} {selectedSubject?.name}
        </button>

        {/* Stats de sesión */}
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
          <span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sessionStudied}</span>
            {' '}estudiadas
          </span>
          <span>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{sessionCorrect}</span>
            {' '}correctas
          </span>
          {studiedToday > 0 && (
            <span>
              <span style={{ color: accentColor, fontWeight: 600 }}>{studiedToday}</span>
              {' '}hoy
            </span>
          )}
        </div>
      </div>

      {/* Filtro de temas */}
      {topics.length > 1 && !sessionDone && (
          <TopicFilter
            topics={topics}
            selected={selectedTopic}
            onSelect={(t) => { setSelectedTopic(t); }}
            color={accentColor}
            isMobile={isMobile}
          />
        )}

      {/* Barra de progreso */}
      {!sessionDone && totalInSession > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-muted)', marginBottom: 6,
          }}>
            <span>{queueIndex} / {totalInSession}</span>
            <span>{pct}%</span>
          </div>
          <div style={{
            height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}CC)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Pantalla de fin de sesión */}
      {sessionDone && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: 'var(--bg-card)', border: `1px solid ${accentColor}40`,
            borderRadius: 20, padding: '40px 32px', textAlign: 'center',
            maxWidth: 460, margin: '0 auto',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${accentColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 20px',
          }}>
            🎉
          </div>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
            fontSize: 22, color: 'var(--text-primary)', marginBottom: 8,
          }}>
            ¡Sesión completada!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {selectedSubject?.name} — {selectedTopic ?? 'Todos los temas'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
            {[
              { label: 'Estudiadas', value: sessionStudied, color: 'var(--text-primary)' },
              { label: 'Correctas', value: sessionCorrect, color: '#10B981' },
              { label: 'Precisión', value: sessionStudied > 0 ? `${Math.round((sessionCorrect/sessionStudied)*100)}%` : '-', color: accentColor },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 8px',
              }}>
                <div style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700, fontSize: 24, color,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={startSession}
              style={{
                padding: '10px 22px', borderRadius: 10, fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
                background: accentColor, border: `1px solid ${accentColor}`,
                color: '#000',
              }}
            >
              Otra vuelta
            </button>
            <button
              onClick={handleBack}
              style={{
                padding: '10px 22px', borderRadius: 10, fontSize: 14,
                fontWeight: 500, cursor: 'pointer',
                background: 'transparent', border: '1px solid #2D2D3F',
                color: 'var(--text-secondary)',
              }}
            >
              Cambiar materia
            </button>
          </div>
        </motion.div>
      )}

      {/* Tarjeta */}
      {!sessionDone && currentCard && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id + '-' + queueIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <FlipCard
              card={currentCard}
              flipped={flipped}
              onFlip={handleFlip}
              color={accentColor}
              isMobile={isMobile}
            />
            {flipped && (
              <RatingButtons onRate={handleRate} isMobile={isMobile} />
            )}
            {!flipped && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
                  marginTop: 12,
                }}
              >
                Haz clic en la tarjeta para ver la respuesta
              </motion.p>
            )}
            {flipped && isMobile && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                Desliza derecha = Lo sabía · izquierda = No lo sabía
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!sessionDone && !currentCard && queue.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '56px 0', color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          No hay tarjetas para este filtro
        </div>
      )}
    </div>
  )
}
