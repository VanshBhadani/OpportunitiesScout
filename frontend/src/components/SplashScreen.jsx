import { useEffect, useState } from 'react'
import { Globe } from './ui/globe'
import { motion } from 'framer-motion'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'),  800)   // logo fades in
    const t2 = setTimeout(() => setPhase('rise'),  2200)  // logo rises
    const t3 = setTimeout(() => onDone(),          3000)  // exit triggered by unmount via AnimatePresence

    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [onDone])

  const logoTransform =
    phase === 'enter'
      ? 'translateY(20px) scale(0.95)'
      : phase === 'hold'
      ? 'translateY(0) scale(1)'
      : 'translateY(-10vh) scale(0.95)'

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F0F14] overflow-hidden`}
    >
      {/* 3D Globe Background */}
      <div 
        className="absolute inset-0 flex items-center justify-center z-0 transition-all duration-1000 ease-out"
        style={{
          opacity: phase === 'enter' ? 0 : 0.6,
          transform: phase === 'rise' ? 'translateY(10vh) scale(1.1)' : 'translateY(15vh) scale(1.1)'
        }}
      >
        <Globe />
        <div className="pointer-events-none absolute inset-0 h-full bg-[radial-gradient(circle_at_50%_150%,rgba(37,99,235,0.15),rgba(15,15,20,1)_70%)]" />
      </div>

      <div
        className="text-center relative z-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: logoTransform,
        }}
      >
        <motion.span 
          layoutId="main-logo"
          className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-white to-slate-400/80 bg-clip-text text-center text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-none text-transparent drop-shadow-2xl"
          style={{ whiteSpace: 'nowrap', textWrap: 'nowrap' }}
        >
          Opportunity Scout
        </motion.span>
        <p
          className="mt-6 text-sm md:text-base text-slate-300/70 font-medium tracking-wide uppercase transition-opacity duration-300"
          style={{ opacity: phase === 'hold' ? 1 : 0 }}
        >
          AI-tailored opportunity discovery
        </p>

        {phase === 'hold' && (
          <div className="mt-12 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-blue-500/80"
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
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.6); }
          40%            { opacity: 1;   transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fixed.z-\[9999\] > div {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  )
}
