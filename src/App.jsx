import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import useStudyStore from './store/useStudyStore.js'

const Dashboard = lazy(() => import('./pages/Dashboard/index.jsx'))
const ExamenesOficiales = lazy(() => import('./pages/ExamenesOficiales/index.jsx'))
const Flashcards = lazy(() => import('./pages/Flashcards/index.jsx'))
const Tests = lazy(() => import('./pages/Tests/index.jsx'))
const Predicciones2026 = lazy(() => import('./pages/Predicciones2026/index.jsx'))
const Pomodoro = lazy(() => import('./pages/Pomodoro/index.jsx'))
const Calendario = lazy(() => import('./pages/Calendario/index.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding/index.jsx'))

function AppLoader() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 44,
            height: 44,
            margin: '0 auto 14px',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            color: '#fff',
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
          }}
        >
          S
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>Cargando SelectivIA...</p>
      </div>
    </div>
  )
}

export default function App() {
  const hasHydrated = useStudyStore((s) => s.hasHydrated)
  const hasCompletedOnboarding = useStudyStore((s) => s.hasCompletedOnboarding)
  const darkMode = useStudyStore((s) => s.darkMode)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  if (!hasHydrated) {
    return <AppLoader />
  }

  if (!hasCompletedOnboarding) {
    return (
      <Suspense fallback={<AppLoader />}>
        <Onboarding />
      </Suspense>
    )
  }

  return (
    <Layout>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/examenes" element={<ExamenesOficiales />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/predicciones" element={<Predicciones2026 />} />
          <Route path="/pomodoro" element={<Pomodoro />} />
          <Route path="/calendario" element={<Calendario />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
