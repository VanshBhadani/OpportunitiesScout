// ────────────────────────────────────────────────────────────────
// components/TailorPanel.jsx — Slide-in AI resume tailor panel
//
// Props:
//   opp      — the opportunity object (or null to close)
//   onClose  — callback to close the panel
//
// Behaviour:
//   • Slides in from the right over a dark backdrop
//   • Immediately calls /api/opportunities/{id}/tailor on open
//   • Shows a loading skeleton while GLM thinks
//   • Renders 5 sections: matching skills, missing skills,
//     bullet points, pitch, and tip
//   • One-click copy for pitch + each bullet
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { tailorOpportunity } from '../api'
import {
  X, Sparkles, CheckCircle2, AlertCircle, FileText,
  Quote, Lightbulb, Loader2, Copy, Check, ExternalLink, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Module-level cache — survives React navigation (unmount/remount) ────
// Lives for the entire browser tab session; cleared only on page reload.
const tailorCache = new Map()   // Map<oppId, resultObject>

// ── Copy button micro-animation ───────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 p-1 rounded-md hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}

// ── Section wrapper ────────────────────────────────────────────────

function Section({ icon, title, color, children }) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[180, 130, 200, 90, 100].map((h, i) => (
        <div key={i} className="rounded-2xl bg-white/5 border border-white/8" style={{ height: h }} />
      ))}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────

export default function TailorPanel({ opp, onClose }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch analysis whenever a NEW opportunity is selected
  useEffect(() => {
    if (!opp) return

    // ── Cache hit: show immediately, no GLM call ──────────────────
    if (tailorCache.has(opp.id)) {
      setResult(tailorCache.get(opp.id))
      setError(null)
      setLoading(false)
      return
    }

    // ── Cache miss: fetch from backend ────────────────────────────
    setResult(null)
    setError(null)
    setLoading(true)
    tailorOpportunity(opp.id)
      .then(data => {
        tailorCache.set(opp.id, data)   // store in module-level cache
        setResult(data)
      })
      .catch(err => {
        const msg = err?.response?.data?.detail || 'AI analysis failed'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [opp?.id])   // re-run only when the opp ID changes

  // Force a fresh call (busts cache for this opp)
  function handleReanalyse() {
    if (!opp) return
    tailorCache.delete(opp.id)
    setResult(null)
    setError(null)
    setLoading(true)
    tailorOpportunity(opp.id)
      .then(data => {
        tailorCache.set(opp.id, data)
        setResult(data)
      })
      .catch(err => {
        const msg = err?.response?.data?.detail || 'AI analysis failed'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isOpen = Boolean(opp)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg flex flex-col
          bg-[#0f1117] border-l border-white/10 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ── */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-white/8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <Sparkles size={14} className="text-brand-400" />
              </div>
              <span className="text-xs font-medium text-brand-400 uppercase tracking-wider">AI Tailor</span>
            </div>
            {opp && (
              <>
                <h2 className="text-base font-bold text-slate-100 leading-snug line-clamp-2">{opp.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {opp.company} · {opp.platform}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-1">
            {/* Re-analyse: only visible when already showing cached result */}
            {result && !loading && (
              <button
                onClick={handleReanalyse}
                title="Re-analyse with fresh GLM call"
                className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-brand-400 transition-all"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-brand-400">
                <Loader2 size={15} className="animate-spin" />
                <span>Analysing with GLM‑4.7‑Flash…</span>
              </div>
              <Skeleton />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <button className="btn-ghost text-xs mt-2" onClick={handleReanalyse}>
                Retry
              </button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* 1. Matching skills */}
              <Section
                icon={<CheckCircle2 size={15} className="text-emerald-400" />}
                title="What you already have ✓"
                color="bg-emerald-500/8 border-emerald-500/20"
              >
                {result.matching_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matching_skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium border border-emerald-500/25">
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No direct matches found — consider highlighting transferable skills.</p>
                )}
              </Section>

              {/* 2. Missing skills */}
              <Section
                icon={<AlertCircle size={15} className="text-amber-400" />}
                title="Gaps to address"
                color="bg-amber-500/8 border-amber-500/20"
              >
                {result.missing_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing_skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-medium border border-amber-500/25">
                        ✗ {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Great — no significant gaps found!</p>
                )}
                {result.missing_skills.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Add a project or coursework involving these to strengthen your application.
                  </p>
                )}
              </Section>

              {/* 3. Bullet points */}
              <Section
                icon={<FileText size={15} className="text-blue-400" />}
                title="Resume bullet points to highlight"
                color="bg-blue-500/8 border-blue-500/20"
              >
                <div className="space-y-2">
                  {result.bullet_points.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-xs text-slate-300 leading-relaxed">{b}</p>
                      <CopyButton text={b} />
                    </div>
                  ))}
                </div>
              </Section>

              {/* 4. Cover letter pitch */}
              <Section
                icon={<Quote size={15} className="text-purple-400" />}
                title="Cover letter opener"
                color="bg-purple-500/8 border-purple-500/20"
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-slate-200 italic leading-relaxed">
                    "{result.pitch}"
                  </p>
                  <CopyButton text={result.pitch} />
                </div>
              </Section>

              {/* 5. Tip */}
              <Section
                icon={<Lightbulb size={15} className="text-yellow-400" />}
                title="Pro tip"
                color="bg-yellow-500/8 border-yellow-500/20"
              >
                <p className="text-xs text-slate-300 leading-relaxed">{result.tip}</p>
              </Section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {opp && (
          <div className="shrink-0 px-6 py-4 border-t border-white/8">
            <a
              href={opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center py-2.5 text-sm"
            >
              Apply Now <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
    </>
  )
}
