// ────────────────────────────────────────────────────────────────
// components/TailorPanel.jsx — Slide-in AI resume tailor panel
//
// Preserves: module-level cache, re-analyse, Escape close,
// getAiProvider, all 5 sections, copy buttons.
// New visual: dark glassmorphic panel with mono labels.
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { tailorOpportunity, getAiProvider } from '../api'
import {
  X, Sparkles, CheckCircle2, AlertCircle, FileText,
  Quote, Lightbulb, Loader2, Copy, Check, ExternalLink, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Module-level cache — survives React navigation
const tailorCache = new Map()

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
      className="shrink-0 p-1.5 rounded-lg text-on-dark-muted hover:text-on-dark hover:bg-white/10 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

function Section({ icon, title, variant = 'neutral', children }) {
  const palettes = {
    success: 'bg-success/10 border-success/20',
    urgent:  'bg-urgent/10 border-urgent/20',
    neutral: 'bg-white/5 border-white/10',
    tip:     'bg-accent/10 border-accent/20',
  }
  return (
    <div className={`rounded-xl border p-4 ${palettes[variant]}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="type-mono text-on-dark-muted">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[180, 130, 200, 90, 100].map((h, i) => (
        <div
          key={i}
          className="rounded-xl bg-white/5 border border-white/10"
          style={{ height: h }}
        />
      ))}
    </div>
  )
}

export default function TailorPanel({ opp, onClose }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiProvider, setAiProvider] = useState('nvidia')

  useEffect(() => {
    getAiProvider().then((d) => setAiProvider(d.provider)).catch(() => {})
  }, [])

  const providerLabel = aiProvider === 'nvidia' ? 'NVIDIA NIM' : 'GLM-4.7-Flash'

  useEffect(() => {
    if (!opp) return

    if (tailorCache.has(opp.id)) {
      setResult(tailorCache.get(opp.id))
      setError(null)
      setLoading(false)
      return
    }

    setResult(null)
    setError(null)
    setLoading(true)
    tailorOpportunity(opp.id)
      .then((data) => {
        tailorCache.set(opp.id, data)
        setResult(data)
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || 'AI analysis failed'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [opp?.id])

  function handleReanalyse() {
    if (!opp) return
    tailorCache.delete(opp.id)
    setResult(null)
    setError(null)
    setLoading(true)
    tailorOpportunity(opp.id)
      .then((data) => {
        tailorCache.set(opp.id, data)
        setResult(data)
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || 'AI analysis failed'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isOpen = Boolean(opp)

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[40] bg-dark/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[50] h-full w-full max-w-[520px] flex flex-col
          bg-dark text-on-dark border-l border-white/10 shadow-lg backdrop-blur-xl
          transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                <Sparkles size={14} className="text-accent" />
              </div>
              <span className="type-mono text-accent">AI Tailor</span>
            </div>
            {opp && (
              <>
                <h2 className="type-h3 text-on-dark line-clamp-2">{opp.title}</h2>
                <p className="text-sm text-on-dark-muted mt-0.5">
                  {opp.company} · {opp.platform}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-1">
            {result && !loading && (
              <button
                onClick={handleReanalyse}
                title={`Re-analyse with fresh ${providerLabel} call`}
                className="p-2 rounded-xl text-on-dark-muted hover:text-on-dark hover:bg-white/10 transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-on-dark-muted hover:text-on-dark hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-accent">
                <Loader2 size={15} className="animate-spin" />
                <span>Analysing with {providerLabel}…</span>
              </div>
              <Skeleton />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <AlertCircle size={32} className="text-danger" />
              <p className="text-sm text-danger">{error}</p>
              <button className="btn btn-secondary mt-2" onClick={handleReanalyse}>
                Retry
              </button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Matching skills */}
              <Section
                icon={<CheckCircle2 size={15} className="text-success" />}
                title="What you already have"
                variant="success"
              >
                {result.matching_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matching_skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-success/15 text-success text-xs font-semibold border border-success/25"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-dark-muted">
                    No direct matches found — consider highlighting transferable skills.
                  </p>
                )}
              </Section>

              {/* Missing skills */}
              <Section
                icon={<AlertCircle size={15} className="text-urgent" />}
                title="Gaps to address"
                variant="urgent"
              >
                {result.missing_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing_skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-urgent/15 text-urgent text-xs font-semibold border border-urgent/25"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-dark-muted">
                    Great — no significant gaps found!
                  </p>
                )}
                {result.missing_skills.length > 0 && (
                  <p className="text-sm text-on-dark-muted mt-2">
                    Add a project or coursework involving these to strengthen your application.
                  </p>
                )}
              </Section>

              {/* Bullet points */}
              <Section
                icon={<FileText size={15} className="text-accent" />}
                title="Resume bullet points"
                variant="neutral"
              >
                <div className="space-y-2">
                  {result.bullet_points.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-sm text-on-dark leading-relaxed">{b}</p>
                      <CopyButton text={b} />
                    </div>
                  ))}
                </div>
              </Section>

              {/* Cover letter pitch */}
              <Section
                icon={<Quote size={15} className="text-accent" />}
                title="Cover letter opener"
                variant="neutral"
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-on-dark leading-relaxed border-l-2 border-accent/30 pl-3 italic">
                    {result.pitch}
                  </p>
                  <CopyButton text={result.pitch} />
                </div>
              </Section>

              {/* Tip */}
              <Section
                icon={<Lightbulb size={15} className="text-accent" />}
                title="Pro tip"
                variant="tip"
              >
                <p className="text-sm text-on-dark leading-relaxed">{result.tip}</p>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        {opp && (
          <div className="shrink-0 px-6 py-4 border-t border-white/10">
            <a
              href={opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              Apply Now <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </>
  )
}
