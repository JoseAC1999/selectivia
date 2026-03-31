import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import useStudyStore from '../../store/useStudyStore.js'
import { playSuccess, playWrong } from '../../lib/sounds.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { SUBJECT_META as PLAN_SUBJECT_META, generateAdaptivePlan } from '../../lib/adaptivePlan.js'
import { getDaysUntilExam, getTodayDateString } from '../../lib/examDate.js'
import { preloadRoute } from '../../lib/preloadRoutes.js'

// Totales de preguntas por materia (de src/data/ebau/)
const TOTAL_QUESTIONS = {
  biologia: 12, historia: 12, lengua: 11, ingles: 15,
  matematicas: 12, 'mates-sociales': 12, quimica: 12,
}

const SUBJECT_META = {
  biologia:         { name: 'Biología',            color: '#10B981', icon: '🧬' },
  fisica:           { name: 'Física',              color: '#3B82F6', icon: '⚛️' },
  historia:         { name: 'Historia',            color: '#F59E0B', icon: '🏛️' },
  lengua:           { name: 'Lengua',              color: '#EC4899', icon: '📚' },
  ingles:           { name: 'Inglés',              color: '#06B6D4', icon: '🌍' },
  'mates-sociales': { name: 'Mat. Sociales',       color: '#8B5CF6', icon: '📊' },
  matematicas:      { name: 'Matemáticas II',      color: '#7C3AED', icon: '📐' },
  quimica:          { name: 'Química',             color: '#F97316', icon: '🧪' },
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function scoreColor(score) {
  if (score >= 7) return '#10B981'
  if (score >= 5) return '#F59E0B'
  return '#EF4444'
}

function scoreBg(score) {
  if (score >= 7) return '#10B98120'
  if (score >= 5) return '#F59E0B20'
  return '#EF444420'
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short',
  })
}

// Animación de entrada escalonada para tarjetas
const cardVariants = {
  hidden: { opacity: 1, y: 0 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
}

// Componente de card de materia
function SubjectCard({ slug, meta, pct, custom }) {
  const navigate = useNavigate()
  const total = TOTAL_QUESTIONS[slug] ?? 0
  const done = Math.round((pct / 100) * total)

  return (
    <motion.div
      custom={custom}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
      onClick={() => navigate('/examenes')}
      onMouseEnter={() => preloadRoute('/examenes')}
      onTouchStart={() => preloadRoute('/examenes')}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 18px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow de color */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${meta.color}15`, filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{meta.name}</span>
      </div>

      {/* Barra de progreso */}
      <div style={{
        height: 6, background: 'var(--border)', borderRadius: 99, marginBottom: 8, overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: custom * 0.07 + 0.3, ease: 'easeOut' }}
          style={{ height: '100%', background: meta.color, borderRadius: 99 }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{done} / {total} preguntas</span>
        <span style={{ color: meta.color, fontWeight: 600 }}>{pct}%</span>
      </div>
    </motion.div>
  )
}

// Tooltip personalizado del chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 14px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#A78BFA', fontWeight: 600 }}>{payload[0].value.toFixed(1)}h estudiadas</p>
    </div>
  )
}

// ── Componente de mini flip card para Repaso rápido ─────────────────────────
function MiniFlipCard({ card, onRate }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div style={{ perspective: 800 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'relative', transformStyle: 'preserve-3d', minHeight: 120 }}
      >
        {/* Frente */}
        <div style={{
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '16px', cursor: 'pointer',
          position: flipped ? 'absolute' : 'relative', inset: 0,
        }}
          onClick={() => setFlipped(true)}
        >
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{card.front}</p>
          {!flipped && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>Toca para ver la respuesta</p>}
        </div>
        {/* Dorso */}
        <div style={{
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'var(--bg-elevated)', border: '1px solid #10B98140', borderRadius: 12,
          padding: '16px',
          position: 'absolute', inset: 0,
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{card.back}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onRate('wrong')}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: '#EF444420', border: '1px solid #EF4444', color: '#EF4444',
              }}
            >No lo sabía</button>
            <button
              onClick={() => onRate('right')}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: '#10B98120', border: '1px solid #10B981', color: '#10B981',
              }}
            >Ya lo sé ✓</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { progress, streak, testHistory, pomodoroSessions, flashcardWrongIds, examDate, studyPlanCompleted, studyHoursPerDay, userName } = useStudyStore()
  const addFlashcardResult = useStudyStore(s => s.addFlashcardResult)
  const safeTestHistory = Array.isArray(testHistory) ? testHistory : []
  const safePomodoroSessions = Array.isArray(pomodoroSessions) ? pomodoroSessions : []
  const safeFlashcardWrongIds = flashcardWrongIds && typeof flashcardWrongIds === 'object' ? flashcardWrongIds : {}

  // ── Estado Repaso rápido ──
  const [repasoCards, setRepasoCards] = useState(null)   // null = no iniciado, [] = cargando
  const [repasoIdx, setRepasoIdx] = useState(0)
  const [repasoDismissed, setRepasoDismissed] = useState(false)
  const [repasoStreak, setRepasoStreak] = useState(false)

  // Últimos 5 tests
  const recent = useMemo(() => [...safeTestHistory].reverse().slice(0, 5), [safeTestHistory])

  // Temas más débiles: contar IDs incorrectos por materia, mostrar top 3
  const weakTopics = useMemo(() => {
    return Object.entries(safeFlashcardWrongIds)
      .map(([subject, ids]) => ({ subject, count: ids.length, meta: SUBJECT_META[subject] }))
      .filter(x => x.count > 0 && x.meta)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [safeFlashcardWrongIds])

  // Horas por día esta semana (últimos 7 días)
  const weeklyData = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      const dayStr = getTodayDateString(d)
      const mins = safePomodoroSessions
        .filter(s => s.date.startsWith(dayStr))
        .reduce((sum, s) => sum + (s.duration ?? 25), 0)
      return {
        day: DAY_LABELS[d.getDay()],
        hours: Math.round((mins / 60) * 10) / 10,
      }
    })
  }, [safePomodoroSessions])

  const totalWeekHours = weeklyData.reduce((s, d) => s + d.hours, 0).toFixed(1)

  // ── Plan de estudio: próximos 3 días ──
  const today = getTodayDateString()
  const adaptivePlan = useMemo(() => {
    return generateAdaptivePlan({
      examDate,
      progress,
      flashcardWrongIds: safeFlashcardWrongIds,
      hoursPerDay: studyHoursPerDay,
      testHistory: safeTestHistory,
      studyPlanCompleted,
    })
  }, [examDate, progress, safeFlashcardWrongIds, studyHoursPerDay, studyPlanCompleted, safeTestHistory])
  const nextPlanDays = useMemo(() => {
    return adaptivePlan.slice(0, 3).map((day, i) => ({
      date: day.date,
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' }),
      subject: day.focusSubject,
      topic: day.tasks[0]?.topic ?? 'Repaso general',
      rationale: day.tasks[0]?.rationale ?? '',
      completed: studyPlanCompleted.includes(day.date),
    }))
  }, [adaptivePlan, studyPlanCompleted])
  const missedRecentDays = adaptivePlan[0]?.missedRecentDays ?? 0
  const urgencyMode = adaptivePlan[0]?.urgencyMode ?? false
  const daysLeftRaw = getDaysUntilExam(examDate)
  const daysLeft = daysLeftRaw == null ? null : Math.max(0, daysLeftRaw)

  const weeklyTargetHours = Math.min(42, Math.max(7, Math.round(studyHoursPerDay * 7)))
  const weeklyHoursValue = Number(totalWeekHours)
  const weeklyObjectivePct = Math.min(100, Math.round((weeklyHoursValue / weeklyTargetHours) * 100))

  const questionTypeStats = useMemo(() => {
    const recentHistory = safeTestHistory.slice(-30)
    const map = new Map()
    for (const entry of recentHistory) {
      const type = entry.questionType || 'desarrollo'
      if (!map.has(type)) map.set(type, { type, count: 0, avg: 0, total: 0 })
      const current = map.get(type)
      current.count += 1
      current.total += entry.score
      current.avg = current.total / current.count
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [safeTestHistory])

  const achievements = useMemo(() => {
    const list = []
    if (streak >= 3) list.push(`Racha activa de ${streak} días`)
    if (weeklyHoursValue >= weeklyTargetHours) list.push('Objetivo semanal de horas completado')
    const recentScores = safeTestHistory.slice(-5).map((entry) => entry.score)
    if (recentScores.length >= 3 && recentScores.reduce((a, b) => a + b, 0) / recentScores.length >= 7) {
      list.push('Rendimiento alto en los últimos tests')
    }
    if (Object.values(safeFlashcardWrongIds).reduce((sum, ids) => sum + ids.length, 0) === 0 && safeTestHistory.length > 0) {
      list.push('Sin tarjetas pendientes de repaso')
    }
    return list.slice(0, 3)
  }, [streak, weeklyHoursValue, weeklyTargetHours, safeTestHistory, safeFlashcardWrongIds])

  const reminders = useMemo(() => {
    const list = []
    if (daysLeft != null) {
      if (daysLeft <= 7) list.push(`Semana clave: quedan ${daysLeft} días para el examen`)
      else if (daysLeft <= 21) list.push(`Fase de consolidación: quedan ${daysLeft} días`)
    }
    if (urgencyMode) list.push('Modo urgencia activo: prioriza simulacros y autocorrección')
    if (missedRecentDays > 0) list.push(`Tienes ${missedRecentDays} días recientes sin marcar en el plan`)
    if (weeklyHoursValue < weeklyTargetHours * 0.65) list.push('Ritmo bajo esta semana: intenta un bloque Pomodoro extra diario')
    return list.slice(0, 3)
  }, [daysLeft, urgencyMode, missedRecentDays, weeklyHoursValue, weeklyTargetHours])

  // ── Función para cargar tarjetas de repaso ──
  async function handleStartRepaso() {
    setRepasoCards([])
    const wrongEntries = Object.entries(safeFlashcardWrongIds).filter(([, ids]) => ids.length > 0)
    let cards = []
    if (wrongEntries.length > 0) {
      // Cargar desde las materias con más tarjetas incorrectas
      const sorted = wrongEntries.sort(([, a], [, b]) => b.length - a.length)
      for (const [slug, ids] of sorted.slice(0, 2)) {
        try {
          const mod = await import(`../../data/flashcards/${slug}.json`)
          const found = mod.default.flashcards.filter(c => ids.includes(c.id))
          cards.push(...found.map(c => ({ ...c, subject: slug })))
        } catch {}
      }
    }
    if (cards.length < 5) {
      // Completar con tarjetas del tema más débil
      const FLASHCARD_SUBJECTS = new Set(['biologia', 'historia', 'lengua', 'ingles', 'mates-sociales', 'matematicas', 'quimica'])
      const weakestSubject = Object.entries(progress)
        .filter(([slug]) => FLASHCARD_SUBJECTS.has(slug))
        .sort(([, a], [, b]) => a - b)[0]?.[0] ?? 'biologia'
      try {
        const mod = await import(`../../data/flashcards/${weakestSubject}.json`)
        const extra = mod.default.flashcards
          .filter(c => !cards.find(x => x.id === c.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 5 - cards.length)
          .map(c => ({ ...c, subject: weakestSubject }))
        cards.push(...extra)
      } catch {}
    }
    cards = cards.sort(() => Math.random() - 0.5).slice(0, 5)
    setRepasoCards(cards)
    setRepasoIdx(0)
    setRepasoStreak(false)
  }

  function handleRepasoRate(rating) {
    const card = repasoCards[repasoIdx]
    if (card) {
      const result = rating === 'right' ? 2 : 0
      addFlashcardResult(card.subject, card.id, result)
      if (rating === 'right') playSuccess(); else playWrong()
    }
    if (repasoIdx + 1 >= repasoCards.length) {
      setRepasoStreak(true)
    } else {
      setRepasoIdx(i => i + 1)
    }
  }

  const QUICK_ACTIONS = [
    { label: 'Flashcards', icon: '🃏', color: '#10B981', path: '/flashcards' },
    { label: 'Test rápido', icon: '⚡', color: '#F59E0B', path: '/tests' },
    { label: 'Exámenes', icon: '📋', color: '#7C3AED', path: '/examenes' },
    { label: 'Predicciones', icon: '🔮', color: '#06B6D4', path: '/predicciones' },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '24px 16px 32px' : '40px 24px' }}>
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: isMobile ? 24 : 30, fontWeight: 700, marginBottom: 6,
            background: 'linear-gradient(90deg, #A78BFA, #06B6D4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Hola, {userName || 'selectivo 2026'} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Aquí tienes tu resumen de estudio. ¡Sigue así!
          </p>
        </div>

        {/* ── Racha + Total horas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {/* Racha */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
            }}>
              🔥
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#A78BFA', lineHeight: 1 }}>
                {streak}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                días de racha
              </div>
            </div>
          </motion.div>

          {/* Horas esta semana */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
            }}>
              ⏱️
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#06B6D4', lineHeight: 1 }}>
                {totalWeekHours}h
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                esta semana
              </div>
            </div>
          </motion.div>

          {/* Exámenes completados */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            }}>
              ✅
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', lineHeight: 1 }}>
                {safeTestHistory.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                tests completados
              </div>
            </div>
          </motion.div>
        </div>

        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Objetivo semanal</p>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                {weeklyHoursValue.toFixed(1)}h / {weeklyTargetHours}h
              </p>
              <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--border)' }}>
                <div style={{ width: `${weeklyObjectivePct}%`, height: '100%', background: '#10B981' }} />
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Logros útiles</p>
              {achievements.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Aún sin hitos esta semana.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {achievements.map((item) => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>• {item}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Recordatorios suaves</p>
              {reminders.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Vas con buen ritmo, sigue así.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reminders.map((item) => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>• {item}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Acciones rápidas ── */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontFamily: '"Space Grotesk", sans-serif' }}>
            Acciones rápidas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
            {QUICK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.path}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(action.path)}
                onTouchStart={() => preloadRoute(action.path)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 14, padding: '16px 12px',
                  cursor: 'pointer', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => {
                  preloadRoute(action.path)
                  e.currentTarget.style.borderColor = `${action.color}70`
                  e.currentTarget.style.background = `${action.color}12`
                }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
              >
                <span style={{ fontSize: 24 }}>{action.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: action.color }}>
                  {action.label}
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Progreso por materia ── */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontFamily: '"Space Grotesk", sans-serif' }}>
            Progreso por materia
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {Object.entries(TOTAL_QUESTIONS).map(([slug], i) => {
              const meta = SUBJECT_META[slug]
              const pct = progress[slug] ?? 0
              return <SubjectCard key={slug} slug={slug} meta={meta} pct={pct} custom={i} />
            })}
          </div>
        </section>

        {/* ── Fila: Temas débiles + Chart semanal ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.6fr', gap: 20, marginBottom: 36 }}>

          {/* Temas débiles */}
          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 18px',
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, fontFamily: '"Space Grotesk", sans-serif' }}>
              🎯 Temas a repasar
            </h2>
            {weakTopics.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌟</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  ¡Sin temas pendientes!<br />Practica flashcards para ver tus puntos débiles.
                </p>
                <button
                  onClick={() => navigate('/flashcards')}
                  style={{
                    marginTop: 14, padding: '7px 16px', borderRadius: 8, fontSize: 11,
                    fontWeight: 600, cursor: 'pointer',
                    background: '#10B98120', border: '1px solid #10B981',
                    color: '#10B981',
                  }}
                >
                  Ir a flashcards
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weakTopics.map(({ subject, count, meta }, i) => (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.08 }}
                    onClick={() => navigate('/flashcards')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 10,
                      background: `${meta.color}0e`, border: `1px solid ${meta.color}25`,
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${meta.color}50`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = `${meta.color}25`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{meta.icon}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{meta.name}</span>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: `${meta.color}20`, color: meta.color, fontWeight: 600,
                    }}>
                      {count} tarjetas
                    </span>
                  </motion.div>
                ))}
                <button
                  onClick={() => navigate('/flashcards')}
                  style={{
                    marginTop: 4, padding: '8px', borderRadius: 8, fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#71717A'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  Ver todas las flashcards →
                </button>
              </div>
            )}
          </motion.section>

          {/* Chart horas semanales */}
          <motion.section
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 18px',
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontFamily: '"Space Grotesk", sans-serif' }}>
              📅 Horas estudiadas esta semana
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Basado en sesiones Pomodoro completadas
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={22}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                  {weeklyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.hours > 0 ? '#7C3AED' : 'var(--border)'}
                      opacity={entry.hours > 0 ? 0.9 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.section>
        </div>

        {/* ── Widget Repaso rápido ── */}
        {!repasoDismissed && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontFamily: '"Space Grotesk", sans-serif' }}>
              Repaso rápido del día 🎯
            </h2>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px',
            }}>
              <AnimatePresence mode="wait">
                {repasoCards === null ? (
                  <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                        5 tarjetas de tus temas más difíciles
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {Object.values(safeFlashcardWrongIds).reduce((s, ids) => s + ids.length, 0)} tarjetas pendientes de repaso
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
                      <button
                        onClick={handleStartRepaso}
                        style={{
                          padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', border: 'none', color: '#ffffff',
                        }}
                      >
                        ▶ Empezar repaso
                      </button>
                      <button
                        onClick={() => setRepasoDismissed(true)}
                        style={{
                          padding: '9px 14px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
                          background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                        }}
                      >
                        Volver más tarde
                      </button>
                    </div>
                  </motion.div>
                ) : repasoCards.length === 0 ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Cargando tarjetas...
                  </motion.div>
                ) : repasoStreak ? (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🔥</div>
                    <p style={{ fontSize: 14, color: '#A78BFA', fontWeight: 700, marginBottom: 4 }}>
                      ¡+1 día de racha por repasar!
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Has completado el repaso de hoy.</p>
                    <button
                      onClick={() => { setRepasoCards(null); setRepasoDismissed(true) }}
                      style={{
                        padding: '8px 20px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
                        background: '#10B98120', border: '1px solid #10B981', color: '#10B981', fontWeight: 600,
                      }}
                    >
                      ¡Genial!
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key={`card-${repasoIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Tarjeta {repasoIdx + 1} de {repasoCards.length}
                        {repasoCards[repasoIdx]?.subject && (
                          <span style={{ marginLeft: 8, color: SUBJECT_META[repasoCards[repasoIdx].subject]?.color }}>
                            {SUBJECT_META[repasoCards[repasoIdx].subject]?.icon} {SUBJECT_META[repasoCards[repasoIdx].subject]?.name}
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {repasoCards.map((_, i) => (
                          <div key={i} style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: i < repasoIdx ? '#10B981' : i === repasoIdx ? '#A78BFA' : 'var(--border)',
                          }} />
                        ))}
                      </div>
                    </div>
                    <MiniFlipCard card={repasoCards[repasoIdx]} onRate={handleRepasoRate} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Widget Calendario de estudio ── */}
        {nextPlanDays.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: '"Space Grotesk", sans-serif' }}>
                📅 Plan de estudio{userName ? ` para ${userName}` : ''}
              </h2>
              <button
                onClick={() => navigate('/calendario')}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Ver plan completo →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {nextPlanDays.map((day, i) => {
                const meta = SUBJECT_META[day.subject]
                const adaptiveMeta = meta ?? PLAN_SUBJECT_META[day.subject]
                return (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => navigate('/calendario')}
                    style={{
                      background: day.completed ? '#10B98110' : 'var(--bg-card)',
                      border: `1px solid ${day.completed ? '#10B98140' : 'var(--border)'}`,
                      borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {day.label}
                      {day.completed && <span style={{ color: '#10B981', marginLeft: 6 }}>✓</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{adaptiveMeta?.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{adaptiveMeta?.name}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{day.topic}</p>
                    {day.rationale && (
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                        {day.rationale}
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Space Grotesk", sans-serif' }}>
            Historial por tipo de pregunta
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {questionTypeStats.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                Aún no hay datos por tipo. Se irá llenando al completar tests y exámenes.
              </div>
            ) : (
              questionTypeStats.map((item) => (
                <div
                  key={item.type}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.type}</p>
                  <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{item.avg.toFixed(1)}</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{item.count} intentos recientes</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Historial de exámenes ── */}
        <section>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: '"Space Grotesk", sans-serif' }}>
              Últimos resultados
            </h2>
            {recent.length > 0 && (
              <button
                onClick={() => navigate('/examenes')}
                style={{
                  fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                Ver todos →
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '40px 24px', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Aún no has completado ningún examen.
              </p>
              <button
                onClick={() => navigate('/examenes')}
                style={{
                  padding: '9px 20px', borderRadius: 10, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer',
                  background: '#7C3AED20', border: '1px solid #7C3AED', color: '#A78BFA',
                }}
              >
                Hacer un examen
              </button>
            </motion.div>
          ) : (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              {recent.map((entry, i) => {
                const meta = SUBJECT_META[entry.subject] ?? { name: entry.subject, color: 'var(--text-muted)', icon: '📄' }
                const col = scoreColor(entry.score)
                const bg = scoreBg(entry.score)
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate('/examenes')}
                    style={{
                      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 12,
                      padding: '13px 18px',
                      borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer', transition: 'background 0.15s',
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, padding: '3px 9px', borderRadius: 6,
                      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
                      color: meta.color, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {meta.icon} {meta.name}
                    </span>
                    <span style={{
                      flex: isMobile ? '1 1 100%' : 1, fontSize: 12, color: 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap',
                      order: isMobile ? 3 : 0,
                    }}>
                      {entry.label || 'Examen oficial'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatDate(entry.date)}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      background: bg, border: `1px solid ${col}40`,
                      color: col, fontWeight: 600, flexShrink: 0, minWidth: 44,
                      justifyContent: 'center',
                    }}>
                      {entry.score.toFixed(1)}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

      </motion.div>
    </div>
  )
}
