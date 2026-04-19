// ────────────────────────────────────────────────────────────────
// components/GlmIndicator.jsx — Global floating GLM status pill
//
// Polls /api/glm/status every second.
// When GLM is idle  → invisible (no DOM impact).
// When GLM is busy  → animates in as a fixed floating pill
//   showing what it's doing: "Eligibility check", "Resume parse",
//   "Job tailor", or "2 GLM calls" if somehow concurrent.
//
// Mounted once in App.jsx so it appears on every page.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { getGlmStatus } from '../api'
import { Sparkles } from 'lucide-react'

const LABEL_ICONS = {
  'Eligibility check': '🔍',
  'Resume parse':      '📄',
  'Job tailor':        '✂️',
}

export default function GlmIndicator() {
  const [status, setStatus] = useState({ active: false, summary: null })
  const [visible, setVisible] = useState(false)   // controls CSS show/hide
  const timerRef = useRef(null)

  useEffect(() => {
    let alive = true

    async function poll() {
      if (!alive) return
      try {
        const data = await getGlmStatus()
        if (!alive) return
        setStatus(data)

        if (data.active) {
          setVisible(true)
          // Clear any pending hide timer
          clearTimeout(timerRef.current)
        } else {
          // Keep visible for 1.5s after GLM finishes so the user sees "Done"
          // We don't show "Done" text — just let it fade out naturally
          timerRef.current = setTimeout(() => setVisible(false), 1500)
        }
      } catch {
        // Backend unreachable — just hide the indicator
        if (alive) setVisible(false)
      }
    }

    // Poll immediately, then every 1 second
    poll()
    const id = setInterval(poll, 1000)

    return () => {
      alive = false
      clearInterval(id)
      clearTimeout(timerRef.current)
    }
  }, [])

  const label = status.summary || 'GLM busy'
  const icon  = LABEL_ICONS[status.summary] || '⚡'

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 ease-out
        ${visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
    >
      {/* Outer glow ring pulses while active */}
      {status.active && (
        <div className="absolute inset-0 rounded-2xl bg-brand-500/30 animate-ping" />
      )}

      <div className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl
        border backdrop-blur-md select-none
        ${status.active
          ? 'bg-[#0d1117]/90 border-brand-500/40'
          : 'bg-[#0d1117]/80 border-white/10'
        }`}
      >
        {/* Animated icon */}
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm
          ${status.active ? 'bg-brand-500/25' : 'bg-white/8'}`}
        >
          {status.active
            ? <Sparkles size={13} className="text-brand-400 animate-pulse" />
            : <span>✓</span>
          }
        </div>

        <div className="flex flex-col">
          <span className={`text-xs font-semibold leading-tight
            ${status.active ? 'text-brand-300' : 'text-slate-300'}`}
          >
            {status.active ? `${icon} ${label}` : '✓ GLM done'}
          </span>
          <span className="text-[10px] text-slate-500 leading-tight">
            {status.active ? 'GLM-4.7-Flash · busy' : 'API free'}
          </span>
        </div>

        {/* Dot indicator */}
        <div className={`w-2 h-2 rounded-full ml-1 shrink-0
          ${status.active ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
        />
      </div>
    </div>
  )
}
