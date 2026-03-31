const ROUTE_IMPORTERS = {
  '/': () => import('../pages/Dashboard/index.jsx'),
  '/examenes': () => import('../pages/ExamenesOficiales/index.jsx'),
  '/flashcards': () => import('../pages/Flashcards/index.jsx'),
  '/tests': () => import('../pages/Tests/index.jsx'),
  '/predicciones': () => import('../pages/Predicciones2026/index.jsx'),
  '/pomodoro': () => import('../pages/Pomodoro/index.jsx'),
  '/calendario': () => import('../pages/Calendario/index.jsx'),
}

const preloaded = new Set()

export function preloadRoute(path) {
  const importer = ROUTE_IMPORTERS[path]
  if (!importer || preloaded.has(path)) return
  preloaded.add(path)
  importer().catch(() => {
    preloaded.delete(path)
  })
}
