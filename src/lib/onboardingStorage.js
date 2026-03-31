import { normalizeExamDate } from './examDate.js'

const ONBOARDING_STORAGE_KEY = 'selectivia-onboarding'

export function readOnboardingSnapshot() {
  if (typeof window === 'undefined') {
    return { completed: false, userName: '', examDate: null }
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return { completed: false, userName: '', examDate: null }

    const parsed = JSON.parse(raw)
    return {
      completed: Boolean(parsed?.completed),
      userName: typeof parsed?.userName === 'string' ? parsed.userName : '',
      examDate: normalizeExamDate(parsed?.examDate),
    }
  } catch {
    return { completed: false, userName: '', examDate: null }
  }
}

export function writeOnboardingSnapshot(userName, examDate) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        completed: true,
        userName: typeof userName === 'string' ? userName : '',
        examDate: normalizeExamDate(examDate),
      })
    )
  } catch {}
}

export function clearOnboardingSnapshot() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch {}
}
