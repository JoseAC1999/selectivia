import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStudyStore from '../store/useStudyStore.js'

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
function NavItem({ item, progress, isMobile = false }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isMobile ? 'flex-col gap-1 px-2 py-2 text-xs' : '',
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
            style={{ color: isActive ? '#7C3AED' : 'var(--text-muted)' }}
            className="transition-colors duration-200"
          >
            {item.icon}
          </span>
          <span className={isMobile ? 'text-[10px]' : ''}>{item.label}</span>
          {!isMobile && progress != null && <ProgressDot value={progress} />}
        </>
      )}
    </NavLink>
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
  const progress = useStudyStore((s) => s.progress)
  const streak = useStudyStore((s) => s.streak)
  const soundMuted = useStudyStore((s) => s.soundMuted)
  const toggleMute = useStudyStore((s) => s.toggleMute)
  const darkMode = useStudyStore((s) => s.darkMode)
  const toggleDarkMode = useStudyStore((s) => s.toggleDarkMode)
  const [showProfileModal, setShowProfileModal] = useState(false)

  return (
    <>
    <AnimatePresence>
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </AnimatePresence>
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
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

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} progress={progress[item.subject]} />
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
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* ── Bottom nav mobile ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2 border-t z-50"
        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)' }}
      >
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} item={item} isMobile />
        ))}
      </nav>
    </div>
    </>
  )
}
