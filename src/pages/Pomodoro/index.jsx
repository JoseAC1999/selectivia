import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { playPomodoroComplete, playBreakComplete } from '../../lib/sounds.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import useStudyStore from '../../store/useStudyStore.js'
import useIsMobile from '../../hooks/useIsMobile.js'

// ── Constantes ──────────────────────────────────────────────────────────────
const WORK_MINS = 25
const BREAK_MINS = 5
const SESSIONS_PER_CYCLE = 4

const SUBJECT_META = {
  biologia:         { name: 'Biología',         color: '#10B981', icon: '🧬' },
  historia:         { name: 'Historia',         color: '#F59E0B', icon: '🏛️' },
  lengua:           { name: 'Lengua',           color: '#EC4899', icon: '📚' },
  ingles:           { name: 'Inglés',           color: '#06B6D4', icon: '🌍' },
  'mates-sociales': { name: 'Mat. Sociales',    color: '#8B5CF6', icon: '📊' },
  matematicas:      { name: 'Matemáticas II',   color: '#7C3AED', icon: '📐' },
  quimica:          { name: 'Química',          color: '#F97316', icon: '🧪' },
}

const WORK_MESSAGES = [
  '¡Concentración total! 💪 La EBAU no se aprueba sola.',
  '25 minutos. Sin distracciones. Tú puedes. 🎯',
  '¡Modo estudio activado! Cada minuto cuenta. ⚡',
  'El esfuerzo de hoy es el aprobado de mañana. 🌟',
]

const BREAK_MESSAGES = [
  '¡Descanso merecido! Estira un poco. ☕',
  '5 minutitos para recargar pilas. 🔋',
  '¡Buen trabajo! Ahora relájate un momento. 🌿',
  '¡Sesión completada! Tómate un respiro. 🎉',
]

// Radio del SVG del reloj
const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// ── Tooltip chart ────────────────────────────────────────────────────────────
function StatsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 14px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{d.meta?.icon} {d.meta?.name}</p>
      <p style={{ color: d.meta?.color ?? '#A78BFA', fontWeight: 600 }}>
        {payload[0].value.toFixed(1)}h esta semana
      </p>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Pomodoro() {
  const addPomodoroSession = useStudyStore(s => s.addPomodoroSession)
  const pomodoroSessions = useStudyStore(s => s.pomodoroSessions)
  const userName = useStudyStore(s => s.userName)
  const isMobile = useIsMobile()

  // Estado del timer
  const [isWork, setIsWork] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINS * 60)
  const [running, setRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(1)
  const [selectedSubject, setSelectedSubject] = useState('biologia')
  const [completedMsg, setCompletedMsg] = useState(null)

  const intervalRef = useRef(null)

  // Duración total en segundos del modo actual
  const totalSeconds = isWork ? WORK_MINS * 60 : BREAK_MINS * 60

  // Progreso para el arco SVG (0 → 1)
  const progress = 1 - secondsLeft / totalSeconds
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  // Color del arco según modo
  const arcColor = isWork ? '#7C3AED' : '#10B981'

  // Formatear mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Completar sesión
  const handleComplete = useCallback(() => {
    setRunning(false)
    clearInterval(intervalRef.current)

    if (isWork) {
      playPomodoroComplete()
      // Guardar sesión de trabajo
      addPomodoroSession(selectedSubject, WORK_MINS)
      const baseMsg = WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)]
      const msg = userName ? `¡Bien hecho, ${userName}! 💪 Sesión completada.` : baseMsg
      setCompletedMsg(msg)
      // Confetti al completar ciclo de 4 sesiones
      const newCount = sessionCount + 1
      if (newCount % SESSIONS_PER_CYCLE === 1) {
        confetti({ particleCount: 180, spread: 80, colors: ['#7C3AED', '#06B6D4', '#10B981'], origin: { y: 0.6 } })
      }
      // Pasar a descanso
      setIsWork(false)
      setSecondsLeft(BREAK_MINS * 60)
      setSessionCount(newCount)
    } else {
      playBreakComplete()
      const msg = BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)]
      setCompletedMsg(msg)
      // Pasar a trabajo
      setIsWork(true)
      setSecondsLeft(WORK_MINS * 60)
    }

    // Ocultar mensaje tras 4 segundos
    setTimeout(() => setCompletedMsg(null), 4000)
  }, [isWork, selectedSubject, addPomodoroSession])

  // Tick del timer
  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          handleComplete()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running, handleComplete])

  const handleStartPause = () => setRunning(r => !r)

  const handleReset = () => {
    setRunning(false)
    clearInterval(intervalRef.current)
    setIsWork(true)
    setSecondsLeft(WORK_MINS * 60)
    setSessionCount(1)
    setCompletedMsg(null)
  }

  // ── Estadísticas semanales ──────────────────────────────────────────────
  const weeklyStats = Object.entries(SUBJECT_META).map(([slug, meta]) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const mins = pomodoroSessions
      .filter(s => s.subject === slug && new Date(s.date) >= cutoff)
      .reduce((sum, s) => sum + (s.duration ?? 25), 0)
    return { slug, meta, hours: Math.round((mins / 60) * 10) / 10 }
  }).filter(d => d.hours > 0).sort((a, b) => b.hours - a.hours)

  const totalWeekMins = pomodoroSessions
    .filter(s => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
      return new Date(s.date) >= cutoff
    })
    .reduce((sum, s) => sum + (s.duration ?? 25), 0)
  const totalWeekHours = (totalWeekMins / 60).toFixed(1)

  // Sesión actual en el ciclo (1-4)
  const sessionInCycle = ((sessionCount - 1) % SESSIONS_PER_CYCLE) + 1

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '24px 16px 32px' : '40px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 6,
            background: 'linear-gradient(90deg, #F59E0B, #F97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            🍅 Pomodoro
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            25 min de concentración, 5 de descanso. Vincula cada sesión a tu materia.
          </p>
        </div>

        {/* ── Contenido principal ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 24, alignItems: 'start' }}>

          {/* ── Timer ── */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 20, padding: isMobile ? '24px 18px' : '36px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>

            {/* Modo badge */}
            <motion.div
              key={isWork ? 'work' : 'break'}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '5px 16px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                marginBottom: 28,
                background: isWork ? 'rgba(124,58,237,0.15)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${isWork ? 'rgba(124,58,237,0.4)' : 'rgba(16,185,129,0.4)'}`,
                color: isWork ? '#A78BFA' : '#34D399',
              }}
            >
              {isWork ? '⚡ Sesión de trabajo' : '☕ Descanso'}
            </motion.div>

            {/* Reloj circular SVG */}
            <div style={{ position: 'relative', width: isMobile ? 190 : 220, height: isMobile ? 190 : 220, marginBottom: 28 }}>
              <svg width={isMobile ? 190 : 220} height={isMobile ? 190 : 220} style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle
                  cx={isMobile ? 95 : 110} cy={isMobile ? 95 : 110} r={RADIUS}
                  fill="none" stroke="var(--border)" strokeWidth="10"
                />
                {/* Progreso */}
                <motion.circle
                  cx={isMobile ? 95 : 110} cy={isMobile ? 95 : 110} r={RADIUS}
                  fill="none" stroke={arcColor} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  style={{ filter: `drop-shadow(0 0 8px ${arcColor}80)`, transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s' }}
                />
              </svg>

              {/* Tiempo en el centro */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <motion.div
                  key={secondsLeft}
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: isMobile ? 40 : 48, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-2px', lineHeight: 1,
                  }}
                >
                  {formatTime(secondsLeft)}
                </motion.div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Sesión {sessionInCycle} de {SESSIONS_PER_CYCLE}
                </div>
              </div>
            </div>

            {/* Indicadores de sesión */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
                <motion.div
                  key={i}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: i < sessionInCycle - (isWork ? 0 : 1)
                      ? '#7C3AED'
                      : i === sessionInCycle - 1 && isWork
                        ? arcColor
                        : 'var(--border)',
                    boxShadow: i === sessionInCycle - 1 && isWork
                      ? `0 0 8px ${arcColor}` : 'none',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            {/* Selector de materia */}
            <div style={{ width: '100%', marginBottom: 24 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
                Materia vinculada
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isMobile ? 8 : 6 }}>
                {Object.entries(SUBJECT_META).map(([slug, meta]) => (
                  <button
                    key={slug}
                    onClick={() => !running && setSelectedSubject(slug)}
                    title={meta.name}
                    style={{
                      padding: '8px 4px', borderRadius: 10, fontSize: 18,
                      cursor: running ? 'not-allowed' : 'pointer',
                      background: selectedSubject === slug ? `${meta.color}20` : 'transparent',
                      border: `1px solid ${selectedSubject === slug ? meta.color : 'var(--border)'}`,
                      transition: 'all 0.15s',
                      opacity: running && selectedSubject !== slug ? 0.5 : 1,
                    }}
                  >
                    {meta.icon}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: SUBJECT_META[selectedSubject]?.color, marginTop: 6, textAlign: 'center' }}>
                {SUBJECT_META[selectedSubject]?.name}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 12, width: '100%', flexDirection: isMobile ? 'column' : 'row' }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartPause}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', border: 'none',
                  background: running
                    ? 'linear-gradient(135deg, #F59E0B, #F97316)'
                    : 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                  color: '#fff',
                  boxShadow: running
                    ? '0 4px 20px rgba(245,158,11,0.3)'
                    : '0 4px 20px rgba(124,58,237,0.3)',
                  transition: 'box-shadow 0.3s',
                }}
              >
                {running ? '⏸ Pausar' : '▶ Iniciar'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleReset}
                style={{
                  padding: '14px 18px', borderRadius: 14, fontSize: 14,
                  cursor: 'pointer',
                  background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}
              >
                ↺
              </motion.button>
            </div>
          </div>

          {/* ── Panel derecho: stats ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mensaje motivacional */}
            <AnimatePresence>
              {completedMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))',
                    border: '1px solid rgba(124,58,237,0.3)',
                    borderRadius: 14, padding: '16px',
                    fontSize: 13, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.5,
                  }}
                >
                  {completedMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resumen rápido */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '18px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontFamily: '"Space Grotesk", sans-serif' }}>
                Esta semana
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Horas', value: totalWeekHours + 'h', color: '#7C3AED' },
                  { label: 'Sesiones', value: pomodoroSessions.filter(s => {
                    const c = new Date(); c.setDate(c.getDate() - 7)
                    return new Date(s.date) >= c
                  }).length, color: '#F59E0B' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: `${stat.color}0e`, border: `1px solid ${stat.color}25`,
                    borderRadius: 10, padding: '12px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfica por materia */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '18px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontFamily: '"Space Grotesk", sans-serif' }}>
                Horas por materia
              </h3>
              {weeklyStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🍅</div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Completa sesiones para<br />ver tus estadísticas.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={weeklyStats.length * 38 + 10}>
                  <BarChart
                    data={weeklyStats}
                    layout="vertical"
                    barSize={18}
                    margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="meta.icon"
                      width={28}
                      tick={{ fontSize: 16 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<StatsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                      <LabelList
                        dataKey="hours"
                        position="right"
                        formatter={v => v.toFixed(1) + 'h'}
                        style={{ fill: '#71717A', fontSize: 10 }}
                      />
                      {weeklyStats.map((d, i) => (
                        <Cell key={i} fill={d.meta.color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tips */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px', fontSize: 11, color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              <p style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>💡 Técnica Pomodoro</p>
              <p>Trabaja 25 min sin interrupciones. Después de 4 sesiones, tómate un descanso largo (15–30 min).</p>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  )
}
