import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useStudyStore from '../../store/useStudyStore.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { SUBJECT_META, addDays, generateAdaptivePlan } from '../../lib/adaptivePlan.js'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES = ['L','M','X','J','V','S','D']

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function urgencyColor(days) {
  if (days > 60) return '#10B981'
  if (days > 30) return '#F59E0B'
  return '#EF4444'
}

// ── Componente de celda del calendario ───────────────────────────────────────
function CalendarDay({ dateStr, today, examDate, isCompleted, isPlan, planTasks, onClick }) {
  if (!dateStr) return <div />

  const isToday = dateStr === today
  const isExam = dateStr === examDate
  const isPast = dateStr < today
  const isMissed = isPast && isPlan && !isCompleted

  let bg = 'transparent'
  let border = '1px solid transparent'
  let textColor = isPast ? 'var(--border)' : 'var(--text-secondary)'

  if (isCompleted) { bg = '#10B98120'; border = '1px solid #10B98140'; textColor = '#34D399' }
  else if (isToday) { bg = '#7C3AED20'; border = '1px solid #7C3AED'; textColor = '#A78BFA' }
  else if (isMissed) { bg = '#EF444412'; textColor = '#EF4444' }
  else if (isPlan && !isPast) { bg = 'var(--border)'; textColor = 'var(--text-primary)' }
  if (isExam) { bg = '#EF444430'; border = '1px solid #EF4444'; textColor = '#FCA5A5' }

  const dayNum = parseInt(dateStr.split('-')[2])

  return (
    <motion.button
      whileHover={isPlan || isToday ? { scale: 1.08 } : {}}
      whileTap={isPlan || isToday ? { scale: 0.95 } : {}}
      onClick={() => isPlan && onClick(dateStr)}
      style={{
        background: bg, border, borderRadius: 8,
        padding: '6px 2px', cursor: isPlan ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        minHeight: 44, position: 'relative',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: textColor }}>
        {dayNum}
      </span>
      {isExam && <span style={{ fontSize: 8, color: '#FCA5A5', lineHeight: 1 }}>EXAM</span>}
      {isCompleted && <span style={{ fontSize: 8 }}>✓</span>}
      {isMissed && <span style={{ fontSize: 8 }}>✗</span>}
      {isPlan && !isPast && !isCompleted && planTasks?.length > 0 && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: SUBJECT_META[planTasks[0]?.subject]?.color ?? '#7C3AED',
          marginTop: 1,
        }} />
      )}
    </motion.button>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Calendario() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const {
    examDate, setExamDate,
    studyHoursPerDay, setStudyHoursPerDay,
    studyPlanCompleted, toggleStudyPlanDay,
    progress, flashcardWrongIds, testHistory,
  } = useStudyStore()

  const today = toDateStr(new Date())
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [expandedDay, setExpandedDay] = useState(null)

  function openTask(task) {
    if (task.kind === 'flashcards') {
      navigate('/flashcards', { state: { subject: task.subject } })
      return
    }
    if (task.kind === 'exam') {
      navigate('/examenes', { state: { subject: task.subject } })
      return
    }
    navigate('/predicciones', { state: { subject: task.subject } })
  }

  // Días restantes
  const daysLeft = examDate ? Math.max(0, daysBetween(today, examDate)) : null
  const urgColor = daysLeft !== null ? urgencyColor(daysLeft) : '#71717A'

  // Plan generado
  const plan = useMemo(() => generateAdaptivePlan({
    examDate, progress, flashcardWrongIds,
    hoursPerDay: studyHoursPerDay, testHistory, studyPlanCompleted,
  }), [examDate, progress, flashcardWrongIds, studyHoursPerDay, testHistory, studyPlanCompleted])

  const planByDate = useMemo(() => {
    const m = {}
    plan.forEach(d => { m[d.date] = d.tasks })
    return m
  }, [plan])

  // Generar celdas del mes del calendario
  const calCells = useMemo(() => {
    const { year, month } = calMonth
    const firstDay = new Date(year, month, 1)
    // Lunes = 0
    let startPad = firstDay.getDay() - 1
    if (startPad < 0) startPad = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push(dateStr)
    }
    return cells
  }, [calMonth])

  const completedCount = plan.filter(d => studyPlanCompleted.includes(d.date)).length
  const pct = plan.length > 0 ? Math.round((completedCount / plan.length) * 100) : 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '24px 16px 32px' : '40px 24px' }}>
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 6,
            background: 'linear-gradient(90deg, #10B981, #06B6D4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            📅 Calendario de estudio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Planifica tus sesiones hasta el día de la selectividad.
          </p>
        </div>

        {/* ── Configuración: fecha + horas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Fecha selectividad */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px',
          }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              ¿Cuándo es tu selectividad?
            </label>
            <input
              type="date"
              value={examDate ?? ''}
              min={today}
              onChange={e => setExamDate(e.target.value || null)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: 'var(--border)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14,
                colorScheme: 'dark',
              }}
            />
            {daysLeft !== null && (
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                style={{
                  marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6,
                }}
              >
                <span style={{ fontSize: 36, fontWeight: 800, color: urgColor, lineHeight: 1 }}>
                  {daysLeft}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>días restantes</span>
              </motion.div>
            )}
          </div>

          {/* Horas por día */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px',
          }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Horas de estudio por día: <span style={{ color: '#A78BFA', fontWeight: 700 }}>{studyHoursPerDay}h</span>
            </label>
            <input
              type="range"
              min={1} max={8} step={0.5}
              value={studyHoursPerDay}
              onChange={e => setStudyHoursPerDay(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#7C3AED' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>1h</span><span>8h</span>
            </div>

            {plan.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Progreso del plan</span>
                  <span style={{ color: '#10B981' }}>{completedCount}/{plan.length} días ({pct}%)</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 99 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                    style={{ height: '100%', background: '#10B981', borderRadius: 99 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {!examDate ? (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: isMobile ? '32px 20px' : '60px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Selecciona la fecha de tu selectividad para generar tu plan de estudio personalizado.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 20 }}>

            {/* ── Calendario visual ── */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px',
            }}>
              {/* Navegación de mes */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                  onClick={() => setCalMonth(m => {
                    const d = new Date(m.year, m.month - 1)
                    return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '4px 8px' }}
                >
                  ‹
                </button>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {MONTH_NAMES[calMonth.month]} {calMonth.year}
                </span>
                <button
                  onClick={() => setCalMonth(m => {
                    const d = new Date(m.year, m.month + 1)
                    return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '4px 8px' }}
                >
                  ›
                </button>
              </div>

              {/* Cabecera días */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
                {DAY_NAMES.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
                ))}
              </div>

              {/* Grid de días */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {calCells.map((dateStr, i) => (
                  <CalendarDay
                    key={i}
                    dateStr={dateStr}
                    today={today}
                    examDate={examDate}
                    isCompleted={dateStr ? studyPlanCompleted.includes(dateStr) : false}
                    isPlan={dateStr ? !!planByDate[dateStr] : false}
                    planTasks={dateStr ? planByDate[dateStr] : []}
                    onClick={(d) => {
                      setExpandedDay(prev => prev === d ? null : d)
                    }}
                  />
                ))}
              </div>

              {/* Leyenda */}
              <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { color: '#7C3AED', label: 'Hoy' },
                  { color: '#10B981', label: 'Completado' },
                  { color: '#EF4444', label: 'Examen / Perdido' },
                  { color: 'var(--border)', label: 'Con tareas' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Panel de tareas del día seleccionado / próximos días ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AnimatePresence mode="wait">
                {expandedDay && planByDate[expandedDay] ? (
                  <motion.div
                    key={expandedDay}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 14, padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {new Date(expandedDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      <button
                        onClick={() => toggleStudyPlanDay(expandedDay)}
                        style={{
                          fontSize: 10, padding: '4px 10px', borderRadius: 20,
                          cursor: 'pointer',
                          background: studyPlanCompleted.includes(expandedDay) ? '#10B98120' : '#7C3AED20',
                          border: `1px solid ${studyPlanCompleted.includes(expandedDay) ? '#10B981' : '#7C3AED'}`,
                          color: studyPlanCompleted.includes(expandedDay) ? '#34D399' : '#A78BFA',
                        }}
                      >
                        {studyPlanCompleted.includes(expandedDay) ? '✓ Completado' : 'Marcar como hecho'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {planByDate[expandedDay].map((task, i) => {
                        const meta = SUBJECT_META[task.subject]
                        return (
                          <button
                            key={i}
                            onClick={() => openTask(task)}
                            style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: `${meta.color}0e`, border: `1px solid ${meta.color}25`,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                          }}
                          >
                            <span style={{ fontSize: 18 }}>{meta.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{meta.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.topic}</div>
                              {task.rationale && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                                  {task.rationale}
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: 10, color: meta.color, whiteSpace: 'nowrap' }}>
                              {task.mins}min
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Próximos 5 días del plan */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '16px',
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontFamily: '"Space Grotesk", sans-serif' }}>
                  Próximos días
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.filter(d => d.date >= today).slice(0, 5).map((day, i) => {
                    const isCompleted = studyPlanCompleted.includes(day.date)
                    const isToday2 = day.date === today
                    const firstTask = day.tasks[0]
                    const meta = firstTask ? SUBJECT_META[firstTask.subject] : null
                    return (
                      <motion.div
                        key={day.date}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => {
                          setExpandedDay(prev => prev === day.date ? null : day.date)
                          // Navegar al mes correcto
                          const d = new Date(day.date)
                          setCalMonth({ year: d.getFullYear(), month: d.getMonth() })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          background: isToday2 ? '#7C3AED12' : 'var(--bg-elevated)',
                          border: `1px solid ${isToday2 ? '#7C3AED40' : 'var(--border)'}`,
                          transition: 'border-color 0.15s',
                          opacity: isCompleted ? 0.5 : 1,
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: meta ? `${meta.color}20` : 'var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                        }}>
                          {meta?.icon ?? '📚'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
                            {new Date(day.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {isToday2 && <span style={{ color: '#A78BFA', marginLeft: 6 }}>Hoy</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {firstTask?.topic ?? '—'}
                            {day.tasks.length > 1 && ` +${day.tasks.length - 1} más`}
                          </div>
                        </div>
                        {isCompleted && <span style={{ fontSize: 12, color: '#10B981' }}>✓</span>}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  )
}
