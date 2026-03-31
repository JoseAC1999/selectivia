import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const SUBJECTS = [
  { slug: 'biologia',       name: 'Biología',                   icon: '🧬', color: '#10B981' },
  { slug: 'historia',       name: 'Historia de España',         icon: '🏛️', color: '#F59E0B' },
  { slug: 'lengua',         name: 'Lengua y Literatura',        icon: '📚', color: '#EC4899' },
  { slug: 'ingles',         name: 'Inglés',                     icon: '🌍', color: '#06B6D4' },
  { slug: 'mates-sociales', name: 'Matemáticas CC. Sociales',   icon: '📊', color: '#8B5CF6' },
  { slug: 'matematicas',    name: 'Matemáticas II',             icon: '📐', color: '#7C3AED' },
  { slug: 'quimica',        name: 'Química',                    icon: '🧪', color: '#F97316' },
]

// Normaliza valores de confianza del JSON a claves internas
function normalizeConfidence(raw) {
  const map = {
    'muy alta':   'muy-alta',
    'alta':       'alta',
    'media-alta': 'media-alta',
    'media':      'media',
    'baja':       'baja',
  }
  return map[raw?.toLowerCase()] ?? 'media'
}

const CONFIDENCE_CONFIG = {
  'muy-alta': {
    label: 'MUY ALTA',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    borderColor: '#10B981',
  },
  'alta': {
    label: 'ALTA',
    badgeClass: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    borderColor: '#14B8A6',
  },
  'media-alta': {
    label: 'MEDIA-ALTA',
    badgeClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    borderColor: '#0EA5E9',
  },
  'media': {
    label: 'MEDIA',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    borderColor: '#F59E0B',
  },
  'baja': {
    label: 'BAJA',
    badgeClass: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
    borderColor: '#71717A',
  },
}

const FILTER_OPTIONS = [
  { key: 'todas',      label: 'Todas' },
  { key: 'muy-alta',   label: 'Muy alta' },
  { key: 'alta',       label: 'Alta' },
  { key: 'media-alta', label: 'Media-alta' },
  { key: 'media',      label: 'Media' },
  { key: 'baja',       label: 'Baja' },
]

// ─── IMPORTAR DATOS ────────────────────────────────────────────────────────────

const predictionModules = import.meta.glob('../../data/predictions/*.json', { eager: true })

function loadPredictions(slug) {
  const key = `../../data/predictions/${slug}.json`
  const mod = predictionModules[key]
  if (!mod) return []
  return (mod.default ?? mod).predictions ?? []
}

// Contar predicciones por materia (cargado una vez)
const SUBJECT_COUNTS = Object.fromEntries(
  SUBJECTS.map(s => [s.slug, loadPredictions(s.slug).length])
)

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

/** Tarjeta de materia en el selector */
function SubjectCard({ subject, isSelected, onClick }) {
  const count = SUBJECT_COUNTS[subject.slug]
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative w-full rounded-2xl p-4 text-left transition-all duration-200 border
        ${isSelected
          ? 'border-transparent shadow-lg'
          : 'hover:border-white/10'
        }
      `}
      style={isSelected ? {
        background: `linear-gradient(135deg, ${subject.color}22, ${subject.color}11)`,
        borderColor: `${subject.color}55`,
        boxShadow: `0 0 20px ${subject.color}22`,
      } : { background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {isSelected && (
        <div
          className="absolute inset-0 rounded-2xl opacity-10"
          style={{ background: `radial-gradient(circle at top left, ${subject.color}, transparent 60%)` }}
        />
      )}
      <div className="relative flex items-center gap-3">
        <span className="text-2xl">{subject.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate`} style={{ color: isSelected ? 'white' : 'var(--text-primary)' }}>
            {subject.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{count} predicciones</p>
        </div>
        {isSelected && (
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: subject.color }} />
        )}
      </div>
    </motion.button>
  )
}

/** Sección colapsable */
function Collapsible({ label, icon, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span className="flex items-center gap-2">
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: 'var(--text-muted)' }}
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Tarjeta de predicción individual */
function PredictionCard({ prediction, index, onStudyFlashcards, subjectColor }) {
  const conf = normalizeConfidence(prediction.confidence)
  const config = CONFIDENCE_CONFIG[conf] ?? CONFIDENCE_CONFIG['media']
  const accentColor = subjectColor ?? '#7C3AED'
  const accentSoft = `${accentColor}22`
  const accentMedium = `${accentColor}40`

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
      }}
    >
      {/* Cabecera */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{prediction.topic}</h3>
            {prediction.block && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{prediction.block}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: accentSoft,
                color: accentColor,
                border: `1px solid ${accentMedium}`,
              }}
            >
              ✦ Predicción IA
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide ${config.badgeClass}`}>
              {config.label}
            </span>
          </div>
        </div>

        {prediction.reason && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{prediction.reason}</p>
        )}
      </div>

      {/* Colapsables */}
      <div className="px-5 pb-5">
        {prediction.likelyQuestions?.length > 0 && (
          <Collapsible label="Ver preguntas probables" icon="💬">
            <ul className="space-y-2">
              {prediction.likelyQuestions.map((q, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>›</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        )}

        {prediction.studyTips && (
          <Collapsible label="Consejo de estudio" icon="💡">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{prediction.studyTips}</p>
          </Collapsible>
        )}

        <button
          onClick={onStudyFlashcards}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: accentSoft,
            border: `1px solid ${accentMedium}`,
            color: accentColor,
          }}
        >
          <span>🃏</span>
          <span>Estudiar flashcards</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function Predicciones2026() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialSlug = SUBJECTS.some((s) => s.slug === location.state?.subject)
    ? location.state.subject
    : SUBJECTS[0].slug
  const [selectedSlug, setSelectedSlug] = useState(initialSlug)
  const [activeFilter, setActiveFilter] = useState('todas')
  const [visibleCount, setVisibleCount] = useState(8)
  const contentRef = useRef(null)

  const selectedSubject = SUBJECTS.find(s => s.slug === selectedSlug)

  const allPredictions = useMemo(() => loadPredictions(selectedSlug), [selectedSlug])

  const countByLevel = useMemo(() => {
    const counts = {}
    allPredictions.forEach(p => {
      const k = normalizeConfidence(p.confidence)
      counts[k] = (counts[k] ?? 0) + 1
    })
    return counts
  }, [allPredictions])

  const filtered = useMemo(() => {
    if (activeFilter === 'todas') return allPredictions
    return allPredictions.filter(p => normalizeConfidence(p.confidence) === activeFilter)
  }, [allPredictions, activeFilter])
  const visiblePredictions = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  const muyAltaCount = countByLevel['muy-alta'] ?? 0

  function handleSelectSubject(slug) {
    setSelectedSlug(slug)
    setActiveFilter('todas')
    setVisibleCount(8)
    window.setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  useEffect(() => {
    if (!location.state?.subject) return
    if (!SUBJECTS.some((s) => s.slug === location.state.subject)) return
    setSelectedSlug(location.state.subject)
    setActiveFilter('todas')
    setVisibleCount(8)
  }, [location.state])

  useEffect(() => {
    setVisibleCount(8)
  }, [selectedSlug, activeFilter])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔮</span>
            <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>Predicciones EBAU 2026</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Análisis de frecuencia + orientaciones oficiales Junta de Andalucía · Generado por IA
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar: selector de materias */}
          <motion.aside
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:w-64 shrink-0"
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
              Asignatura
            </p>
            <div className="flex flex-col gap-2">
              {SUBJECTS.map(subject => (
                <SubjectCard
                  key={subject.slug}
                  subject={subject}
                  isSelected={subject.slug === selectedSlug}
                  onClick={() => handleSelectSubject(subject.slug)}
                />
              ))}
            </div>
          </motion.aside>

          {/* Contenido principal */}
          <div ref={contentRef} className="flex-1 min-w-0">

            {/* Resumen */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSlug + '-summary'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-5 flex items-center gap-4 flex-wrap"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedSubject.icon}</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selectedSubject.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{allPredictions.length}</span> predicciones
                  </span>
                  {muyAltaCount > 0 && (
                    <>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <span className="text-sm">
                        <span className="text-emerald-500 font-semibold">{muyAltaCount}</span>
                        <span style={{ color: 'var(--text-muted)' }}> con confianza muy alta</span>
                      </span>
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Barra de filtros */}
            <div className="flex flex-wrap gap-2 mb-6">
              {FILTER_OPTIONS.map(opt => {
                const count = opt.key === 'todas'
                  ? allPredictions.length
                  : (countByLevel[opt.key] ?? 0)
                if (opt.key !== 'todas' && count === 0) return null
                const isActive = activeFilter === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                    style={isActive ? {
                      background: '#7C3AED', borderColor: '#6D28D9', color: '#fff',
                    } : {
                      background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={isActive
                        ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                        : { background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Lista de predicciones */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSlug + '-' + activeFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {filtered.length === 0 ? (
                  <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-4xl mb-3">🔍</p>
                    <p>No hay predicciones para este filtro</p>
                  </div>
                ) : (
                  visiblePredictions.map((pred, i) => (
                    <PredictionCard
                      key={pred.id ?? i}
                      prediction={pred}
                      index={i}
                      subjectColor={selectedSubject?.color}
                      onStudyFlashcards={() => navigate('/flashcards', { state: { subject: selectedSlug } })}
                    />
                  ))
                )}
                {filtered.length > visiblePredictions.length && (
                  <button
                    onClick={() => setVisibleCount((value) => value + 8)}
                    className="mt-2 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Cargar más predicciones ({filtered.length - visiblePredictions.length} restantes)
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
