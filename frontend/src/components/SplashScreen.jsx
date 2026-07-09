// ────────────────────────────────────────────────────────────────
// SplashScreen.jsx — Full-screen intro shown on every hard reload
// Dark overlay, Space Grotesk wordmark, minimal dot loader.
// Phases: enter → hold → rise → exit. No orbs, no gradients, no emoji.
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

  const logoTransform =
    phase === 'enter'
      ? 'translateY(20px) scale(0.95)'
      : phase === 'hold'
      ? 'translateY(0) scale(1)'
      : 'translateY(-30vh) scale(0.75)'

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-dark transition-opacity duration-500 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: logoTransform,
        }}
      >
        <h1 className="font-display font-bold type-display text-on-dark">
          OpportunityScout
        </h1>
        <p
          className="mt-2 text-sm text-on-dark-muted transition-opacity duration-300"
          style={{ opacity: phase === 'hold' ? 1 : 0 }}
        >
          AI-tailored opportunity discovery
        </p>

        {phase === 'hold' && (
          <div className="mt-8 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                style={{
                  animation: 'splashDot 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes splashDot {
          0%, 80%, 100% { opacity: 0.4; transform: scale(0.6); }
          40%            { opacity: 1;   transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fixed.z-\[9999\] > div {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
