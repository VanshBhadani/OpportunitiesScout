// ────────────────────────────────────────────────────────────────
// components/GlmIndicator.jsx — Global floating GLM status pill
//
// Polls /api/glm/status every second while active, 10s while idle.
// Idle → no DOM output. Active → light glassmorphic pill with pulsing dot.
// Preserves all polling, backoff, and aria-live behaviour.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { getGlmStatus, getAiProvider } from '../api'
import { Sparkles, FileText, Search, Scissors } from 'lucide-react'

const LABEL_ICONS = {
  'Eligibility check': Search,
  'Resume parse':      FileText,
  'Job tailor':        Scissors,
}

export default function GlmIndicator() {
  const [status, setStatus] = useState({ active: false, summary: null })
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const pollRef  = useRef(null)
  const failsRef = useRef(0)

  useEffect(() => {
    getAiProvider().catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true

    async function poll() {
      if (!alive) return
      try {
        const data = await getGlmStatus()
        if (!alive) return

        failsRef.current = 0
        setStatus(data)

        if (data.active) {
          setVisible(true)
          clearTimeout(timerRef.current)
          pollRef.current = setTimeout(poll, 1000)
        } else {
          timerRef.current = setTimeout(() => setVisible(false), 1500)
          pollRef.current = setTimeout(poll, 10_000)
        }
      } catch {
        if (!alive) return
        setVisible(false)
        failsRef.current += 1

        const delay =
          failsRef.current >= 3 ? 30_000 : failsRef.current === 2 ? 5_000 : 2_000

        pollRef.current = setTimeout(poll, delay)
      }
    }

    poll()

    return () => {
      alive = false
      clearTimeout(pollRef.current)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible) return null

  const Icon = LABEL_ICONS[status.summary] || Sparkles

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] transition-all duration-300 ease-out"
    >
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border backdrop-blur-md shadow-lg ${
          status.active
            ? 'bg-accent-soft border-accent/20 text-accent'
            : 'bg-surface/90 border-border-strong text-ink2'
        }`}
      >
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center ${
            status.active ? 'bg-accent/15' : 'bg-surface2'
          }`}
        >
          <Icon size={13} className={status.active ? 'animate-pulse-soft' : ''} />
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight">
            {status.active ? `AI busy · ${status.summary || 'working'}` : 'AI idle'}
          </span>
          <span className="text-[10px] opacity-70 leading-tight">
            {status.active ? 'OpportunityScout' : 'Waiting for next task'}
          </span>
        </div>

        {status.active && (
          <span className="ml-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
        )}
      </div>
    </div>
  )
}
