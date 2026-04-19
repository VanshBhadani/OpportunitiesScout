// ────────────────────────────────────────────────────────────────
// App.jsx — Root component with React Router routes
// ────────────────────────────────────────────────────────────────

import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RunAgent from './pages/RunAgent'
import GlmIndicator from './components/GlmIndicator'

// ── Subtle animated background ─────────────────────────────────────
function BackgroundFX() {
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 0,
      pointerEvents: 'none', overflow: 'hidden',
    }}>

      {/* ── Mesh dot grid ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'radial-gradient(circle, rgba(99,102,241,0.2) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 90% 90% at 50% 40%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 40%, black 20%, transparent 100%)',
      }} />

      {/* ── Orb 1 — top-left indigo ───────────────────────────── */}
      <div style={{
        position: 'absolute',
        width: 700, height: 700,
        top: '-10%', left: '-8%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)',
        animation: 'orb-drift-1 18s ease-in-out infinite',
      }} />

      {/* ── Orb 2 — bottom-right violet ───────────────────────── */}
      <div style={{
        position: 'absolute',
        width: 750, height: 750,
        bottom: '-15%', right: '-8%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, rgba(168,85,247,0.05) 50%, transparent 70%)',
        animation: 'orb-drift-2 24s ease-in-out infinite',
      }} />

      {/* ── Orb 3 — centre faint blue ─────────────────────────── */}
      <div style={{
        position: 'absolute',
        width: 500, height: 500,
        top: '25%', left: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        animation: 'orb-drift-3 30s ease-in-out infinite',
      }} />

      {/* ── Floating particles ────────────────────────────────── */}
      {[
        { w:3, h:3, top:'15%', left:'20%', dur:'12s', delay:'0s'  },
        { w:2, h:2, top:'70%', left:'10%', dur:'16s', delay:'2s'  },
        { w:4, h:4, top:'40%', left:'80%', dur:'20s', delay:'5s'  },
        { w:2, h:2, top:'80%', left:'55%', dur:'14s', delay:'1s'  },
        { w:3, h:3, top:'25%', left:'65%', dur:'18s', delay:'7s'  },
        { w:2, h:2, top:'60%', left:'35%', dur:'22s', delay:'3s'  },
        { w:3, h:3, top:'50%', left:'88%', dur:'15s', delay:'4s'  },
        { w:2, h:2, top:'10%', left:'50%', dur:'19s', delay:'6s'  },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: p.w, height: p.h,
          top: p.top, left: p.left,
          borderRadius: '50%',
          background: 'rgba(139,148,255,0.7)',
          animation: `particle-float ${p.dur} ease-in-out ${p.delay} infinite`,
          boxShadow: '0 0 8px 2px rgba(129,140,248,0.5)',
        }} />
      ))}

      {/* ── Top vignette fade ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 200,
        background: 'linear-gradient(180deg, rgba(15,15,26,0.6) 0%, transparent 100%)',
      }} />

      {/* ── Bottom vignette fade ──────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
        background: 'linear-gradient(0deg, rgba(15,15,26,0.5) 0%, transparent 100%)',
      }} />

    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', position: 'relative' }}>
      {/* Animated background — sits behind everything */}
      <BackgroundFX />

      {/* All real content sits above (z-index 1+) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/run"     element={<RunAgent />} />
          </Routes>
        </main>
      </div>

      {/* Global floating GLM status — visible on ALL pages */}
      <GlmIndicator />
    </div>
  )
}
