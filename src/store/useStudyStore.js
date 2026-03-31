import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeExamDate } from '../lib/examDate.js'
import { clearOnboardingSnapshot, readOnboardingSnapshot, writeOnboardingSnapshot } from '../lib/onboardingStorage.js'

/** @typedef {{ biologia: number, fisica: number, historia: number, lengua: number, ingles: number, 'mates-sociales': number, matematicas: number, quimica: number }} SubjectProgress */

const DEFAULT_PROGRESS = {
  biologia: 0,
  fisica: 0,
  historia: 0,
  lengua: 0,
  ingles: 0,
  'mates-sociales': 0,
  matematicas: 0,
  quimica: 0,
}

const POMODORO_WORK_MINS = 25
const POMODORO_BREAK_MINS = 5
const onboardingBootstrap = readOnboardingSnapshot()

const safePersistStorage =
  typeof window === 'undefined'
    ? undefined
    : {
        getItem: (name) => {
          try {
            const raw = window.localStorage.getItem(name)
            if (!raw) return null
            try {
              return JSON.parse(raw)
            } catch {
              window.localStorage.removeItem(name)
              return null
            }
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          try {
            window.localStorage.setItem(name, JSON.stringify(value))
          } catch {}
        },
        removeItem: (name) => {
          try {
            window.localStorage.removeItem(name)
          } catch {}
        },
      }

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function toObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function toNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

const useStudyStore = create(
  persist(
    (set, get) => ({
      /** @type {SubjectProgress} Progreso por materia (0-100) */
      progress: { ...DEFAULT_PROGRESS },

      /** Racha de días consecutivos estudiados */
      streak: 0,

      /** ISO date string del último día de estudio */
      lastStudiedDate: null,

      /**
       * Historial de tests
       * @type {Array<{ subject: string, score: number, wrongAnswers: string[], date: string, label?: string, questionType?: string }>}
       */
      testHistory: [],

      /**
       * Sesiones Pomodoro
       * @type {Array<{ subject: string, duration: number, date: string }>}
       */
      pomodoroSessions: [],
      /**
       * Estado global del temporizador Pomodoro
       * @type {{ isWork: boolean, secondsLeft: number, running: boolean, endAt: number|null, sessionCount: number, selectedSubject: string }}
       */
      pomodoroTimer: {
        isWork: true,
        secondsLeft: POMODORO_WORK_MINS * 60,
        running: false,
        endAt: null,
        sessionCount: 1,
        selectedSubject: 'biologia',
      },

      /**
       * IDs de exámenes oficiales completados
       * @type {Array<{ id: string, subject: string }>}
       */
      completedExams: [],

      /**
       * Historial de resultados de flashcards
       * @type {Array<{ subject: string, cardId: string, result: 0|1|2, date: string }>}
       * result: 0 = No lo sabía, 1 = Más o menos, 2 = Lo sabía
       */
      flashcardHistory: [],

      /**
       * IDs de flashcards marcadas para repaso (por materia)
       * @type {Record<string, string[]>}
       */
      flashcardWrongIds: {},

      /** Fecha de selectividad elegida por el usuario (ISO date string YYYY-MM-DD) */
      examDate: normalizeExamDate(onboardingBootstrap.examDate),

      /**
       * Días del plan de estudio marcados como completados
       * @type {string[]} — ISO date strings
       */
      studyPlanCompleted: [],

      /** Horas de estudio diarias configuradas en el plan */
      studyHoursPerDay: 2,

      /** Si el audio está silenciado */
      soundMuted: false,

      /** Si el modo oscuro está activo */
      darkMode: true,

      /** Nombre del usuario */
      userName: onboardingBootstrap.userName,

      /** Si el usuario ha completado el onboarding inicial */
      hasCompletedOnboarding: onboardingBootstrap.completed,
      /** Si el estado persistido ya se ha rehidratado */
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: Boolean(value) }),

      /** Toast de feedback para acciones clave */
      uiToast: null,

      showToast: (message) =>
        set({ uiToast: { id: Date.now(), message } }),

      clearToast: () => set({ uiToast: null }),

      /** Actualiza el progreso de una materia */
      setProgress: (subject, value) =>
        set((state) => ({
          progress: { ...state.progress, [subject]: Math.min(100, Math.max(0, value)) },
        })),

      /** Registra un resultado de test y actualiza racha */
      addTestResult: (subject, score, wrongAnswers = [], label = '', questionType = 'desarrollo') => {
        const today = new Date().toISOString().split('T')[0]
        const state = get()

        // Calcular nueva racha
        let newStreak = state.streak
        if (state.lastStudiedDate !== today) {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]
          newStreak = state.lastStudiedDate === yesterdayStr ? state.streak + 1 : 1
        }

        set((s) => ({
          testHistory: [
            ...s.testHistory,
            { subject, score, wrongAnswers, date: new Date().toISOString(), label, questionType },
          ],
          streak: newStreak,
          lastStudiedDate: today,
        }))
      },

      /** Marca un examen oficial como completado */
      markExamCompleted: (examId, subjectSlug) =>
        set((s) => ({
          completedExams: s.completedExams.some(e => e.id === examId)
            ? s.completedExams
            : [...s.completedExams, { id: examId, subject: subjectSlug }],
        })),

      /** Registra el resultado de una flashcard y actualiza la lista de repaso */
      addFlashcardResult: (subject, cardId, result) => {
        const today = new Date().toISOString().split('T')[0]
        set((s) => {
          const prevWrong = s.flashcardWrongIds[subject] ?? []
          let newWrong
          if (result === 2) {
            // Lo sabía: quitar de la lista de repaso
            newWrong = prevWrong.filter(id => id !== cardId)
          } else if (result === 0) {
            // No lo sabía: añadir a la lista de repaso si no está
            newWrong = prevWrong.includes(cardId) ? prevWrong : [...prevWrong, cardId]
          } else {
            // Más o menos: mantener en repaso si ya estaba
            newWrong = prevWrong
          }
          return {
            flashcardHistory: [
              ...s.flashcardHistory,
              { subject, cardId, result, date: new Date().toISOString() },
            ],
            flashcardWrongIds: { ...s.flashcardWrongIds, [subject]: newWrong },
          }
        })
      },

      /** Establece la fecha del examen de selectividad */
      setExamDate: (date) => {
        const normalizedDate = normalizeExamDate(date)
        writeOnboardingSnapshot(get().userName, normalizedDate)
        set({ examDate: normalizedDate })
      },

      /** Actualiza las horas de estudio diarias */
      setStudyHoursPerDay: (hours) => set({ studyHoursPerDay: hours }),

      /** Marca/desmarca un día del plan como completado */
      toggleStudyPlanDay: (dateStr) =>
        set((s) => ({
          studyPlanCompleted: s.studyPlanCompleted.includes(dateStr)
            ? s.studyPlanCompleted.filter(d => d !== dateStr)
            : [...s.studyPlanCompleted, dateStr],
        })),

      /** Completa el onboarding guardando nombre y fecha */
      completeOnboarding: (name, date) => {
        const normalizedDate = normalizeExamDate(date)
        writeOnboardingSnapshot(name, normalizedDate)
        set({
          userName: name,
          examDate: normalizedDate,
          hasCompletedOnboarding: true,
          uiToast: { id: Date.now(), message: `Bienvenido${name ? `, ${name}` : ''}` },
        })
      },

      /** Actualiza el perfil del usuario */
      updateProfile: (name, date) => {
        const normalizedDate = normalizeExamDate(date)
        writeOnboardingSnapshot(name, normalizedDate)
        set({
          userName: name,
          examDate: normalizedDate,
          uiToast: { id: Date.now(), message: 'Perfil actualizado' },
        })
      },

      /** Alterna el modo oscuro/claro */
      toggleDarkMode: () => set((s) => ({
        darkMode: !s.darkMode,
        uiToast: { id: Date.now(), message: s.darkMode ? 'Modo claro activado' : 'Modo oscuro activado' },
      })),

      /** Alterna el silencio de audio */
      toggleMute: () => set((s) => {
        const next = !s.soundMuted
        try { localStorage.setItem('selectivia-muted', String(next)) } catch {}
        return {
          soundMuted: next,
          uiToast: { id: Date.now(), message: next ? 'Sonidos desactivados' : 'Sonidos activados' },
        }
      }),

      /** Registra una sesión Pomodoro completada */
      addPomodoroSession: (subject, duration) =>
        set((s) => ({
          pomodoroSessions: [
            ...s.pomodoroSessions,
            { subject, duration, date: new Date().toISOString() },
          ],
          uiToast: { id: Date.now(), message: `Pomodoro completado: ${duration} min` },
        })),

      /** Selecciona materia para el Pomodoro activo */
      setPomodoroSubject: (subject) =>
        set((s) => ({
          pomodoroTimer: {
            ...s.pomodoroTimer,
            selectedSubject: subject,
          },
        })),

      /** Inicia el temporizador Pomodoro global */
      startPomodoro: () =>
        set((s) => {
          if (s.pomodoroTimer.running) return {}
          return {
            pomodoroTimer: {
              ...s.pomodoroTimer,
              running: true,
              endAt: Date.now() + s.pomodoroTimer.secondsLeft * 1000,
            },
          }
        }),

      /** Pausa el temporizador Pomodoro global */
      pausePomodoro: () =>
        set((s) => {
          if (!s.pomodoroTimer.running || !s.pomodoroTimer.endAt) return {}
          const secondsLeft = Math.max(0, Math.ceil((s.pomodoroTimer.endAt - Date.now()) / 1000))
          return {
            pomodoroTimer: {
              ...s.pomodoroTimer,
              running: false,
              endAt: null,
              secondsLeft,
            },
          }
        }),

      /** Resetea el Pomodoro global al estado inicial */
      resetPomodoro: () =>
        set((s) => ({
          pomodoroTimer: {
            ...s.pomodoroTimer,
            isWork: true,
            secondsLeft: POMODORO_WORK_MINS * 60,
            running: false,
            endAt: null,
            sessionCount: 1,
          },
        })),

      /** Sincroniza el reloj con tiempo real (permite navegar sin que se pare) */
      syncPomodoroClock: () =>
        set((s) => {
          const timer = s.pomodoroTimer
          if (!timer.running || !timer.endAt) return {}

          const secondsLeft = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000))
          if (secondsLeft > 0) {
            if (secondsLeft === timer.secondsLeft) return {}
            return {
              pomodoroTimer: {
                ...timer,
                secondsLeft,
              },
            }
          }

          if (timer.isWork) {
            const nextSessionCount = timer.sessionCount + 1
            return {
              pomodoroSessions: [
                ...s.pomodoroSessions,
                { subject: timer.selectedSubject, duration: POMODORO_WORK_MINS, date: new Date().toISOString() },
              ],
              pomodoroTimer: {
                ...timer,
                running: false,
                endAt: null,
                isWork: false,
                secondsLeft: POMODORO_BREAK_MINS * 60,
                sessionCount: nextSessionCount,
              },
              uiToast: { id: Date.now(), message: `Pomodoro completado: ${POMODORO_WORK_MINS} min` },
            }
          }

          return {
            pomodoroTimer: {
              ...timer,
              running: false,
              endAt: null,
              isWork: true,
              secondsLeft: POMODORO_WORK_MINS * 60,
            },
            uiToast: { id: Date.now(), message: 'Descanso completado' },
          }
        }),

      /** Resetea todo el progreso */
      reset: () => {
        clearOnboardingSnapshot()
        set({
          progress: { ...DEFAULT_PROGRESS },
          streak: 0,
          lastStudiedDate: null,
          testHistory: [],
          pomodoroSessions: [],
          pomodoroTimer: {
            isWork: true,
            secondsLeft: POMODORO_WORK_MINS * 60,
            running: false,
            endAt: null,
            sessionCount: 1,
            selectedSubject: 'biologia',
          },
          completedExams: [],
          flashcardHistory: [],
          flashcardWrongIds: {},
          examDate: null,
          studyPlanCompleted: [],
          studyHoursPerDay: 2,
          soundMuted: false,
          darkMode: true,
          userName: '',
          hasCompletedOnboarding: false,
          uiToast: null,
        })
      },
    }),
    {
      name: 'selectivia-store',
      version: 2,
      storage: safePersistStorage,
      merge: (persistedState, currentState) => {
        const persisted = toObject(persistedState)
        const state = toObject(persisted.state)

        const mergedProgress = { ...DEFAULT_PROGRESS, ...toObject(state.progress) }
        for (const key of Object.keys(mergedProgress)) {
          mergedProgress[key] = Math.max(0, Math.min(100, toNumber(mergedProgress[key], 0)))
        }

        const timer = {
          ...currentState.pomodoroTimer,
          ...toObject(state.pomodoroTimer),
        }
        timer.isWork = Boolean(timer.isWork)
        timer.secondsLeft = Math.max(0, Math.floor(toNumber(timer.secondsLeft, POMODORO_WORK_MINS * 60)))
        timer.running = Boolean(timer.running)
        timer.endAt = timer.endAt == null ? null : toNumber(timer.endAt, null)
        timer.sessionCount = Math.max(1, Math.floor(toNumber(timer.sessionCount, 1)))
        timer.selectedSubject = typeof timer.selectedSubject === 'string' ? timer.selectedSubject : 'biologia'

        const persistedUserName =
          typeof state.userName === 'string' && state.userName.trim().length > 0
            ? state.userName
            : currentState.userName
        const inferredOnboarding =
          typeof state.hasCompletedOnboarding === 'boolean'
            ? state.hasCompletedOnboarding || currentState.hasCompletedOnboarding
            : persistedUserName.trim().length > 0

        return {
          ...currentState,
          ...state,
          progress: mergedProgress,
          testHistory: toArray(state.testHistory),
          pomodoroSessions: toArray(state.pomodoroSessions),
          pomodoroTimer: timer,
          completedExams: toArray(state.completedExams),
          flashcardHistory: toArray(state.flashcardHistory),
          flashcardWrongIds: toObject(state.flashcardWrongIds),
          studyPlanCompleted: toArray(state.studyPlanCompleted),
          studyHoursPerDay: Math.max(1, Math.min(8, toNumber(state.studyHoursPerDay, currentState.studyHoursPerDay))),
          streak: Math.max(0, Math.floor(toNumber(state.streak, 0))),
          darkMode: typeof state.darkMode === 'boolean' ? state.darkMode : currentState.darkMode,
          soundMuted: typeof state.soundMuted === 'boolean' ? state.soundMuted : currentState.soundMuted,
          userName: persistedUserName,
          hasCompletedOnboarding: inferredOnboarding,
          examDate: normalizeExamDate(state.examDate) ?? currentState.examDate,
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (state?.setHasHydrated) {
          state.setHasHydrated(true)
          return
        }

        if (error) {
          queueMicrotask(() => {
            useStudyStore.setState({ hasHydrated: true })
          })
        }
      },
      partialize: (state) => ({
        progress: state.progress,
        streak: state.streak,
        lastStudiedDate: state.lastStudiedDate,
        testHistory: state.testHistory,
        pomodoroSessions: state.pomodoroSessions,
        pomodoroTimer: state.pomodoroTimer,
        completedExams: state.completedExams,
        flashcardHistory: state.flashcardHistory,
        flashcardWrongIds: state.flashcardWrongIds,
        examDate: state.examDate,
        studyPlanCompleted: state.studyPlanCompleted,
        studyHoursPerDay: state.studyHoursPerDay,
        soundMuted: state.soundMuted,
        darkMode: state.darkMode,
        userName: state.userName,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
)

export default useStudyStore
