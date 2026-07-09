// ────────────────────────────────────────────────────────────────
// App.jsx — Root component with split-workspace shell
// Dark sidebar + light content area. Splash + GLM indicator.
// ────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RunAgent from './pages/RunAgent'
import GlmIndicator from './components/GlmIndicator'
import SplashScreen from './components/SplashScreen'

function AppInner() {
  const [showSplash, setShowSplash] = useState(true)
  const navigate = useNavigate()

  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-background text-ink font-sans">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}

      <div
        className={`relative z-[1] transition-opacity duration-300 ease-out ${
          showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <Navbar />
        <main className="md:pl-[260px] pb-20 md:pb-0 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/"        element={<Dashboard />} />
              <Route path="/profile" element={<Profile />}   />
              <Route path="/run"     element={<RunAgent />}  />
            </Routes>
          </div>
        </main>
      </div>

      {!showSplash && <GlmIndicator />}
    </div>
  )
}

export default function App() {
  return <AppInner />
}
