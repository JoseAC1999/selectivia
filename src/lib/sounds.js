/**
 * Sonidos generados programáticamente con Web Audio API.
 * Sin archivos de audio externos.
 */

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function isMuted() {
  try {
    return localStorage.getItem('selectivia-muted') === 'true'
  } catch {
    return false
  }
}

function note(freq, startTime, duration, gainValue = 0.3, type = 'sine', ac) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(gainValue, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

/** Ding ascendente corto — respuesta correcta en flashcard */
export function playSuccess() {
  if (isMuted()) return
  try {
    const ac = getCtx()
    const t = ac.currentTime
    note(523, t, 0.12, 0.25, 'sine', ac)        // C5
    note(659, t + 0.1, 0.15, 0.25, 'sine', ac)  // E5
    note(784, t + 0.2, 0.2, 0.3, 'sine', ac)    // G5
  } catch {}
}

/** Buzz grave corto — respuesta incorrecta en flashcard */
export function playWrong() {
  if (isMuted()) return
  try {
    const ac = getCtx()
    const t = ac.currentTime
    note(200, t, 0.08, 0.3, 'square', ac)
    note(150, t + 0.07, 0.12, 0.25, 'square', ac)
  } catch {}
}

/** Campana suave — sesión de trabajo completada */
export function playPomodoroComplete() {
  if (isMuted()) return
  try {
    const ac = getCtx()
    const t = ac.currentTime
    // Acorde mayor ascendente
    note(440, t, 0.3, 0.2, 'sine', ac)          // A4
    note(554, t + 0.15, 0.3, 0.2, 'sine', ac)   // C#5
    note(659, t + 0.3, 0.4, 0.25, 'sine', ac)   // E5
    note(880, t + 0.45, 0.6, 0.2, 'sine', ac)   // A5
  } catch {}
}

/** Campana diferente — descanso completado */
export function playBreakComplete() {
  if (isMuted()) return
  try {
    const ac = getCtx()
    const t = ac.currentTime
    note(659, t, 0.25, 0.2, 'sine', ac)         // E5
    note(523, t + 0.2, 0.25, 0.2, 'sine', ac)   // C5
    note(392, t + 0.4, 0.4, 0.2, 'sine', ac)    // G4
  } catch {}
}

/** Melodía alegre ascendente — examen aprobado */
export function playConfetti() {
  if (isMuted()) return
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const melody = [
      [523, 0.0], [659, 0.1], [784, 0.2],
      [1047, 0.35], [784, 0.5], [1047, 0.65], [1319, 0.8],
    ]
    melody.forEach(([freq, offset]) => {
      note(freq, t + offset, 0.18, 0.22, 'sine', ac)
    })
  } catch {}
}
