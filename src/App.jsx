import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard/index.jsx'
import ExamenesOficiales from './pages/ExamenesOficiales/index.jsx'
import Flashcards from './pages/Flashcards/index.jsx'
import Tests from './pages/Tests/index.jsx'
import Predicciones2026 from './pages/Predicciones2026/index.jsx'
import Pomodoro from './pages/Pomodoro/index.jsx'
import Calendario from './pages/Calendario/index.jsx'
import Onboarding from './pages/Onboarding/index.jsx'
import useStudyStore from './store/useStudyStore.js'

export default function App() {
  const hasCompletedOnboarding = useStudyStore((s) => s.hasCompletedOnboarding)
  const darkMode = useStudyStore((s) => s.darkMode)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  if (!hasCompletedOnboarding) {
    return <Onboarding />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/examenes" element={<ExamenesOficiales />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/predicciones" element={<Predicciones2026 />} />
        <Route path="/pomodoro" element={<Pomodoro />} />
        <Route path="/calendario" element={<Calendario />} />
      </Routes>
    </Layout>
  )
}
