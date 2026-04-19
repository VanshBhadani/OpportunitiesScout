// ────────────────────────────────────────────────────────────────
// components/Navbar.jsx — Top navigation bar
// Shows logo, nav links, and a quick "Run Agent" trigger button
// ────────────────────────────────────────────────────────────────

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Zap, LayoutDashboard, User, Play } from 'lucide-react'
import { useState } from 'react'
import { runAgent } from '../api'
import toast from 'react-hot-toast'

const navLinks = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile',   icon: User },
  { to: '/run',     label: 'Run Agent', icon: Play },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [running, setRunning] = useState(false)

  async function handleQuickRun() {
    if (running) return
    setRunning(true)
    try {
      await runAgent()
      // Navigate to Run Agent page so the user sees live stats
      navigate('/run')
      toast('Agent started! Watching live…', { icon: '⚡' })
    } catch {
      toast.error('Could not start agent — is the backend running?')
    } finally {
      setRunning(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5" style={{ backgroundColor: 'rgba(15,15,26,0.85)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-base text-gradient">OpportunityScout</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === to
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Quick Run button */}
          <button
            id="navbar-quick-run"
            onClick={handleQuickRun}
            disabled={running}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <Zap size={13} className={running ? 'animate-spin' : ''} />
            {running ? 'Running…' : 'Quick Run'}
          </button>
        </div>
      </div>
    </header>
  )
}
