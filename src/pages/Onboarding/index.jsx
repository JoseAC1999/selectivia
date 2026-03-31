import { useState } from 'react'
import { motion } from 'framer-motion'
import useStudyStore from '../../store/useStudyStore.js'
import useIsMobile from '../../hooks/useIsMobile.js'

export default function Onboarding() {
  const completeOnboarding = useStudyStore((s) => s.completeOnboarding)
  const isMobile = useIsMobile()
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor, dinos cómo te llamas.')
      return
    }
    completeOnboarding(name.trim(), examDate || null)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        paddingTop: isMobile ? '32px' : '24px',
        paddingBottom: isMobile ? '32px' : '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: isMobile ? '32px 20px' : '48px 40px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              boxShadow: '0 0 20px rgba(124,58,237,0.4)',
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: isMobile ? 20 : 24,
              fontWeight: 700,
              fontFamily: '"Space Grotesk", sans-serif',
              background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SelectivIA
          </span>
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1
            style={{
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: '"Space Grotesk", sans-serif',
              marginBottom: 8,
            }}
          >
            Bienvenido/a a SelectivIA 🎓
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Tu plataforma de estudio para la EBAU 2026
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Nombre */}
          <div>
            <label
              htmlFor="userName"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}
            >
              ¿Cómo te llamas? <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              id="userName"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="Tu nombre"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: error ? '1px solid #EF4444' : '1px solid #2E2E40',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { if (!error) e.target.style.borderColor = '#7C3AED' }}
              onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border)' }}
            />
            {error && (
              <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{error}</p>
            )}
          </div>

          {/* Fecha de selectividad */}
          <div>
            <label
              htmlFor="examDate"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}
            >
              ¿Cuándo es tu selectividad?{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              id="examDate"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              min="2026-01-01"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: examDate ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
                colorScheme: 'dark',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#7C3AED' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>

          {/* Botón */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: '"Space Grotesk", sans-serif',
              boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
            }}
          >
            Empezar a estudiar →
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
