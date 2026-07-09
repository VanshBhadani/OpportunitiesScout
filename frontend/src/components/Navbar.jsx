// ────────────────────────────────────────────────────────────────
// components/Navbar.jsx — Sidebar navigation (desktop) + bottom
// nav (mobile). Includes Quick Run trigger.
// ────────────────────────────────────────────────────────────────

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Zap, LayoutDashboard, User, Play, Loader2 } from 'lucide-react'
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
      navigate('/run')
      toast('Agent started! Watching live…', { icon: '⚡' })
    } catch {
      toast.error('Could not start agent — is the backend running?')
    } finally {
      setRunning(false)
    }
  }

  const linkBase =
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors'

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[260px] z-[10] flex-col bg-dark text-on-dark border-r border-white/10 backdrop-blur-xl">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-sm">
              <Zap size={18} className="text-on-accent" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-on-dark">
              OpportunityScout
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`${linkBase} ${
                pathname === to
                  ? 'bg-accent/10 text-accent'
                  : 'text-on-dark-muted hover:text-on-dark hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            id="navbar-quick-run"
            onClick={handleQuickRun}
            disabled={running}
            className="btn btn-primary w-full"
          >
            {running ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            {running ? 'Running…' : 'Quick Run'}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 z-[10] bg-white/85 backdrop-blur-xl border-t border-border flex items-center justify-around px-2">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              pathname === to
                ? 'text-accent'
                : 'text-muted hover:text-ink2'
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}

        <button
          id="navbar-quick-run"
          onClick={handleQuickRun}
          disabled={running}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs font-semibold text-accent disabled:opacity-50"
        >
          {running ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Zap size={18} />
          )}
          <span>{running ? 'Running…' : 'Run'}</span>
        </button>
      </nav>
    </>
  )
}
