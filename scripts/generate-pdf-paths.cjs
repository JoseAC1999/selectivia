#!/usr/bin/env node
'use strict'

/**
 * generate-pdf-paths.cjs
 * Escanea selectividad_preguntas/ y genera src/data/pdf-paths.json
 * que mapea examId → ruta absoluta del PDF original.
 */

const fs   = require('fs')
const path = require('path')

const ROOT      = path.join(__dirname, '..')
const PDF_ROOT  = path.join(ROOT, 'public', 'pdfs')
const OUT_FILE  = path.join(ROOT, 'src', 'data', 'pdf-paths.json')

// Mapa: slug → nombre de carpeta raíz en selectividad_preguntas/
const SUBJECT_FOLDERS = {
  'biologia':       'Biologia',
  'historia':       'Historia de España',
  'lengua':         'Lengua castellana y literatura II-2',
  'ingles':         'Lengua_Extranjera_Ingles',
  'matematicas':    'Matematicas II',
  'mates-sociales': 'Matemáticas Aplicadas a las Ciencias Sociales II',
  'quimica':        'Quimica',
}

/**
 * Dado un nombre de archivo de examen, extrae { examType, option }.
 * Patrones conocidos:
 *   Examen_Reserva-A_*.pdf
 *   Examen-Titular-A_*.pdf   (variante con guión)
 *   Examen_Suplente1-B_*.pdf
 */
function parseExamFilename(filename) {
  // Eliminar prefijo "Examen" y cualquier separador (_/-)
  const base = filename.replace(/\.pdf$/i, '')
  // Capturar el tipo de examen y la opción
  const m = base.match(/^Examen[_-]([A-Za-z0-9]+)[-_]([A-Z])[_\s]/i)
  if (!m) return null
  return { examType: m[1], option: m[2].toUpperCase() }
}

/**
 * Normaliza examType para que coincida con el formato del JSON EBAU.
 * En los JSON se usa: Titular, Titular2, Reserva, Suplente, Suplente1, Suplente2, etc.
 * Los nombres de archivo usan las mismas convenciones (capitalización puede variar).
 */
function normalizeExamType(t) {
  // Capitalizar primera letra de cada palabra (Titular2 → Titular2, RESERVA → Reserva)
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    .replace(/(\d+)/, (m) => m)   // mantener números
}

const paths = {}
let count = 0

for (const [slug, folderName] of Object.entries(SUBJECT_FOLDERS)) {
  const subjectDir = path.join(PDF_ROOT, folderName)
  if (!fs.existsSync(subjectDir)) {
    console.warn(`  ⚠ Carpeta no encontrada: ${subjectDir}`)
    continue
  }

  // Enumerar años (subcarpetas que empiezan con el nombre de la asignatura)
  let entries
  try { entries = fs.readdirSync(subjectDir) } catch { continue }
  const yearDirs = entries.filter(e => {
    const stat = fs.statSync(path.join(subjectDir, e))
    return stat.isDirectory()
  })

  for (const yearDir of yearDirs) {
    // Extraer año del nombre de la carpeta (buscar 4 dígitos)
    const yearMatch = yearDir.match(/(\d{4})/)
    if (!yearMatch) continue
    const year = parseInt(yearMatch[1], 10)

    const yearPath = path.join(subjectDir, yearDir)
    let files
    try { files = fs.readdirSync(yearPath) } catch { continue }

    // Solo archivos PDF que empiecen con "Examen"
    const examPdfs = files.filter(f => f.match(/^Examen/i) && f.match(/\.pdf$/i))

    for (const pdfFile of examPdfs) {
      const parsed = parseExamFilename(pdfFile)
      if (!parsed) {
        console.warn(`  ⚠ No se pudo parsear: ${pdfFile}`)
        continue
      }
      // Normalizar examType
      const examType = normalizeExamType(parsed.examType)
      const option   = parsed.option.toUpperCase()

      // Construir examId como en el JSON EBAU
      const examId = `${slug}-${year}-${examType.toLowerCase()}-${option.toLowerCase()}`
      const relPath = path.join(yearPath, pdfFile)

      paths[examId] = '/pdfs/' + path.relative(PDF_ROOT, relPath).split(path.sep).join('/')
      count++
    }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(paths, null, 2), 'utf8')
console.log(`\n✅ ${count} rutas PDF generadas → src/data/pdf-paths.json`)

// Mostrar muestra
const sample = Object.entries(paths).slice(0, 5)
for (const [id, p] of sample) {
  console.log(`  ${id} → ${p}`)
}
