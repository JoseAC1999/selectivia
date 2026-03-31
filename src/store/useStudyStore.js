import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
      examDate: null,

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
      userName: '',

      /** Si el usuario ha completado el onboarding inicial */
      hasCompletedOnboarding: false,

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
      setExamDate: (date) => set({ examDate: date }),

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
      completeOnboarding: (name, date) =>
        set({
          userName: name,
          examDate: date || null,
          hasCompletedOnboarding: true,
          uiToast: { id: Date.now(), message: `Bienvenido${name ? `, ${name}` : ''}` },
        }),

      /** Actualiza el perfil del usuario */
      updateProfile: (name, date) =>
        set({
          userName: name,
          examDate: date || null,
          uiToast: { id: Date.now(), message: 'Perfil actualizado' },
        }),

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
      reset: () =>
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
        }),
    }),
    {
      name: 'selectivia-store',
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
