const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseExamDateParts(value) {
  const raw = String(value ?? '').trim()
  if (!ISO_DATE_RE.test(raw)) return null

  const [yearRaw, monthRaw, dayRaw] = raw.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day, raw }
}

export function normalizeExamDate(value) {
  return parseExamDateParts(value)?.raw ?? null
}

export function isValidExamDate(value) {
  return normalizeExamDate(value) !== null
}

export function parseExamDate(value) {
  const exam = parseExamDateParts(value)
  if (!exam) return null
  return new Date(exam.year, exam.month - 1, exam.day, 12, 0, 0, 0)
}

export function toExamDateString(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateString(today = new Date()) {
  return toExamDateString(today)
}

export function addDaysToDateString(value, amount) {
  const date = parseExamDate(value)
  if (!date) return null
  date.setDate(date.getDate() + amount)
  return toExamDateString(date)
}

export function daysBetweenDateStrings(start, end) {
  const startDate = parseExamDate(start)
  const endDate = parseExamDate(end)
  if (!startDate || !endDate) return null
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
}

export function getDaysUntilExam(value, today = new Date()) {
  const exam = parseExamDateParts(value)
  if (!exam) return null

  const currentUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const examUtc = Date.UTC(exam.year, exam.month - 1, exam.day)
  return Math.ceil((examUtc - currentUtc) / 86400000)
}
