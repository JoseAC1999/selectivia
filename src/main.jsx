import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

function formatError(error) {
  if (!error) return 'Error desconocido al iniciar la aplicación.'
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Error no serializable al iniciar la aplicación.'
  }
}

function resetLocalData() {
  try {
    localStorage.removeItem('selectivia-store')
    localStorage.removeItem('selectivia-muted')
  } catch {}
  window.location.reload()
}

function CrashScreen({ title, message }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(circle at top, #1b1b2b 0%, #09090f 65%)',
        color: '#fff',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'rgba(17, 17, 24, 0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>SelectivIA</div>
            <div style={{ fontSize: 14, color: '#c4c4d4' }}>{title}</div>
          </div>
        </div>

        <p style={{ margin: '0 0 12px', color: '#e5e7eb', lineHeight: 1.6 }}>
          La app ha detectado un fallo al arrancar. Puedes recargar o limpiar los datos locales para recuperar el acceso.
        </p>

        <pre
          style={{
            margin: 0,
            padding: 14,
            borderRadius: 16,
            background: '#0b0b12',
            color: '#fca5a5',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </pre>

        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '12px 16px',
              background: '#ffffff',
              color: '#111118',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <button
            onClick={resetLocalData}
            style={{
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12,
              padding: '12px 16px',
              background: 'transparent',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Limpiar datos locales
          </button>
        </div>
      </div>
    </div>
  )
}

function renderCrashScreen(title, error) {
  root.render(<CrashScreen title={title} message={formatError(error)} />)
}

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('SelectivIA startup error:', error)
  }

  render() {
    if (this.state.error) {
      return <CrashScreen title="Error de renderizado" message={formatError(this.state.error)} />
    }

    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  renderCrashScreen('Error al iniciar', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  renderCrashScreen('Promesa no controlada', event.reason)
})

async function bootstrap() {
  try {
    const { default: App } = await import('./App.jsx')
    root.render(
      <StrictMode>
        <RootErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RootErrorBoundary>
      </StrictMode>
    )
  } catch (error) {
    renderCrashScreen('Fallo al cargar la aplicación', error)
  }
}

bootstrap()
