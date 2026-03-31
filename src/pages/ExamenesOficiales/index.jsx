import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import confetti from 'canvas-confetti'
import useStudyStore from '../../store/useStudyStore.js'
import PDF_PATHS from '../../data/pdf-paths.json'
import { playConfetti } from '../../lib/sounds.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { assessAnswerAgainstText, assessChecklistCoverage } from '../../lib/localAssessment.js'
import { buildTomorrowTasks, inferQuestionType } from '../../lib/examFeedback.js'
import biologiaData from '../../data/ebau/biologia.json'
import historiaData from '../../data/ebau/historia.json'
import inglesData from '../../data/ebau/ingles.json'
import lenguaData from '../../data/ebau/lengua.json'
import matematicasData from '../../data/ebau/matematicas.json'
import matesSocialesData from '../../data/ebau/mates-sociales.json'
import quimicaData from '../../data/ebau/quimica.json'

const EBAU_DATA = {
  biologia: biologiaData,
  historia: historiaData,
  ingles: inglesData,
  lengua: lenguaData,
  matematicas: matematicasData,
  'mates-sociales': matesSocialesData,
  quimica: quimicaData,
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const SUBJECTS = [
  { slug: 'biologia',      name: 'Biología',                    icon: '🧬', color: '#10B981', count: 12 },
  { slug: 'historia',      name: 'Historia de España',          icon: '🏛️', color: '#F59E0B', count: 12 },
  { slug: 'lengua',        name: 'Lengua y Literatura',         icon: '📚', color: '#EC4899', count: 11 },
  { slug: 'ingles',        name: 'Inglés',                      icon: '🌍', color: '#06B6D4', count: 15 },
  { slug: 'mates-sociales',name: 'Matemáticas CC. Sociales',    icon: '📊', color: '#8B5CF6', count: 12 },
  { slug: 'matematicas',   name: 'Matemáticas II',              icon: '📐', color: '#7C3AED', count: 12 },
  { slug: 'quimica',       name: 'Química',                     icon: '🧪', color: '#F97316', count: 12 },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatExamLabel(exam) {
  const typeMap = {
    Titular: 'Titular', Titular2: 'Titular 2',
    Reserva: 'Reserva',
    Suplente: 'Suplente', Suplente1: 'Suplente 1', Suplente2: 'Suplente 2',
  }
  return `${typeMap[exam.examType] ?? exam.examType} — Opción ${exam.option}`
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Formatea un número de puntos con coma decimal, sin ceros finales */
function fmtPts(n) {
  const rounded = Math.round(n * 100) / 100
  return rounded.toString().replace('.', ',')
}

/**
 * Extrae ítems calificables del rawAnswer — multi-estrategia para todos los formatos EBAU.
 * Estrategia 1: Líderes de punto (biología)         "desc ........ 0,5 puntos"
 * Estrategia 2: Paréntesis (historia, lengua)       "(Hasta 2 puntos)" / "(hasta 1.5 puntos)"
 * Estrategia 3: EJERCICIO N: X pts (mates-sociales) "EJERCICIO 1: 2.5 puntos."
 * Estrategia 4: Viñetas bullet (química)            "· Seis fórmulas: 1,50 puntos"
 * Estrategia 5: Puntuación máxima por bloque (inglés)
 */
// Regex para detectar cabeceras de sección: "A.1.", "B.2.", "BLOQUE A", "EJERCICIO 1"
const SECTION_HEADER_RE = /([A-Z]\.\d+\.|BLOQUE\s+[A-Z\d]+|EJERCICIO\s+\d+)/i

function parseCriterios(rawAnswer) {
  if (!rawAnswer) return []

  // Quitar encabezado de hoja repetido (boilerplate)
  const base = rawAnswer
    .replace(/PRUEBA DE EVALUACIÓN[\s\S]*?CRITERIOS (?:ESPECÍFICOS DE )?CORRECCIÓN\s*/gi, '')
    .trim()

  // Preprocesar: unir líneas de continuación para facilitar regex multilinea
  let text = base
    .replace(/\n[ \t]{6,}/g, ' ')                            // unir líneas muy indentadas
    .replace(/([a-záéíóúü,])\n(?=[a-záéíóúüa-z])/g, '$1 ')  // unir soft-wraps mid-sentence
  // Unir saltos dentro de grupos de paréntesis (puede requerir varias pasadas)
  for (let i = 0; i < 3; i++) {
    text = text.replace(/\(([^)\n]*)\n([^)]*)\)/g, '($1 $2)')
  }

  // ── Estrategia 1: Líderes de punto — biología ─────────────────────────
  const dotText = text.replace(/\.{4,}[.\s]*/g, '§').replace(/[ \t]{2,}/g, ' ')
  const dotParts = dotText.split('§')
  if (dotParts.length >= 3) {
    const items = []
    let id = 0, gc = 0, gid = null, glabel = ''
    for (let i = 0; i < dotParts.length - 1; i++) {
      const after = dotParts[i + 1]
      const sm = after.match(/^\s*(\d+[,\s]*\d*)\s*punt\s*[oa]\s*s?/i)
      if (!sm) continue
      const pStr = sm[1].replace(/\s/g, '')
      const pts = parseFloat(pStr.replace(',', '.'))
      if (isNaN(pts) || pts <= 0 || pts > 10) continue
      let raw = dotParts[i]
        .replace(/^\s*\d+[,\s]*\d*\s*punt\s*[oa]\s*s?\s*/i, '')
        .trim()
      const hm = raw.match(SECTION_HEADER_RE)
      if (hm) {
        const hkey = hm[1].replace(/\s+/g, ' ').trim().toUpperCase()
        if (hkey !== glabel) { glabel = hkey; gid = `g${gc++}` }
      }
      let desc = raw
        .replace(/[A-Z]\.\d+\.\s*Total\s*[\d,. ]+punt\s*[oa]\s*s?\s*/gi, '')
        .replace(/[A-Z]\.\d+\./g, '')
        .replace(/(?:BLOQUE\s+[A-Z\d]+|EJERCICIO\s+\d+)\s*/gi, '')
        .trim().replace(/\s+/g, ' ')
      if (desc.length >= 5) items.push({ id: id++, description: desc, points: pts, pointsRaw: pStr, groupId: gid, groupLabel: glabel })
    }
    if (items.length >= 2) return items
  }

  // ── Estrategia 2: "(Hasta/hasta X puntos)" — historia, lengua ─────────
  {
    const items = []
    let id = 0, gc = 0, gid = null, glabel = ''

    // Posición de cabeceras de sección para asignar grupos
    const sections = [...text.matchAll(/(\d+)\.-?\s+([A-ZÁÉÍÓÚ][^(\n]{3,}?)\s*\(De\s+[\d,.]+ a\s+[\d,.]+\s*puntos?\)/gi)]
      .map(m => ({ index: m.index, label: `${m[1]}. ${m[2].trim()}` }))
    function getSectionAt(idx) {
      let found = ''
      for (const s of sections) { if (s.index <= idx) found = s.label; else break }
      return found
    }

    // Historia: "-   a) texto (Hasta 2 puntos)."
    const hRe = /-\s+([a-z]\))\s+([\s\S]+?)\s*\((H|h)asta\s+([\d,.]+)\s*puntos?\)\.?/g
    let m
    while ((m = hRe.exec(text)) !== null) {
      const pts = parseFloat(m[4].replace(',', '.'))
      if (isNaN(pts) || pts <= 0 || pts > 10) continue
      const desc = m[2].replace(/\s+/g, ' ').trim()
      if (desc.length < 5) continue
      const sec = getSectionAt(m.index)
      if (sec !== glabel) { glabel = sec; gid = `g${gc++}` }
      items.push({ id: id++, description: `${m[1]} ${desc}`, points: pts, pointsRaw: m[4], groupId: gid, groupLabel: glabel })
    }

    // Lengua: "1. texto (hasta X puntos)"
    const lRe = /^(\d+)\.\s+([^\n]+)\s*\((H|h)asta\s+([\d,.]+)\s*puntos?\)/gm
    while ((m = lRe.exec(text)) !== null) {
      const pts = parseFloat(m[4].replace(',', '.'))
      if (isNaN(pts) || pts <= 0 || pts > 10) continue
      const desc = m[2].replace(/\s+/g, ' ').trim()
      if (desc.length < 5) continue
      items.push({ id: id++, description: `${m[1]}. ${desc}`, points: pts, pointsRaw: m[4], groupId: gid, groupLabel: glabel })
    }

    if (items.length >= 2) return items
  }

  // ── Estrategia 3: "EJERCICIO N: X puntos" + sub-ítems — mates-sociales ─
  {
    const items = []
    let id = 0, gc = 0
    const exRe = /EJERCICIO\s+(\d+):\s*([\d,.]+)\s*puntos?\.([\s\S]*?)(?=EJERCICIO\s+\d+:|BLOQUE\s+[A-Z]|$)/gi
    let m
    while ((m = exRe.exec(text)) !== null) {
      const exLabel = `EJERCICIO ${m[1]}`
      const gid = `g${gc++}`
      const body = m[3]
      const subRe = /^\s+([a-z])\)\s+(?:[Hh]asta\s+)?([\d,.]+)\s*puntos?\.?/gm
      let sub, hasSub = false
      while ((sub = subRe.exec(body)) !== null) {
        const pts = parseFloat(sub[2].replace(',', '.'))
        if (!isNaN(pts) && pts > 0) {
          hasSub = true
          items.push({ id: id++, description: `${exLabel} — apt. ${sub[1]})`, points: pts, pointsRaw: sub[2], groupId: gid, groupLabel: exLabel })
        }
      }
      if (!hasSub) {
        const pts = parseFloat(m[2].replace(',', '.'))
        if (!isNaN(pts) && pts > 0) items.push({ id: id++, description: exLabel, points: pts, pointsRaw: m[2], groupId: gid, groupLabel: exLabel })
      }
    }
    if (items.length >= 2) return items
  }

  // ── Estrategia 4: Viñetas "· desc: X puntos" — química ───────────────
  {
    const items = []
    let id = 0
    const re = /·\s+([^:\n]+):\s*([\d,.]+)\s*puntos?/gi
    let m
    while ((m = re.exec(text)) !== null) {
      const pts = parseFloat(m[2].replace(',', '.'))
      const desc = m[1].trim()
      if (!isNaN(pts) && pts > 0 && pts <= 10 && desc.length >= 3)
        items.push({ id: id++, description: desc, points: pts, pointsRaw: m[2], groupId: null, groupLabel: '' })
    }
    if (items.length >= 2) return items
  }

  // ── Estrategia 5: "Puntuación máxima: X puntos" por bloque — inglés ──
  {
    const items = []
    let id = 0
    const parts = text.split(/(BLOQUE\s+[A-C][^\n]*)/g)
    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i]?.trim()
      const body = parts[i + 1] || ''
      const mm = body.match(/Puntuaci[oó]n m[aá]xima:\s*([\d,.]+)\s*puntos?/i)
      if (mm) {
        const pts = parseFloat(mm[1].replace(',', '.'))
        if (!isNaN(pts) && pts > 0)
          items.push({ id: id++, description: header, points: pts, pointsRaw: mm[1], groupId: `g${i}`, groupLabel: header })
      }
    }
    if (items.length >= 1) return items
  }

  return []
}

// ─── ESTRUCTURA EBAU POR MATERIA ──────────────────────────────────────────────
// Define las reglas de elección de ejercicios por bloque para cada asignatura.
// matchGroup(groupLabel) → true si el grupo pertenece a este bloque.
const SUBJECT_EXAM_RULES = {
  biologia: {
    bloques: [
      { id: 'A', label: 'Bloque A', maxChoices: 3, maxPts: 6,
        matchGroup: gl => /^A\.\d/.test(gl.trim()) },
      { id: 'B', label: 'Bloque B', maxChoices: 2, maxPts: 2,
        matchGroup: gl => /^B\.\d/.test(gl.trim()) },
      { id: 'C', label: 'Bloque C', maxChoices: 1, maxPts: 2,
        matchGroup: gl => /^C\.\d/.test(gl.trim()) },
    ],
  },
  'mates-sociales': {
    bloques: [
      { id: 'A', label: 'Bloque A', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [12]$/.test(gl.trim()) },
      { id: 'B', label: 'Bloque B', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [34]$/.test(gl.trim()) },
      { id: 'C', label: 'Bloque C', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [56]$/.test(gl.trim()) },
      { id: 'D', label: 'Bloque D', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [78]$/.test(gl.trim()) },
    ],
  },
  matematicas: {
    bloques: [
      { id: 'A', label: 'Bloque A', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [12]$/.test(gl.trim()) },
      { id: 'B', label: 'Bloque B', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [34]$/.test(gl.trim()) },
      { id: 'C', label: 'Bloque C', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [56]$/.test(gl.trim()) },
      { id: 'D', label: 'Bloque D', maxChoices: 1, maxPts: 2.5,
        matchGroup: gl => /^EJERCICIO [78]$/.test(gl.trim()) },
    ],
  },
}

/**
 * Organiza los grupos del checklist en bloques EBAU según las reglas de la materia.
 * Devuelve null si no hay reglas o si el mapeo no produce estructura útil (< 2 bloques).
 */
function buildEbauStructure(groupedItems, subjectSlug) {
  const rules = SUBJECT_EXAM_RULES[subjectSlug]
  if (!rules || !groupedItems.length) return null

  const bloques = rules.bloques.map(rule => ({ ...rule, questions: [] }))

  for (const group of groupedItems) {
    for (const bloque of bloques) {
      if (bloque.matchGroup(group.label || '')) {
        bloque.questions.push(group)
        break
      }
    }
  }

  const populated = bloques.filter(b => b.questions.length > 0)
  if (populated.length < 2) return null
  return { bloques: populated }
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function SubjectCard({ subject, onClick, disabled, completedCount = 0 }) {
  const [hovered, setHovered] = useState(false)
  const pct = Math.min(100, Math.round((completedCount / subject.count) * 100))
  return (
    <motion.button
      onClick={() => !disabled && onClick(subject)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered && !disabled ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 16,
        padding: '20px 16px 18px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        textAlign: 'left',
        width: '100%',
        boxShadow: hovered && !disabled ? `0 8px 32px ${subject.color}30` : 'none',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Barra de acento izquierda */}
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

      {/* Nombre */}
      <div style={{
        fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600,
        fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3,
      }}>
        {subject.name}
      </div>

      {/* Contador + completados */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {subject.count} exámenes
        </div>
        <div style={{ fontSize: 11, color: completedCount > 0 ? '#10B981' : 'var(--text-muted)', fontWeight: 500 }}>
          {completedCount}/{subject.count} ✓
        </div>
      </div>

      {/* Mini progress bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: subject.color,
          width: `${pct}%`,
          transition: 'width 0.4s ease',
          opacity: pct > 0 ? 1 : 0,
        }} />
      </div>
    </motion.button>
  )
}

function ExamCard({ exam, color, onRevision, onExam, completed = false }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${completed ? '#10B98140' : hovered ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 12, padding: '16px',
        boxShadow: hovered ? `0 4px 20px ${color}20` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative',
      }}
    >
      {/* Tick de completado */}
      {completed && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 20, height: 20, borderRadius: '50%',
          background: '#10B98120', border: '1px solid #10B981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#10B981',
        }}>
          ✓
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        {/* Etiqueta del examen */}
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600,
          fontSize: 15, color: completed ? '#6EE7B7' : 'var(--text-primary)', marginBottom: 8,
          paddingRight: completed ? 28 : 0,
        }}>
          {formatExamLabel(exam)}
        </div>

        {/* Badges: año + criterios */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            background: `${color}20`, color: color, fontWeight: 500,
          }}>
            {exam.year}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: exam.hasCriterios ? '#10B981' : 'var(--text-muted)',
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ color: exam.hasCriterios ? '#6EE7B7' : 'var(--text-muted)' }}>
              {exam.hasCriterios ? 'Criterios disponibles' : 'Sin criterios'}
            </span>
          </span>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRevision}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            fontWeight: 500, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${color}`,
            color: color,
          }}
          onMouseEnter={e => e.currentTarget.style.background = `${color}15`}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Modo revisión
        </button>
        <button
          onClick={onExam}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
            fontWeight: 500, cursor: 'pointer',
            background: color, border: `1px solid ${color}`, color: '#000',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Modo examen
        </button>
      </div>
    </motion.div>
  )
}

function YearPill({ year, active, color, onClick }) {
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
      {year}
    </button>
  )
}

function BackButton({ onClick, label }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 14, padding: 0,
        fontFamily: '"Inter", sans-serif',
        transition: 'color 0.15s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}

// ─── VARIANTES DE ANIMACIÓN ───────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}
const stepAnim = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.25, ease: 'easeOut' },
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function ExamenesOficiales() {
  const location = useLocation()
  const isMobile = useIsMobile()
  // Navegación por pasos
  const [step, setStep] = useState('subjects')

  // Datos de la materia seleccionada
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [subjectData, setSubjectData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Selección de año y examen
  const [selectedYear, setSelectedYear] = useState(2024)
  const [examIndex, setExamIndex] = useState(0)
  const [visibleExams, setVisibleExams] = useState(8)

  // Modo revisión
  const [showAnswer, setShowAnswer] = useState(false)

  // Modo examen
  const [userAnswer, setUserAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(5400)   // 90 min en segundos
  const [timerActive, setTimerActive] = useState(false)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [examScore, setExamScore] = useState('')
  const [confirmAbort, setConfirmAbort] = useState(false)
  const [checklistItems, setChecklistItems] = useState([])
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  // selectedGroups: qué preguntas (groupId) ha elegido el alumno en modo EBAU estructurado
  const [selectedGroups, setSelectedGroups] = useState(new Set())

  const [showScrollTop, setShowScrollTop] = useState(false)

  const timerRef = useRef(null)
  const addTestResult = useStudyStore(s => s.addTestResult)
  const markExamCompleted = useStudyStore(s => s.markExamCompleted)
  const completedExams = useStudyStore(s => s.completedExams)

  // ── Valores derivados ───────────────────────────────────────────────────────
  const filteredExams = subjectData
    ? subjectData.questions.filter(q => q.year === selectedYear)
    : []
  const availableYears = subjectData
    ? [...new Set(subjectData.questions.map(q => q.year))].sort()
    : []
  const safeIndex = Math.min(examIndex, Math.max(0, filteredExams.length - 1))
  const activeExam = filteredExams[safeIndex] ?? null
  const timerColor = timeLeft <= 60 ? '#EF4444' : timeLeft <= 300 ? '#F59E0B' : 'var(--text-primary)'
  const useChecklist = checklistItems.length > 0

  // Agrupa los ítems del checklist por sección detectada en el PDF
  const groupedChecklistItems = (() => {
    const groups = []
    const seen = new Map()
    for (const item of checklistItems) {
      const gid = item.groupId ?? '__none__'
      if (!seen.has(gid)) {
        const g = { id: gid, label: item.groupLabel || '', totalPoints: 0, items: [] }
        seen.set(gid, g)
        groups.push(g)
      }
      const g = seen.get(gid)
      g.items.push(item)
      g.totalPoints += item.points
    }
    return groups
  })()

  // Estructura EBAU estructurada (biología, mates…) o null si no aplica
  const ebauStructure = useChecklist
    ? buildEbauStructure(groupedChecklistItems, selectedSubject?.slug)
    : null

  // Si hay estructura EBAU, solo puntúan los grupos que el alumno ha seleccionado.
  // En modo flat (sin estructura), todos los ítems marcados suman.
  const rawLiveScore = ebauStructure
    ? checklistItems.filter(i => selectedGroups.has(i.groupId) && i.checked).reduce((s, i) => s + i.points, 0)
    : checklistItems.reduce((s, i) => i.checked ? s + i.points : s, 0)

  // Puntos máximos brutos disponibles según criterios seleccionados.
  const rawMaxPossibleScore = ebauStructure
    ? checklistItems.filter(i => selectedGroups.has(i.groupId)).reduce((s, i) => s + i.points, 0)
    : checklistItems.reduce((s, i) => s + i.points, 0)

  // Nota normalizada siempre sobre 10.
  const liveScore = rawMaxPossibleScore > 0
    ? Math.min(10, Math.round((rawLiveScore / rawMaxPossibleScore) * 1000) / 100)
    : 0

  const scoreColor = liveScore >= 7 ? '#10B981' : liveScore >= 5 ? '#F59E0B' : '#EF4444'
  const checklistSuggestion = useChecklist
    ? assessChecklistCoverage(userAnswer, checklistItems)
    : null
  const fallbackSuggestion = activeExam
    ? assessAnswerAgainstText(userAnswer, activeExam.rawAnswer || activeExam.rawQuestion, activeExam.rawQuestion)
    : null
  const tomorrowTasks = buildTomorrowTasks({
    checklistItems,
    selectedGroups,
    fallbackSuggestion,
    maxTasks: 3,
  })

  // ── Efectos ─────────────────────────────────────────────────────────────────

  // Cuenta atrás del cronómetro
  useEffect(() => {
    if (!timerActive || examSubmitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setTimerActive(false)
          setExamSubmitted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive, examSubmitted])

  // Limpiar timer al salir del paso de examen
  useEffect(() => {
    if (step !== 'exam') {
      clearInterval(timerRef.current)
      setTimerActive(false)
    }
  }, [step])

  // Parsear criterios de corrección al entregar el examen
  useEffect(() => {
    if (examSubmitted && activeExam) {
      const parsed = parseCriterios(activeExam.rawAnswer)
      setChecklistItems(parsed.map(item => ({ ...item, checked: false })))
    }
  }, [examSubmitted])

  // Mostrar botón "Ir al inicio" tras 300px de scroll
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (step !== 'subjects') return
    const targetSlug = location.state?.subject
    if (!targetSlug) return
    const subject = SUBJECTS.find((s) => s.slug === targetSlug)
    if (!subject) return
    handleSelectSubject(subject)
  }, [location.state, step])

  // ── Manejadores de eventos ──────────────────────────────────────────────────

  async function handleSelectSubject(subject) {
    if (loadingData) return
    setLoadError(null)

    // Reusar datos ya cargados si es la misma materia
    if (selectedSubject?.slug === subject.slug && subjectData) {
      setStep('exams')
      return
    }

    setLoadingData(true)
    setSelectedSubject(subject)
    try {
      const data = EBAU_DATA[subject.slug]
      if (!data) throw new Error(`No hay datos para ${subject.slug}`)
      setSubjectData(data)
      const years = [...new Set(data.questions.map(q => q.year))].sort()
      setSelectedYear(years[0] ?? 2024)
      setExamIndex(0)
      setVisibleExams(8)
      setStep('exams')
    } catch {
      setLoadError(`Error al cargar los datos de ${subject.name}. Inténtalo de nuevo.`)
      setSelectedSubject(null)
    } finally {
      setLoadingData(false)
    }
  }

  function handleYearChange(year) {
    setSelectedYear(year)
    setExamIndex(0)
    setVisibleExams(8)
  }

  function handleEnterRevision(idx) {
    setExamIndex(idx)
    setShowAnswer(false)
    setStep('revision')
  }

  function handleEnterExam(idx) {
    setExamIndex(idx)
    setUserAnswer('')
    setTimeLeft(5400)
    setTimerActive(false)
    setExamSubmitted(false)
    setExamScore('')
    setConfirmAbort(false)
    setStep('exam')
  }

  function handleSubmitExam() {
    clearInterval(timerRef.current)
    setTimerActive(false)
    setExamSubmitted(true)
  }

  function handleSaveAndFinish() {
    const hasChecklist = checklistItems.length > 0
    const score = hasChecklist
      ? liveScore
      : Math.min(10, Math.max(0, parseFloat(examScore) || 0))
    const examLabel = activeExam ? formatExamLabel(activeExam) : ''
    const questionType = inferQuestionType(selectedSubject.slug, activeExam)
    addTestResult(selectedSubject.slug, score, [], examLabel, questionType)
    if (activeExam) markExamCompleted(activeExam.id, selectedSubject.slug)
    if (score >= 5) {
      playConfetti()
      confetti({ particleCount: 200, spread: 90, colors: ['#7C3AED', '#06B6D4', '#10B981'], origin: { y: 0.6 } })
    }
    setExamSubmitted(false)
    setUserAnswer('')
    setExamScore('')
    setChecklistItems([])
    setCollapsedGroups(new Set())
    setSelectedGroups(new Set())
    setTimeLeft(5400)
    setTimerActive(false)
    setConfirmAbort(false)
    setStep('exams')
  }

  function toggleChecklistItem(id) {
    setChecklistItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  function applySuggestedChecklist() {
    setChecklistItems((prev) =>
      assessChecklistCoverage(userAnswer, prev).suggestedItems.map((item) => ({
        ...item,
        checked: item.suggested,
      }))
    )
  }

  function toggleGroup(gid) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })
  }

  function toggleGroupSelection(groupId) {
    setSelectedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  function handleAbort() {
    clearInterval(timerRef.current)
    setTimerActive(false)
    setExamSubmitted(false)
    setUserAnswer('')
    setTimeLeft(5400)
    setConfirmAbort(false)
    setStep('exams')
  }

  function handleNavPrev() {
    if (safeIndex > 0) {
      setExamIndex(safeIndex - 1)
      setShowAnswer(false)
    }
  }

  function handleNavNext() {
    if (safeIndex < filteredExams.length - 1) {
      setExamIndex(safeIndex + 1)
      setShowAnswer(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? '20px 16px 32px' : '24px 20px 48px' }}>
      <AnimatePresence mode="wait">

        {/* ════════════════════════════════════════════════════════════════════
            PASO 1 — Selector de materia
        ════════════════════════════════════════════════════════════════════ */}
        {step === 'subjects' && (
          <motion.div
            key="subjects"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Cabecera */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
                fontSize: isMobile ? 22 : 26, color: 'var(--text-primary)', marginBottom: 6,
              }}>
                Exámenes Oficiales
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Exámenes reales de la EBAU — elige una asignatura
              </p>
            </div>

            {/* Error */}
            {loadError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, padding: '12px 16px', color: '#FCA5A5',
                  fontSize: 14, marginBottom: 20,
                }}
              >
                {loadError}
              </motion.div>
            )}

            {/* Grid de materias con entrada escalonada */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {SUBJECTS.map(subject => (
                <motion.div key={subject.slug} variants={cardVariants}>
                  <SubjectCard
                    subject={subject}
                    onClick={handleSelectSubject}
                    disabled={loadingData}
                    completedCount={completedExams.filter(e => e.subject === subject.slug).length}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Indicador de carga */}
            {loadingData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, marginTop: 24, color: 'var(--text-secondary)', fontSize: 14,
                }}
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  style={{ animation: 'selectivia-spin 0.9s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke={selectedSubject?.color ?? '#7C3AED'}
                    strokeWidth="2" strokeLinecap="round"
                  />
                </svg>
                Cargando exámenes...
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 2 — Selector de año y examen
        ════════════════════════════════════════════════════════════════════ */}
        {step === 'exams' && selectedSubject && (
          <motion.div key="exams" {...stepAnim}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: 24 }}>
              <BackButton
                onClick={() => setStep('subjects')}
                label={`${selectedSubject.icon} ${selectedSubject.name}`}
              />
            </div>

            {/* Fila de título + pills de año */}
            <div
              className="flex items-start justify-between flex-wrap gap-3"
              style={{ marginBottom: 24 }}
            >
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
                fontSize: 21, color: 'var(--text-primary)',
              }}>
                Selecciona un examen
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {availableYears.map(year => (
                  <YearPill
                    key={year}
                    year={year}
                    active={selectedYear === year}
                    color={selectedSubject.color}
                    onClick={() => handleYearChange(year)}
                  />
                ))}
              </div>
            </div>

            {/* Lista de exámenes o estado vacío */}
            {filteredExams.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '56px 0',
                color: 'var(--text-secondary)', fontSize: 15,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                No hay exámenes disponibles para {selectedYear}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExams.slice(0, visibleExams).map((exam, idx) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    color={selectedSubject.color}
                    onRevision={() => handleEnterRevision(idx)}
                    onExam={() => handleEnterExam(idx)}
                    completed={completedExams.some(e => e.id === exam.id)}
                  />
                ))}
                {filteredExams.length > visibleExams && (
                  <button
                    onClick={() => setVisibleExams((value) => value + 8)}
                    style={{
                      gridColumn: '1 / -1',
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cargar más exámenes ({filteredExams.length - visibleExams} restantes)
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 3a — Modo Revisión
        ════════════════════════════════════════════════════════════════════ */}
        {step === 'revision' && selectedSubject && activeExam && (
          <motion.div key="revision" {...stepAnim}>
            {/* Cabecera de navegación */}
            <div
              className="flex items-center justify-between flex-wrap gap-3"
              style={{ marginBottom: 24 }}
            >
              <BackButton
                onClick={() => { setStep('exams'); setShowAnswer(false) }}
                label="Volver"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: `${selectedSubject.color}20`, color: selectedSubject.color,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  Modo revisión
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {safeIndex + 1} / {filteredExams.length}
                </span>
              </div>
            </div>

            {/* Título del examen */}
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
              fontSize: 19, color: 'var(--text-primary)', margin: '0 0 16px',
            }}>
              {selectedSubject.name} — {formatExamLabel(activeExam)} ({activeExam.year})
            </h2>

            {/* Layout dos columnas: PDF (izquierda) + criterios (derecha) */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

              {/* Izquierda (60%): enlace al PDF + enunciado en texto */}
              <div style={{ flex: isMobile ? '1 1 auto' : '0 0 60%', width: isMobile ? '100%' : 'auto' }}>
                {/* Tarjeta de acceso al PDF */}
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '24px',
                  marginBottom: 16, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Ver examen oficial
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    {formatExamLabel(activeExam)} · {activeExam.year}
                  </div>
                  {PDF_PATHS[activeExam.id] ? (
                    <button
                      onClick={() => window.open(PDF_PATHS[activeExam.id], '_blank')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10, fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                        background: selectedSubject.color, color: '#000',
                        border: 'none',
                      }}
                    >
                      Abrir PDF →
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PDF no disponible</span>
                  )}
                </div>

                {/* Enunciado en texto plano */}
                {activeExam.rawQuestion && (
                  <pre style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '20px',
                    color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    overflowY: 'auto', maxHeight: isMobile ? 'none' : 'calc(100vh - 260px)',
                    margin: 0, fontFamily: '"Inter", sans-serif',
                  }}>
                    {activeExam.rawQuestion}
                  </pre>
                )}
              </div>

              {/* Derecha (40%): criterios de corrección + navegación */}
              <div style={{ flex: isMobile ? '1 1 auto' : '0 0 40%', minWidth: 0, width: isMobile ? '100%' : 'auto' }}>

                {/* Botón para mostrar/ocultar criterios */}
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 10, fontSize: 14,
                    fontWeight: 500, cursor: 'pointer', marginBottom: 10,
                    background: showAnswer ? `${selectedSubject.color}18` : 'var(--bg-elevated)',
                    border: `1px solid ${showAnswer ? selectedSubject.color : 'var(--border)'}`,
                    color: showAnswer ? selectedSubject.color : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {showAnswer ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                  {showAnswer ? 'Ocultar criterios de corrección' : 'Ver criterios de corrección'}
                </button>

                {/* Panel de criterios con animación de altura */}
                <AnimatePresence>
                  {showAnswer && (
                    <motion.div
                      key="criteria"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden', marginBottom: 16 }}
                    >
                      {activeExam.hasCriterios ? (
                        <div style={{ padding: '8px 0' }}>
                          <div style={{
                            fontSize: 10, color: selectedSubject.color, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
                          }}>
                            Criterios de corrección oficiales
                          </div>
                          <pre style={{
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.75,
                            color: 'var(--text-primary)', margin: 0,
                          }}>
                            {activeExam.rawAnswer}
                          </pre>
                        </div>
                      ) : (
                        <div style={{
                          background: 'var(--bg-elevated)', border: '1px solid #2D2D3F',
                          borderRadius: 12, padding: '18px 22px',
                          display: 'flex', alignItems: 'center', gap: 12,
                          color: 'var(--text-secondary)', fontSize: 14,
                        }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>📋</span>
                          Criterios no disponibles para este examen
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navegación anterior / siguiente */}
                <div
                  className="flex items-center justify-between"
                  style={{ paddingTop: 8, gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}
                >
                  <button
                    onClick={handleNavPrev}
                    disabled={safeIndex === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13,
                      fontWeight: 500, cursor: safeIndex === 0 ? 'default' : 'pointer',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: safeIndex === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Anterior
                  </button>

                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Examen {safeIndex + 1} de {filteredExams.length}
                  </span>

                  <button
                    onClick={handleNavNext}
                    disabled={safeIndex === filteredExams.length - 1}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13,
                      fontWeight: 500,
                      cursor: safeIndex === filteredExams.length - 1 ? 'default' : 'pointer',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: safeIndex === filteredExams.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    }}
                  >
                    Siguiente
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 3b — Modo Examen
        ════════════════════════════════════════════════════════════════════ */}
        {step === 'exam' && selectedSubject && activeExam && (
          <motion.div key="exam" {...stepAnim}>

            {/* ── Estado pre-inicio ─────────────────────────────────────── */}
            {!timerActive && !examSubmitted && (
              <div
                className="flex items-center justify-center"
                style={{ minHeight: '65vh' }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: isMobile ? '28px 20px 24px' : '40px 40px 36px',
                    textAlign: 'center', maxWidth: 440, width: '100%',
                  }}
                >
                  {/* Icono de reloj */}
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: `${selectedSubject.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, margin: '0 auto 20px',
                  }}>
                    ⏱️
                  </div>

                  <h2 style={{
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
                    fontSize: 22, color: 'var(--text-primary)', marginBottom: 6,
                  }}>
                    Modo Examen
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
                    {selectedSubject.icon} {selectedSubject.name}
                  </p>
                  <p style={{
                    color: selectedSubject.color, fontSize: 14, fontWeight: 500,
                    marginBottom: 22,
                  }}>
                    {formatExamLabel(activeExam)} · {activeExam.year}
                  </p>

                  {/* Info de tiempo */}
                  <div style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px',
                    marginBottom: 28, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65,
                    textAlign: 'left',
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Tienes 90 minutos</span>
                    {' '}para completar este examen. El cronómetro empezará cuando pulses{' '}
                    <em style={{ color: 'var(--text-primary)' }}>Comenzar examen</em>.
                  </div>

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                    <button
                      onClick={() => setStep('exams')}
                      style={{
                        padding: '10px 20px', borderRadius: 10, fontSize: 14,
                        fontWeight: 500, cursor: 'pointer',
                        background: 'transparent', border: '1px solid #2D2D3F',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setTimerActive(true)}
                      style={{
                        padding: '10px 24px', borderRadius: 10, fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                        background: selectedSubject.color,
                        border: `1px solid ${selectedSubject.color}`,
                        color: '#000',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      Comenzar examen →
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* ── Estado en curso ───────────────────────────────────────── */}
            {timerActive && !examSubmitted && (
              <div>
                {/* Barra superior pegajosa */}
                <div style={{
                  position: 'sticky', top: 0, zIndex: 10,
                  background: 'var(--bg-base)', borderBottom: '1px solid var(--border)',
                  padding: '10px 0 12px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10,
                  marginBottom: 24,
                }}>
                  {/* Botón abandonar / confirmación */}
                  {confirmAbort ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#FCA5A5', fontSize: 13 }}>
                        ¿Abandonar el examen?
                      </span>
                      <button
                        onClick={() => setConfirmAbort(false)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          background: 'transparent', border: '1px solid #2D2D3F',
                          color: 'var(--text-secondary)', cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAbort}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.4)',
                          color: '#EF4444', cursor: 'pointer',
                        }}
                      >
                        Sí, abandonar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmAbort(true)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 13,
                        background: 'transparent', border: '1px solid rgba(239,68,68,0.35)',
                        color: '#EF4444', cursor: 'pointer',
                      }}
                    >
                      Abandonar
                    </button>
                  )}

                  {/* Nombre del examen + PDF (pantallas medianas+) */}
                  <div
                    className="hidden sm:flex"
                    style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedSubject.icon} {formatExamLabel(activeExam)} · {activeExam.year}
                    </span>
                    {PDF_PATHS[activeExam.id] && (
                      <button
                        onClick={() => window.open(PDF_PATHS[activeExam.id], '_blank')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 16, fontSize: 11,
                          fontWeight: 500, cursor: 'pointer',
                          background: 'transparent',
                          border: `1px solid ${selectedSubject.color}50`,
                          color: selectedSubject.color,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${selectedSubject.color}12`}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        📄 PDF
                      </button>
                    )}
                  </div>

                  {/* Cronómetro */}
                  <motion.div
                    animate={timeLeft <= 60
                      ? { opacity: [1, 0.45, 1] }
                      : { opacity: 1 }
                    }
                    transition={timeLeft <= 60
                      ? { duration: 0.9, repeat: Infinity }
                      : {}
                    }
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: 20, fontWeight: 700, color: timerColor,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {formatTime(timeLeft)}
                  </motion.div>
                </div>

                {/* Enunciado + Respuesta en dos columnas */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4" style={{ marginBottom: 20, alignItems: 'start' }}>

                  {/* Columna izquierda (60%): enlace al PDF + enunciado en texto */}
                  <div
                    className="md:col-span-3"
                    style={{ position: isMobile ? 'static' : 'sticky', top: 64 }}
                  >
                    {/* Tarjeta de acceso al PDF */}
                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '24px',
                      marginBottom: 16, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
                        Ver examen oficial
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        {formatExamLabel(activeExam)} · {activeExam.year}
                      </div>
                      {PDF_PATHS[activeExam.id] ? (
                        <button
                          onClick={() => window.open(PDF_PATHS[activeExam.id], '_blank')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '10px 20px', borderRadius: 10, fontSize: 14,
                            fontWeight: 600, cursor: 'pointer',
                            background: selectedSubject.color, color: '#000',
                            border: 'none',
                          }}
                        >
                          Abrir PDF →
                        </button>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PDF no disponible</span>
                      )}
                    </div>

                    {/* Enunciado en texto plano */}
                    {activeExam.rawQuestion && (
                      <pre style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '20px',
                        color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        overflowY: 'auto', maxHeight: isMobile ? 320 : 'calc(100vh - 260px)',
                        margin: 0, fontFamily: '"Inter", sans-serif',
                      }}>
                        {activeExam.rawQuestion}
                      </pre>
                    )}
                  </div>

                  {/* Columna derecha (40%): área de respuesta */}
                  <div className="md:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{
                      fontSize: 13, color: 'var(--text-secondary)', display: 'block',
                      fontWeight: 500,
                    }}>
                      Tu respuesta
                    </label>
                    <textarea
                      value={userAnswer}
                      onChange={e => setUserAnswer(e.target.value)}
                      placeholder="Escribe tu respuesta aquí..."
                      style={{
                        width: '100%', minHeight: isMobile ? 260 : 'calc(100vh - 220px)', resize: 'vertical',
                        background: 'var(--bg-card)', color: 'var(--text-primary)',
                        border: '1px solid var(--border)', borderRadius: 10,
                        padding: '16px', fontFamily: '"Inter", sans-serif',
                        fontSize: 14, lineHeight: 1.75, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = selectedSubject.color}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                  </div>
                </div>

                {/* Botón de entregar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSubmitExam}
                    style={{
                      padding: '12px 28px', borderRadius: 10, fontSize: 14,
                      fontWeight: 600, cursor: 'pointer',
                      background: selectedSubject.color,
                      border: `1px solid ${selectedSubject.color}`,
                      color: '#000',
                    }}
                  >
                    Entregar examen
                  </button>
                </div>
              </div>
            )}

            {/* ── Estado entregado ──────────────────────────────────────── */}
            {examSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Cabecera de resultado */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 18 }}
                    style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: `${selectedSubject.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, margin: '0 auto 16px',
                    }}
                  >
                    ✅
                  </motion.div>
                  <h2 style={{
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
                    fontSize: 22, color: 'var(--text-primary)', marginBottom: 4,
                  }}>
                    Examen entregado
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                    {useChecklist
                      ? 'Marca los criterios que has cumplido'
                      : 'Compara tu respuesta con los criterios oficiales'}
                  </p>
                </div>

                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 18px', marginBottom: 18,
                }}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
                  }}>
                    Qué repasar mañana (3 tareas)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tomorrowTasks.map((task, idx) => (
                      <div
                        key={`${task.kind}-${idx}`}
                        style={{
                          borderRadius: 9,
                          padding: '9px 11px',
                          background: `${selectedSubject.color}10`,
                          border: `1px solid ${selectedSubject.color}35`,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                      >
                        {idx + 1}. {task.label}
                      </div>
                    ))}
                  </div>
                </div>

                {useChecklist ? (
                  /* ─── MODO CHECKLIST ─── */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ marginBottom: 20, alignItems: 'start' }}>

                    {/* Columna izquierda: tu respuesta (scrollable) */}
                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '18px 20px',
                    }}>
                      <div style={{
                        fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
                      }}>
                        Tu respuesta
                      </div>
                      <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                        <pre style={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.75,
                          color: userAnswer.trim() ? 'var(--text-primary)' : 'var(--text-muted)', margin: 0,
                        }}>
                          {userAnswer.trim() || '(Sin respuesta)'}
                        </pre>
                      </div>
                    </div>

                    {/* Columna derecha: contador + checklist */}
                    <div>
                      {/* Contador de puntuación (sticky) */}
                      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-base)', paddingBottom: 10, marginBottom: 10, zIndex: 5 }}>
                        <div style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${scoreColor}40`,
                          borderRadius: 14, padding: '14px 18px',
                        }}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                            Puntuación obtenida
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                            <motion.span
                              key={liveScore}
                              initial={{ scale: 1.3 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                              style={{
                                fontFamily: '"Space Grotesk", sans-serif',
                                fontSize: 42, fontWeight: 800, lineHeight: 1,
                                color: scoreColor,
                              }}
                            >
                              {fmtPts(liveScore)}
                            </motion.span>
                            <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>
                              / 10
                            </span>
                          </div>
                          {/* Barra de progreso */}
                          <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                            <motion.div
                              animate={{ width: `${(liveScore / 10) * 100}%` }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                              style={{ height: '100%', borderRadius: 6, background: scoreColor }}
                            />
                          </div>
                          {checklistSuggestion && (
                            <div style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              flexWrap: 'wrap',
                            }}>
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sugerencia automática</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: selectedSubject.color }}>
                                  {fmtPts(rawMaxPossibleScore > 0 ? Math.min(10, Math.round((checklistSuggestion.suggestedPoints / rawMaxPossibleScore) * 1000) / 100) : 0)} / 10
                                </div>
                              </div>
                              <button
                                onClick={applySuggestedChecklist}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 999,
                                  border: `1px solid ${selectedSubject.color}`,
                                  background: 'transparent',
                                  color: selectedSubject.color,
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                Aplicar sugerencia
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Instrucción EBAU */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 10, padding: '10px 13px', marginBottom: 12,
                        fontSize: 12, color: '#FCD34D', lineHeight: 1.55,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                        <span>
                          {ebauStructure
                            ? 'Selecciona las preguntas que has respondido en cada bloque, luego marca los criterios cumplidos.'
                            : 'Marca solo los criterios de los ejercicios que hayas respondido. El examen EBAU no requiere responder todos los bloques.'}
                        </span>
                      </div>

                      {ebauStructure ? (
                        /* ── MODO ESTRUCTURADO: bloques con selector de preguntas ── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {ebauStructure.bloques.map(bloque => {
                            const selectedInBloque = bloque.questions.filter(q => selectedGroups.has(q.id))
                            const overLimit = selectedInBloque.length > bloque.maxChoices
                            const bloqueScore = checklistItems
                              .filter(i => selectedInBloque.some(q => q.id === i.groupId) && i.checked)
                              .reduce((s, i) => s + i.points, 0)

                            return (
                              <div key={bloque.id} style={{
                                background: 'var(--bg-card)',
                                border: `1px solid ${selectedInBloque.length > 0 ? `${selectedSubject.color}40` : 'var(--border)'}`,
                                borderRadius: 12, padding: '14px 16px',
                                transition: 'border-color 0.2s',
                              }}>
                                {/* Cabecera de bloque */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{
                                      fontFamily: '"Space Grotesk", sans-serif',
                                      fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
                                      letterSpacing: '0.06em', color: selectedSubject.color,
                                    }}>
                                      {bloque.label}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Elige {bloque.maxChoices} de {bloque.questions.length} · máx. {fmtPts(bloque.maxPts)} pts
                                    </span>
                                  </div>
                                  {selectedInBloque.length > 0 && (
                                    <span style={{
                                      fontSize: 12, fontWeight: 600,
                                      color: bloqueScore > 0 ? '#34D399' : '#71717A',
                                    }}>
                                      {fmtPts(bloqueScore)} pts
                                    </span>
                                  )}
                                </div>

                                {/* Pills de selección de pregunta */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: selectedInBloque.length > 0 ? 12 : 0 }}>
                                  {bloque.questions.map(q => {
                                    const sel = selectedGroups.has(q.id)
                                    const pillLabel = q.label.replace(/^EJERCICIO /, 'Ej. ')
                                    return (
                                      <button
                                        key={q.id}
                                        onClick={() => toggleGroupSelection(q.id)}
                                        style={{
                                          padding: '5px 13px', borderRadius: 20,
                                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                          transition: 'all 0.15s',
                                          background: sel ? `${selectedSubject.color}22` : 'var(--bg-elevated)',
                                          border: `1px solid ${sel ? selectedSubject.color : 'var(--border)'}`,
                                          color: sel ? selectedSubject.color : '#71717A',
                                        }}
                                      >
                                        {sel ? '✓ ' : ''}{pillLabel}
                                      </button>
                                    )
                                  })}
                                </div>

                                {/* Aviso si supera el límite de elecciones */}
                                {overLimit && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 8, padding: '7px 11px',
                                    fontSize: 12, color: '#FCA5A5', marginBottom: 10,
                                  }}>
                                    <span>⚠️</span>
                                    <span>
                                      Has seleccionado {selectedInBloque.length} preguntas. Máximo permitido: {bloque.maxChoices}
                                    </span>
                                  </div>
                                )}

                                {/* Criterios de las preguntas seleccionadas */}
                                {selectedInBloque.map(q => (
                                  <div key={q.id} style={{ marginBottom: 6 }}>
                                    {/* Sub-cabecera de pregunta (solo si hay más de 1 elegida) */}
                                    {selectedInBloque.length > 1 && (
                                      <div style={{
                                        fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
                                        marginBottom: 5, paddingLeft: 2,
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                      }}>
                                        {q.label}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {q.items.map(item => (
                                        <motion.div
                                          key={item.id}
                                          onClick={() => toggleChecklistItem(item.id)}
                                          whileTap={{ scale: 0.985 }}
                                          style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                            padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                                            background: item.checked ? 'rgba(16,185,129,0.08)' : 'var(--bg-elevated)',
                                            border: `1px solid ${item.checked ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                                            transition: 'background 0.2s, border-color 0.2s',
                                          }}
                                        >
                                          <div style={{
                                            width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                                            border: `2px solid ${item.checked ? '#10B981' : '#3F3F52'}`,
                                            background: item.checked ? '#10B981' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'background 0.2s, border-color 0.2s',
                                          }}>
                                            {item.checked && (
                                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                          </div>
                                          <span style={{
                                            flex: 1, fontSize: 12, lineHeight: 1.6,
                                            color: item.checked ? '#6EE7B7' : 'var(--text-secondary)',
                                            textDecoration: item.checked ? 'line-through' : 'none',
                                            textDecorationColor: '#10B981',
                                            transition: 'color 0.2s',
                                          }}>
                                            {item.description}
                                          </span>
                                          <span style={{
                                            flexShrink: 0, fontSize: 11, fontWeight: 600,
                                            padding: '2px 6px', borderRadius: 5, marginTop: 2,
                                            background: item.checked ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)',
                                            color: item.checked ? '#6EE7B7' : '#71717A',
                                            border: `1px solid ${item.checked ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                                            transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                                          }}>
                                            {item.pointsRaw} pts
                                          </span>
                                          {!item.checked && checklistSuggestion?.suggestedItems.find((entry) => entry.id === item.id)?.suggested && (
                                            <span style={{
                                              flexShrink: 0,
                                              fontSize: 10,
                                              fontWeight: 700,
                                              padding: '2px 6px',
                                              borderRadius: 999,
                                              background: `${selectedSubject.color}15`,
                                              color: selectedSubject.color,
                                              border: `1px solid ${selectedSubject.color}30`,
                                            }}>
                                              sugerido
                                            </span>
                                          )}
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        /* ── MODO FLAT: checklist agrupado por sección ── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {groupedChecklistItems.map(group => (
                            <div key={group.id}>
                              {group.label && (
                                <button
                                  onClick={() => toggleGroup(group.id)}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', gap: 8,
                                    padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                                    background: 'var(--bg-elevated)', border: '1px solid #2D2D3F',
                                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                                    textAlign: 'left', marginBottom: 5,
                                    letterSpacing: '0.03em',
                                  }}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                      {collapsedGroups.has(group.id) ? '▶' : '▼'}
                                    </span>
                                    {group.label}
                                  </span>
                                  <span style={{
                                    fontSize: 11, padding: '1px 6px', borderRadius: 5,
                                    background: 'var(--border)', color: 'var(--text-muted)',
                                    border: '1px solid #2D2D3F', flexShrink: 0,
                                  }}>
                                    {fmtPts(group.totalPoints)} pts
                                  </span>
                                </button>
                              )}
                              {!collapsedGroups.has(group.id) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {group.items.map(item => (
                                    <motion.div
                                      key={item.id}
                                      onClick={() => toggleChecklistItem(item.id)}
                                      whileTap={{ scale: 0.985 }}
                                      style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                        background: item.checked ? 'rgba(16,185,129,0.08)' : 'var(--bg-card)',
                                        border: `1px solid ${item.checked ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                                        transition: 'background 0.2s, border-color 0.2s',
                                        marginLeft: group.label ? 8 : 0,
                                      }}
                                    >
                                      <div style={{
                                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                                        border: `2px solid ${item.checked ? '#10B981' : '#3F3F52'}`,
                                        background: item.checked ? '#10B981' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.2s, border-color 0.2s',
                                      }}>
                                        {item.checked && (
                                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        )}
                                      </div>
                                      <span style={{
                                        flex: 1, fontSize: 13, lineHeight: 1.6,
                                        color: item.checked ? '#6EE7B7' : 'var(--text-secondary)',
                                        textDecoration: item.checked ? 'line-through' : 'none',
                                        textDecorationColor: '#10B981',
                                        transition: 'color 0.2s',
                                      }}>
                                        {item.description}
                                      </span>
                                      <span style={{
                                        flexShrink: 0, fontSize: 11, fontWeight: 600,
                                        padding: '2px 7px', borderRadius: 6, marginTop: 2,
                                        background: item.checked ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)',
                                        color: item.checked ? '#6EE7B7' : '#71717A',
                                        border: `1px solid ${item.checked ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                                        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                                      }}>
                                        {item.pointsRaw} pts
                                      </span>
                                      {!item.checked && checklistSuggestion?.suggestedItems.find((entry) => entry.id === item.id)?.suggested && (
                                        <span style={{
                                          flexShrink: 0,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: 999,
                                          background: `${selectedSubject.color}15`,
                                          color: selectedSubject.color,
                                          border: `1px solid ${selectedSubject.color}30`,
                                        }}>
                                          sugerido
                                        </span>
                                      )}
                                    </motion.div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                            </div>
                          )}
                          {rawMaxPossibleScore > 0 && (
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                              Criterios marcados: {fmtPts(rawLiveScore)} / {fmtPts(rawMaxPossibleScore)} puntos brutos
                            </div>
                          )}
                        </div>
                      </div>
                ) : (
                  /* ─── MODO FALLBACK (sin criterios parseables) ─── */
                  <>
                    {/* Comparación lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
                      <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: '18px 20px',
                      }}>
                        <div style={{
                          fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
                        }}>
                          Tu respuesta
                        </div>
                        <pre style={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.75,
                          color: userAnswer.trim() ? 'var(--text-primary)' : 'var(--text-muted)', margin: 0,
                        }}>
                          {userAnswer.trim() || '(Sin respuesta)'}
                        </pre>
                      </div>
                      <div style={{
                        background: 'var(--bg-card)',
                        border: `1px solid ${activeExam.hasCriterios ? `${selectedSubject.color}40` : 'var(--border)'}`,
                        borderRadius: 12, padding: '18px 20px',
                      }}>
                        <div style={{
                          fontSize: 10,
                          color: activeExam.hasCriterios ? selectedSubject.color : 'var(--text-secondary)',
                          fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.07em', marginBottom: 12,
                        }}>
                          Criterios oficiales
                        </div>
                        {activeExam.hasCriterios ? (
                          <pre style={{
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.75,
                            color: 'var(--text-primary)', margin: 0,
                          }}>
                            {activeExam.rawAnswer}
                          </pre>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14, padding: '4px 0' }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
                            Los criterios de corrección no están disponibles para este examen.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Slider de autoevaluación manual */}
                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '18px 22px', marginBottom: 20,
                    }}>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Puntúate manualmente revisando los criterios
                      </div>
                      {fallbackSuggestion && (
                        <div style={{
                          marginBottom: 14,
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: `${selectedSubject.color}12`,
                          border: `1px solid ${selectedSubject.color}30`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sugerencia automática local</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: selectedSubject.color }}>
                                {fallbackSuggestion.score === 2 ? 'Alta' : fallbackSuggestion.score === 1 ? 'Parcial' : 'Baja'} · {Math.round(fallbackSuggestion.coverage * 100)}%
                              </div>
                            </div>
                            <button
                              onClick={() => setExamScore(fallbackSuggestion.score === 2 ? '8' : fallbackSuggestion.score === 1 ? '5' : '2')}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 999,
                                border: `1px solid ${selectedSubject.color}`,
                                background: 'transparent',
                                color: selectedSubject.color,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Usar sugerencia
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <input
                          type="range" min="0" max="10" step="0.5"
                          value={examScore || 0}
                          onChange={e => setExamScore(e.target.value)}
                          style={{ flex: 1, accentColor: selectedSubject.color, cursor: 'pointer' }}
                        />
                        <span style={{
                          fontFamily: '"Space Grotesk", sans-serif', fontSize: 24,
                          fontWeight: 700, color: 'var(--text-primary)', minWidth: 36, textAlign: 'right',
                        }}>
                          {examScore || '0'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Botón guardar + feedback */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                }}>
                  {useChecklist ? (
                    <div style={{ fontSize: 14 }}>
                      {liveScore >= 5 ? (
                        <span style={{ color: '#6EE7B7' }}>🎉 ¡Aprobado! Buen trabajo</span>
                      ) : (
                        <span style={{ color: '#FCA5A5' }}>💪 Sigue practicando, ¡tú puedes!</span>
                      )}
                    </div>
                  ) : <div />}
                  <button
                    onClick={handleSaveAndFinish}
                    style={{
                      padding: '10px 22px', borderRadius: 10, fontSize: 14,
                      fontWeight: 600, cursor: 'pointer',
                      background: selectedSubject.color,
                      border: `1px solid ${selectedSubject.color}`,
                      color: '#000',
                    }}
                  >
                    Guardar resultado
                  </button>
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante "Ir al inicio" */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Ir al inicio"
            style={{
              position: 'fixed', bottom: 80, right: 24, zIndex: 50,
              width: 40, height: 40, borderRadius: '50%',
              background: '#7C3AED', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.45)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Estilos globales */}
      <style>{`
        @keyframes selectivia-spin {
          to { transform: rotate(360deg); }
        }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #2D2D3F; }
        ::-webkit-scrollbar-thumb { background: #7C3AED; border-radius: 2px; }
        * { scrollbar-width: thin; scrollbar-color: #7C3AED #2D2D3F; }
      `}</style>
    </div>
  )
}
