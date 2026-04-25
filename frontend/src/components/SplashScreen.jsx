// ────────────────────────────────────────────────────────────────
// SplashScreen.jsx — Full-screen intro animation shown on every
// page load/reload. Logo pulses in the center, then slides up
// and fades out. App redirects to "/" after animation.
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  // phase: 'enter' → 'hold' → 'rise' → 'exit'
  const [phase, setPhase] = useState('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'),  600)   // logo fades in
    const t2 = setTimeout(() => setPhase('rise'),  1600)  // logo rises
    const t3 = setTimeout(() => setPhase('exit'),  2400)  // overlay fades out
    const t4 = setTimeout(() => onDone(),          2900)  // unmount + redirect

    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [onDone])

  /* ── Dynamic styles per phase ──────────────────────────── */
  const logoStyle = {
    transition: 'transform 0.75s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease',
    opacity: phase === 'enter' ? 0 : 1,
    transform:
      phase === 'enter' ? 'translateY(20px) scale(0.9)'
      : phase === 'hold' ? 'translateY(0px) scale(1)'
      : 'translateY(-38vh) scale(0.55)',
  }

  const overlayStyle = {
    transition: phase === 'exit' ? 'opacity 0.5s ease' : 'none',
    opacity: phase === 'exit' ? 0 : 1,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 60%, #13102b 0%, #0a0a14 100%)',
        pointerEvents: 'all',
        ...overlayStyle,
      }}
    >
      {/* Animated orbs behind logo */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
        animation: 'orb-drift-1 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)',
        animation: 'orb-drift-2 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Logo block */}
      <div style={{ ...logoStyle, textAlign: 'center', userSelect: 'none' }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 0 60px rgba(99,102,241,0.6), 0 0 120px rgba(168,85,247,0.3)',
          fontSize: 36,
        }}>
          🎯
        </div>

        {/* Word mark */}
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #a5b4fc 0%, #c084fc 50%, #a5b4fc 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'shimmer 2.5s linear infinite',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          OpportunityScout
        </div>

        {/* Tagline */}
        <div style={{
          marginTop: 8,
          fontSize: 13,
          color: 'rgba(148,163,184,0.7)',
          letterSpacing: '0.08em',
          fontFamily: 'Inter, system-ui, sans-serif',
          transition: 'opacity 0.4s ease',
          opacity: phase === 'hold' ? 1 : 0,
        }}>
          AI-powered opportunity discovery
        </div>

        {/* Loading dots */}
        {phase === 'hold' && (
          <div style={{ marginTop: 32, display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(99,102,241,0.8)',
                animation: `splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
