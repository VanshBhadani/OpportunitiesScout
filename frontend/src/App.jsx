// ────────────────────────────────────────────────────────────────
// App.jsx — Root component with split-workspace shell
// Dark sidebar + light content area. Splash screen.
// ────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RunAgent from './pages/RunAgent'
import SplashScreen from './components/SplashScreen'

function AppInner() {
  const [showSplash, setShowSplash] = useState(true)
  const navigate = useNavigate()

  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <div 
      className="min-h-screen text-ink font-sans bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: `url('/gradient-21st.png')` }}
    >
      <AnimatePresence>
        {showSplash && <SplashScreen onDone={handleSplashDone} key="splash" />}
      </AnimatePresence>

      <div className="relative z-[1]">
        <Navbar />
        <main id="main-content" className="min-h-screen pb-36">
          <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 py-8">
            <Routes>
              <Route path="/"        element={<Dashboard showSplash={showSplash} />} />
              <Route path="/profile" element={<Profile />}   />
              <Route path="/run"     element={<RunAgent />}  />
            </Routes>
          </div>
        </main>
      </div>

    </div>
  )

}

export default function App() {
  return <AppInner />
}
