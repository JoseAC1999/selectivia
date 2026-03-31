import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStudyStore from '../store/useStudyStore.js'
import useGlobalSearch from '../hooks/useGlobalSearch.js'
import { generateAdaptivePlan } from '../lib/adaptivePlan.js'
import { getDaysUntilExam, isValidExamDate } from '../lib/examDate.js'
import { preloadRoute } from '../lib/preloadRoutes.js'

/** Definición de las secciones de navegación */
const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    path: '/examenes',
    label: 'Exámenes',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    path: '/flashcards',
    label: 'Flashcards',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    path: '/tests',
    label: 'Tests',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    path: '/predicciones',
    label: 'Predicciones',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    path: '/pomodoro',
    label: 'Pomodoro',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    path: '/calendario',
    label: 'Calendario',
    subject: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
]

const MOBILE_ITEMS = NAV_ITEMS

/** Indicador circular de progreso pequeño */
function ProgressDot({ value }) {
  if (!value) return null
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="ml-auto shrink-0">
      <circle cx="8" cy="8" r={radius} fill="none" stroke="var(--border)" strokeWidth="2" />
      <circle
        cx="8" cy="8" r={radius}
        fill="none"
        stroke="#7C3AED"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

/** Elemento de navegación individual */
function NavItem({ item, progress, isMobile = false, badgeCount = 0, hasIndicator = false }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onMouseEnter={() => preloadRoute(item.path)}
      onFocus={() => preloadRoute(item.path)}
      onTouchStart={() => preloadRoute(item.path)}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isMobile ? 'min-w-[4.5rem] flex-col gap-1 px-2 py-2 text-xs text-center' : '',
          isActive
            ? 'bg-[#7C3AED]/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]'
            : 'hover:bg-[#7C3AED]/5',
        ].join(' ')
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      })}
    >
      {({ isActive }) => (
        <>
          <span
            style={{ color: isActive ? '#7C3AED' : 'var(--text-muted)', position: 'relative' }}
            className="transition-colors duration-200"
          >
            {item.icon}
            {(hasIndicator || badgeCount > 0) && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  minWidth: badgeCount > 0 ? 14 : 8,
                  height: badgeCount > 0 ? 14 : 8,
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#EF4444',
                  color: '#fff',
                  padding: badgeCount > 0 ? '0 4px' : 0,
                }}
              >
                {badgeCount > 0 ? (badgeCount > 9 ? '9+' : badgeCount) : ''}
              </span>
            )}
          </span>
          <span className={isMobile ? 'text-[10px] leading-tight' : ''}>{item.label}</span>
          {!isMobile && progress != null && <ProgressDot value={progress} />}
        </>
      )}
    </NavLink>
  )
}

function SearchButton({ onClick, compact = false }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl"
      style={{
        minHeight: compact ? 44 : 42,
        padding: compact ? '0 12px' : '0 14px',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
      aria-label="Abrir buscador global"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      {!compact && <span style={{ fontSize: 13, fontWeight: 500 }}>Buscar</span>}
      {!compact && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⌘K</span>}
    </button>
  )
}

function SearchModal({ query, setQuery, onClose, onSelect, loading, results }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 16,
        paddingTop: 'min(10vh, 72px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 30px 90px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '0 14px',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca materias, temas, preguntas, exámenes..."
              autoFocus
              style={{
                flex: 1,
                height: 54,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 15,
              }}
            />
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              ESC
            </button>
          </div>
        </div>

        <div style={{ maxHeight: 'min(70vh, 560px)', overflowY: 'auto', padding: 12 }}>
          {loading && (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Construyendo indice de busqueda...
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div
              style={{
                padding: 28,
                borderRadius: 18,
                background: 'var(--bg-base)',
                border: '1px dashed var(--border)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Busca en toda la app</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                Materias, flashcards, predicciones, orientaciones y examenes oficiales.
              </p>
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div
              style={{
                padding: 28,
                borderRadius: 18,
                background: 'var(--bg-base)',
                border: '1px dashed var(--border)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No hay coincidencias</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                Prueba con otra materia, tema o palabra clave.
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelect(result)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    borderRadius: 18,
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: `${result.meta?.color ?? '#7C3AED'}18`,
                            color: result.meta?.color ?? '#7C3AED',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {result.meta?.icon ?? '🔎'} {result.type}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{result.subtitle}</span>
                      </div>
                      <p style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
                        {result.title}
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
                        {result.body}
                      </p>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>Abrir</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/** Modal para editar perfil */
function ProfileModal({ onClose }) {
  const userName = useStudyStore((s) => s.userName)
  const examDate = useStudyStore((s) => s.examDate)
  const updateProfile = useStudyStore((s) => s.updateProfile)
  const [name, setName] = useState(userName || '')
  const [date, setDate] = useState(examDate || '')

  function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    updateProfile(name.trim(), date || null)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '32px 28px',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24, fontFamily: '"Space Grotesk", sans-serif' }}>
          Editar perfil
        </h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Fecha de selectividad
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: date ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', colorScheme: 'dark',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: 'none', background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Guardar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/** Layout principal */
export default function Layout({ children }) {
  const navigate = useNavigate()
  const progress = useStudyStore((s) => s.progress)
  const flashcardWrongIds = useStudyStore((s) => s.flashcardWrongIds)
  const testHistory = useStudyStore((s) => s.testHistory)
  const studyHoursPerDay = useStudyStore((s) => s.studyHoursPerDay)
  const studyPlanCompleted = useStudyStore((s) => s.studyPlanCompleted)
  const streak = useStudyStore((s) => s.streak)
  const soundMuted = useStudyStore((s) => s.soundMuted)
  const toggleMute = useStudyStore((s) => s.toggleMute)
  const darkMode = useStudyStore((s) => s.darkMode)
  const toggleDarkMode = useStudyStore((s) => s.toggleDarkMode)
  const userName = useStudyStore((s) => s.userName)
  const examDate = useStudyStore((s) => s.examDate)
  const uiToast = useStudyStore((s) => s.uiToast)
  const clearToast = useStudyStore((s) => s.clearToast)
  const pomodoroTimer = useStudyStore((s) => s.pomodoroTimer)
  const syncPomodoroClock = useStudyStore((s) => s.syncPomodoroClock)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { loading: searchLoading, results: searchResults } = useGlobalSearch(showSearch, searchQuery)

  const daysLeftRaw = getDaysUntilExam(examDate)
  const daysLeft = daysLeftRaw == null ? null : Math.max(0, daysLeftRaw)

  const mobileSummary = daysLeft != null
    ? daysLeft === 0
      ? 'Hoy es tu examen'
      : `Faltan ${daysLeft} dias`
    : 'Configura tu fecha de selectividad'

  const pendingPlanCount = useMemo(() => {
    if (!isValidExamDate(examDate)) return 0
    const today = new Date().toISOString().split('T')[0]
    const plan = generateAdaptivePlan({
      examDate,
      progress,
      flashcardWrongIds,
      hoursPerDay: studyHoursPerDay,
      testHistory,
      studyPlanCompleted,
    })
    return plan
      .filter((day) => day.date >= today && !studyPlanCompleted.includes(day.date))
      .slice(0, 7)
      .length
  }, [examDate, progress, flashcardWrongIds, studyHoursPerDay, testHistory, studyPlanCompleted])

  useEffect(() => {
    if (!uiToast) return undefined
    const timeoutId = window.setTimeout(() => clearToast(), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [uiToast, clearToast])

  useEffect(() => {
    if (!pomodoroTimer.running) return undefined
    syncPomodoroClock()
    const intervalId = window.setInterval(() => syncPomodoroClock(), 1000)
    return () => window.clearInterval(intervalId)
  }, [pomodoroTimer.running, syncPomodoroClock])

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShowSearch(true)
      }
      if (event.key === 'Escape') {
        setShowSearch(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSelectSearchResult(result) {
    navigate(result.route)
    setShowSearch(false)
    setSearchQuery('')
  }

  function formatPomodoroTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const secs = (totalSeconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  return (
    <>
    <AnimatePresence>
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </AnimatePresence>
    <AnimatePresence>
      {showSearch && (
        <SearchModal
          query={searchQuery}
          setQuery={setSearchQuery}
          onClose={() => {
            setShowSearch(false)
            setSearchQuery('')
          }}
          onSelect={handleSelectSearchResult}
          loading={searchLoading}
          results={searchResults}
        />
      )}
    </AnimatePresence>
    <div className="flex overflow-hidden" style={{ backgroundColor: 'var(--bg-base)', minHeight: '100dvh' }}>
      {/* ── Sidebar desktop ───────────────────────────────────────── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-base)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
          >
            S
          </div>
          <div style={{ flex: 1 }}>
            <span
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: '"Space Grotesk", sans-serif', background: 'linear-gradient(90deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              SelectivIA
            </span>
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                display: 'block', fontSize: 11, color: 'var(--text-muted)', background: 'none',
                border: 'none', padding: 0, cursor: 'pointer', marginTop: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.target.style.color = 'var(--text-secondary)' }}
              onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)' }}
            >
              Editar perfil
            </button>
          </div>
        </div>

        <div className="px-3 pt-3">
          <SearchButton onClick={() => setShowSearch(true)} />
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              progress={progress[item.subject]}
              hasIndicator={item.path === '/pomodoro' && pomodoroTimer.running}
              badgeCount={item.path === '/calendario' ? pendingPlanCount : 0}
            />
          ))}
        </nav>

        {/* Racha footer */}
        {streak > 0 && (
          <div
            className="mx-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <span className="text-lg">🔥</span>
            <div>
              <p style={{ color: 'var(--text-primary)' }} className="font-semibold leading-none">{streak} días</p>
              <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-0.5">racha activa</p>
            </div>
          </div>
        )}

        {/* Controles: Mute + Dark mode */}
        <div className="mx-3 mb-4 mt-2 flex gap-2">
          <button
            onClick={toggleMute}
            className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: soundMuted ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title={soundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
          >
            <span style={{ fontSize: 16 }}>{soundMuted ? '🔇' : '🔊'}</span>
            <span style={{ fontSize: 12 }}>{soundMuted ? 'Off' : 'On'}</span>
          </button>
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center rounded-lg px-3 py-2"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
            }}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </motion.aside>

      {/* ── Contenido principal ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div
          className="md:hidden sticky top-0 z-40 border-b"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-base) 92%, transparent)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
              >
                S
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {userName || 'SelectivIA'}
                </p>
                <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {mobileSummary}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <SearchButton onClick={() => setShowSearch(true)} compact />
              <button
                onClick={toggleMute}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
                title={soundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
              >
                {soundMuted ? '🔇' : '🔊'}
              </button>
              <button
                onClick={toggleDarkMode}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
                title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          {pomodoroTimer.running && (
            <button
              onClick={() => navigate('/pomodoro')}
              className="mx-4 mb-3 flex w-auto items-center justify-between rounded-xl px-3 py-2 text-left"
              style={{
                background: pomodoroTimer.isWork
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.16))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(245,158,11,0.16))',
                border: `1px solid ${pomodoroTimer.isWork ? 'rgba(124,58,237,0.45)' : 'rgba(16,185,129,0.45)'}`,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              aria-label="Abrir Pomodoro en curso"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{pomodoroTimer.isWork ? '🍅' : '☕'}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {pomodoroTimer.isWork ? 'Pomodoro activo' : 'Descanso activo'}
                </span>
              </div>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 16 }}>
                {formatPomodoroTime(pomodoroTimer.secondsLeft)}
              </span>
            </button>
          )}
        </div>
        <div
          className="flex-1 overflow-y-auto md:pb-0"
          style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </main>

      {/* ── Bottom nav mobile ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center gap-1 overflow-x-auto border-t z-50"
        style={{
          backgroundColor: 'var(--bg-base)',
          borderColor: 'var(--border)',
          padding: '10px 8px calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        {MOBILE_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isMobile
            hasIndicator={item.path === '/pomodoro' && pomodoroTimer.running}
            badgeCount={item.path === '/calendario' ? pendingPlanCount : 0}
          />
        ))}
      </nav>
    </div>
    <AnimatePresence>
      {uiToast && (
        <motion.div
          key={uiToast.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="fixed left-1/2 z-[70] -translate-x-1/2"
          style={{
            bottom: 'calc(94px + env(safe-area-inset-bottom))',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '10px 16px',
            color: 'var(--text-primary)',
            fontSize: 13,
            boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
          }}
        >
          {uiToast.message}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
