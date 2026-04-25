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
import { getGlmStatus, getAiProvider } from '../api'
import { Sparkles } from 'lucide-react'

const LABEL_ICONS = {
  'Eligibility check': '🔍',
  'Resume parse':      '📄',
  'Job tailor':        '✂️',
}

export default function GlmIndicator() {
  const [status, setStatus] = useState({ active: false, summary: null })
  const [visible, setVisible] = useState(false)
  const [providerLabel, setProviderLabel] = useState('NVIDIA NIM')
  const timerRef    = useRef(null)
  const pollRef     = useRef(null)
  const failsRef    = useRef(0)

  // Fetch active provider label once on mount
  useEffect(() => {
    getAiProvider()
      .then(d => setProviderLabel(d.provider === 'glm' ? 'GLM-4.7-Flash' : 'NVIDIA NIM'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true

    async function poll() {
      if (!alive) return
      try {
        const data = await getGlmStatus()
        if (!alive) return

        // Success — reset failure counter & go back to 1s cadence
        failsRef.current = 0

        setStatus(data)
        if (data.active) {
          setVisible(true)
          clearTimeout(timerRef.current)
        } else {
          timerRef.current = setTimeout(() => setVisible(false), 1500)
        }

        // Schedule next poll in 1 second
        pollRef.current = setTimeout(poll, 1000)
      } catch {
        if (!alive) return
        // Backend unreachable — hide indicator
        setVisible(false)
        failsRef.current += 1

        // Backoff: 1s → 2s → 5s → 10s (cap) so Vite terminal stays quiet
        const delay = failsRef.current >= 3
          ? 10_000        // backend is clearly down — check every 10s
          : failsRef.current === 2
            ? 5_000
            : 2_000

        pollRef.current = setTimeout(poll, delay)
      }
    }

    // Start immediately
    poll()

    return () => {
      alive = false
      clearTimeout(pollRef.current)
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
            {status.active ? `${icon} ${label}` : `✓ ${providerLabel} done`}
          </span>
          <span className="text-[10px] text-slate-500 leading-tight">
            {status.active ? `${providerLabel} · busy` : 'API free'}
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
