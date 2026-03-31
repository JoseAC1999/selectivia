import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStudyStore from '../../store/useStudyStore.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { assessAnswerAgainstText } from '../../lib/localAssessment.js'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const SUBJECTS = [
  { slug: 'biologia',       name: 'Biología',               icon: '🧬', color: '#10B981' },
  { slug: 'historia',       name: 'Historia de España',     icon: '🏛️', color: '#F59E0B' },
  { slug: 'lengua',         name: 'Lengua y Literatura',    icon: '📚', color: '#EC4899' },
  { slug: 'ingles',         name: 'Inglés',                 icon: '🌍', color: '#06B6D4' },
  { slug: 'mates-sociales', name: 'Mates CC. Sociales',     icon: '📊', color: '#8B5CF6' },
  { slug: 'matematicas',    name: 'Matemáticas II',         icon: '📐', color: '#7C3AED' },
  { slug: 'quimica',        name: 'Química',                icon: '🧪', color: '#F97316' },
]

const DIFFICULTIES = [
  { label: 'Fácil',   value: 1 },
  { label: 'Medio',   value: 2 },
  { label: 'Difícil', value: 3 },
  { label: 'Todos',   value: 0 },
]

const QUESTIONS_PER_TEST = 10

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function SubjectCard({ subject, onClick, testCount }) {
  return (
    <motion.button
      onClick={() => onClick(subject)}
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
        fontSize: 13, color: 'var(--text-primary)', marginBottom: 6,
      }}>
        {subject.name}
      </div>
      {testCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {testCount} test{testCount !== 1 ? 's' : ''} realizados
        </div>
      )}
    </motion.button>
  )
}

/** Pill de dificultad */
function DifficultyPill({ diff, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.15s',
        background: active ? `${color}25` : 'var(--bg-elevated)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {diff.label}
    </button>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Tests() {
  const isMobile = useIsMobile()
  const [step, setStep] = useState('subjects')         // subjects | config | test | results
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [difficulty, setDifficulty] = useState(0)
  const [allCards, setAllCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Test
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState([])           // array de strings
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([])           // { card, userAnswer, selfScore: 0|1|2 }

  // Cronómetro
  const [elapsed, setElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef(null)

  const addTestResult = useStudyStore(s => s.addTestResult)
  const testHistory   = useStudyStore(s => s.testHistory)

  const accentColor = selectedSubject?.color ?? '#7C3AED'
  const currentAssessment = step === 'test' && questions[currentIdx]
    ? assessAnswerAgainstText(
        answers[currentIdx] ?? '',
        questions[currentIdx].back,
        `${questions[currentIdx].front} ${questions[currentIdx].topic}`
      )
    : null

  // ── Cronómetro ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  useEffect(() => {
    if (step !== 'test') {
      clearInterval(timerRef.current)
      setTimerActive(false)
    }
  }, [step])

  // ── Cargar datos ────────────────────────────────────────────────────────
  async function handleSelectSubject(subject) {
    setLoadError(null)
    setLoading(true)
    setSelectedSubject(subject)
    try {
      const mod = await import(`../../data/flashcards/${subject.slug}.json`)
      const BAD_FRONT = /^Criterio EBAU:|^[a-z]\) [0-9]/
      setAllCards(mod.default.flashcards.filter(c => !BAD_FRONT.test(c.front)))
      setDifficulty(0)
      setStep('config')
    } catch {
      setLoadError(`Error al cargar ${subject.name}.`)
      setSelectedSubject(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Iniciar test ────────────────────────────────────────────────────────
  function startTest() {
    const pool = difficulty === 0
      ? allCards
      : allCards.filter(c => c.difficulty === difficulty)

    if (pool.length === 0) return

    const selected = shuffle(pool).slice(0, QUESTIONS_PER_TEST)
    setQuestions(selected)
    setCurrentIdx(0)
    setAnswers(Array(selected.length).fill(''))
    setResults([])
    setRevealed(false)
    setElapsed(0)
    setTimerActive(true)
    setStep('test')
  }

  // ── Responder y revelar ─────────────────────────────────────────────────
  function handleReveal() {
    setRevealed(true)
    setTimerActive(false)
  }

  function handleSelfScore(score) {
    const newResults = [...results, {
      card: questions[currentIdx],
      userAnswer: answers[currentIdx] ?? '',
      selfScore: score,
      suggestedScore: currentAssessment?.score ?? 0,
      coverage: currentAssessment?.coverage ?? 0,
      matchedKeywords: currentAssessment?.matchedKeywords ?? [],
    }]
    setResults(newResults)

    if (currentIdx + 1 >= questions.length) {
      // Fin del test
      const totalScore = newResults.reduce((s, r) => s + (r.selfScore === 2 ? 1 : r.selfScore === 1 ? 0.5 : 0), 0)
      const score = Math.round((totalScore / questions.length) * 100) / 10  // sobre 10
      const wrongTopics = newResults.filter(r => r.selfScore === 0).map(r => r.card.topic)
      addTestResult(selectedSubject.slug, score, wrongTopics, `Test ${selectedSubject.name}`)
      setStep('results')
    } else {
      setCurrentIdx(i => i + 1)
      setRevealed(false)
      setTimerActive(true)
    }
  }

  function handleBackToSubjects() {
    setStep('subjects')
    setSelectedSubject(null)
    setAllCards([])
    setQuestions([])
    setResults([])
  }

  function handleNewTest() {
    setStep('config')
    setResults([])
  }

  // ── Tests realizados por materia ────────────────────────────────────────
  const testCounts = {}
  for (const entry of testHistory) {
    testCounts[entry.subject] = (testCounts[entry.subject] ?? 0) + 1
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // Paso 1: Selector de materia
  if (step === 'subjects') {
    return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
            fontSize: isMobile ? 22 : 26, color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Tests
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {QUESTIONS_PER_TEST} preguntas cronometradas por materia. Autoevalúate tras cada respuesta.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SUBJECTS.map(subject => (
            <SubjectCard
              key={subject.slug}
              subject={subject}
              onClick={handleSelectSubject}
              testCount={testCounts[subject.slug] ?? 0}
            />
          ))}
        </div>

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginTop: 20 }}>
            Cargando...
          </p>
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

        {/* Historial reciente */}
        {testHistory.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
            }}>
              Últimos tests
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...testHistory].reverse().slice(0, 5).map((entry, i) => {
                const subj = SUBJECTS.find(s => s.slug === entry.subject)
                const scoreColor = entry.score >= 7 ? '#10B981' : entry.score >= 5 ? '#F59E0B' : '#EF4444'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px',
                    gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{subj?.icon ?? '📝'}</span>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {entry.label || subj?.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 700, fontSize: 18, color: scoreColor,
                    }}>
                      {entry.score}/10
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Paso 2: Configuración
  if (step === 'config') {
    const pool = difficulty === 0 ? allCards : allCards.filter(c => c.difficulty === difficulty)
    return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>
        <button
          onClick={() => setStep('subjects')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 14, padding: 0, marginBottom: 28,
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: 'var(--bg-card)', border: `1px solid ${accentColor}30`,
            borderRadius: 20, padding: isMobile ? '24px 18px' : '32px 28px',
            maxWidth: 440, margin: '0 auto',
          }}
        >
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
            fontSize: 20, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center',
          }}>
            {selectedSubject?.icon} {selectedSubject?.name}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
            {QUESTIONS_PER_TEST} preguntas aleatorias
          </p>

          {/* Selector de dificultad */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
            }}>
              Dificultad
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DIFFICULTIES.map(diff => (
                <DifficultyPill
                  key={diff.value}
                  diff={diff}
                  active={difficulty === diff.value}
                  color={accentColor}
                  onClick={() => setDifficulty(diff.value)}
                />
              ))}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 16px',
            fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🃏</span>
            <span>
              Preguntas disponibles:{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pool.length}</span>
              {pool.length < QUESTIONS_PER_TEST && (
                <span style={{ color: '#F59E0B' }}>
                  {' '}(se usarán todas, menos de {QUESTIONS_PER_TEST})
                </span>
              )}
            </span>
          </div>

          <button
            onClick={startTest}
            disabled={pool.length === 0}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: pool.length === 0 ? 'default' : 'pointer',
              background: pool.length === 0 ? 'var(--border)' : accentColor,
              border: 'none', color: pool.length === 0 ? 'var(--text-muted)' : '#000',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (pool.length > 0) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Comenzar test →
          </button>
        </motion.div>
      </div>
    )
  }

  // Paso 3: Test en curso
  if (step === 'test') {
    const card = questions[currentIdx]
    const totalQ = questions.length
    const pct = Math.round((currentIdx / totalQ) * 100)
    const timerColor = elapsed > 120 ? '#EF4444' : elapsed > 60 ? '#F59E0B' : 'var(--text-secondary)'

    return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>

        {/* Barra superior */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--bg-base)', borderBottom: '1px solid var(--border)',
          padding: '10px 0 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10,
          marginBottom: 24,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {selectedSubject?.icon} {selectedSubject?.name}
          </span>
          <span style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700, fontSize: 16, color: 'var(--text-secondary)',
          }}>
            {currentIdx + 1}/{totalQ}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 15, fontWeight: 600, color: timerColor,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Barra de progreso */}
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}CC)`,
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Pregunta */}
            <div style={{
              background: 'var(--bg-card)', border: `1px solid ${accentColor}30`,
              borderRadius: 16, padding: isMobile ? '20px 18px 18px' : '24px 24px 20px',
              marginBottom: 20,
            }}>
              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: `${accentColor}15`, color: accentColor, fontWeight: 600,
                }}>
                  {card.topic}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {card.difficulty === 1 ? 'Fácil' : card.difficulty === 2 ? 'Medio' : 'Difícil'}
                </span>
              </div>
              <p style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 600, fontSize: isMobile ? 16 : 18, color: 'var(--text-primary)',
                lineHeight: 1.5, margin: 0,
              }}>
                {card.front}
              </p>
            </div>

            {/* Área de respuesta */}
            {!revealed && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  Tu respuesta (opcional)
                </label>
                <textarea
                  value={answers[currentIdx] ?? ''}
                  onChange={e => {
                    const newAnswers = [...answers]
                    newAnswers[currentIdx] = e.target.value
                    setAnswers(newAnswers)
                  }}
                  placeholder="Escribe tu respuesta aquí..."
                  style={{
                    width: '100%', minHeight: 100, resize: 'vertical',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 10,
                    padding: '12px 14px', fontFamily: '"Inter", sans-serif',
                    fontSize: 14, lineHeight: 1.7, outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = accentColor}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            )}

            {/* Respuesta correcta */}
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{ marginBottom: 20 }}
              >
                {/* Tu respuesta */}
                {answers[currentIdx]?.trim() && (
                  <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '14px 16px', marginBottom: 12,
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
                    }}>
                      Tu respuesta
                    </div>
                    <p style={{
                      fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {answers[currentIdx]}
                    </p>
                  </div>
                )}

                {/* Respuesta correcta */}
                <div style={{
                  background: 'rgba(16,185,129,0.05)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#10B981',
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
                  }}>
                    Respuesta correcta
                  </div>
                  <p style={{
                    fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0,
                  }}>
                    {card.back}
                  </p>
                </div>

                {/* Autoevaluación */}
                <div style={{ marginTop: 16 }}>
                  {currentAssessment && (
                    <div
                      style={{
                        background: `${accentColor}12`,
                        border: `1px solid ${accentColor}35`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                          Sugerencia automática: {currentAssessment.label}
                        </span>
                        <button
                          onClick={() => handleSelfScore(currentAssessment.score)}
                          style={{
                            border: `1px solid ${accentColor}`,
                            background: 'transparent',
                            color: accentColor,
                            borderRadius: 999,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Usar sugerencia
                        </button>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Cobertura estimada de conceptos: {Math.round(currentAssessment.coverage * 100)}%
                      </p>
                      {currentAssessment.matchedKeywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {currentAssessment.matchedKeywords.slice(0, 5).map((keyword) => (
                            <span
                              key={keyword}
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: 'rgba(16,185,129,0.12)',
                                border: '1px solid rgba(16,185,129,0.25)',
                                color: '#10B981',
                              }}
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center',
                  }}>
                    ¿Cómo ha sido tu respuesta?
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                    {[
                      { score: 0, label: 'No lo sabía', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
                      { score: 1, label: 'A medias',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
                      { score: 2, label: 'Perfecto',    color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
                    ].map(({ score, label, color, bg, border }) => (
                      <button
                        key={score}
                        onClick={() => handleSelfScore(score)}
                        style={{
                          flex: 1, maxWidth: isMobile ? '100%' : 140,
                          padding: '9px 0', borderRadius: 10,
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
                  </div>
                </div>
              </motion.div>
            )}

            {/* Botón de revelar */}
            {!revealed && (
              <button
                onClick={handleReveal}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: accentColor, border: 'none', color: '#000',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Ver respuesta correcta
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // Paso 4: Resultados
  if (step === 'results') {
    const perfectCount  = results.filter(r => r.selfScore === 2).length
    const partialCount  = results.filter(r => r.selfScore === 1).length
    const wrongCount    = results.filter(r => r.selfScore === 0).length
    const score = Math.round(((perfectCount + partialCount * 0.5) / results.length) * 100) / 10
    const scoreColor = score >= 7 ? '#10B981' : score >= 5 ? '#F59E0B' : '#EF4444'

    // Breakdown por tema
    const topicMap = {}
    for (const r of results) {
      const t = r.card.topic
      if (!topicMap[t]) topicMap[t] = { total: 0, correct: 0 }
      topicMap[t].total++
      topicMap[t].correct += r.selfScore === 2 ? 1 : r.selfScore === 1 ? 0.5 : 0
    }
    const topicBreakdown = Object.entries(topicMap).map(([topic, { total, correct }]) => ({
      topic, total, correct, pct: Math.round((correct / total) * 100),
    })).sort((a, b) => a.pct - b.pct)

    return (
      <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Puntuación */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 800, fontSize: isMobile ? 56 : 72, lineHeight: 1,
              color: scoreColor, marginBottom: 4,
            }}>
              {score.toFixed(1).replace('.', ',')}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>sobre 10 — {selectedSubject?.name}</div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 28 }}>
            {[
              { label: 'Perfectas', value: perfectCount,  color: '#10B981' },
              { label: 'A medias',  value: partialCount,  color: '#F59E0B' },
              { label: 'Falladas',  value: wrongCount,    color: '#EF4444' },
              { label: 'Tiempo',    value: formatTime(elapsed), color: 'var(--text-secondary)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '12px 8px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700, fontSize: 22, color,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Breakdown por tema */}
          {topicBreakdown.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px 20px', marginBottom: 24,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14,
              }}>
                Resultados por tema
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topicBreakdown.map(({ topic, total, pct: p }) => {
                  const barColor = p >= 70 ? '#10B981' : p >= 40 ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={topic}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, color: 'var(--text-primary)', marginBottom: 4,
                      }}>
                        <span>{topic}</span>
                        <span style={{ color: barColor, fontWeight: 600 }}>
                          {p}% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({total} preg.)</span>
                        </span>
                      </div>
                      <div style={{
                        height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          style={{ height: '100%', borderRadius: 2, background: barColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Repaso de respuestas */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '18px 20px', marginBottom: 24,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14,
            }}>
              Detalle de respuestas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((r, i) => {
                const sc = r.selfScore
                const dot = sc === 2 ? '#10B981' : sc === 1 ? '#F59E0B' : '#EF4444'
                const label = sc === 2 ? 'Correcto' : sc === 1 ? 'Parcial' : 'Incorrecto'
                return (
                  <div key={i} style={{
                    border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                    borderLeft: `3px solid ${dot}`,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        #{i + 1} · {r.card.topic}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: dot,
                        background: `${dot}15`, borderRadius: 6, padding: '1px 6px',
                      }}>
                        {label}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>
                      {r.card.front}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {r.card.back}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                      Sugerencia local: {r.suggestedScore === 2 ? 'Alta' : r.suggestedScore === 1 ? 'Parcial' : 'Baja'} · cobertura {Math.round((r.coverage ?? 0) * 100)}%
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
            <button
              onClick={handleNewTest}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: accentColor, border: 'none', color: '#000',
              }}
            >
              Nuevo test
            </button>
            <button
              onClick={handleBackToSubjects}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                background: 'transparent', border: '1px solid #2D2D3F', color: 'var(--text-secondary)',
              }}
            >
              Cambiar materia
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return null
}
