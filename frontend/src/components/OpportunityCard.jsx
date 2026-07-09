// ────────────────────────────────────────────────────────────────
// components/OpportunityCard.jsx — Brutalist opportunity card
// Bold match score, prominent reasoning, hard borders, mono labels.
// Preserves every data field and action from the original.
// ────────────────────────────────────────────────────────────────

import { ExternalLink, Clock, DollarSign, MapPin, Trash2, Sparkles } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { deleteOpportunity } from '../api'
import toast from 'react-hot-toast'

function MatchScore({ score }) {
  const pct = Math.round((score || 0) * 100)
  const colorVar = pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--urgent)' : 'var(--muted)'
  const r = 20
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={r}
            stroke="var(--border-strong)"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r={r}
            stroke={colorVar}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-[11px] text-ink">
          {pct}
        </span>
      </div>
      <div className="min-w-0">
        <div className="type-mono text-muted">Match Score</div>
        <div className="font-display font-bold text-[1.75rem] leading-none text-ink">
          {pct}%
        </div>
      </div>
    </div>
  )
}

export default function OpportunityCard({ opp, onDeleted, onTailor, enterDelay }) {
  const deadline = opp.deadline
    ? new Date(opp.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  const isUrgent =
    opp.deadline && (new Date(opp.deadline) - Date.now()) / 86400000 < 7

  async function handleDelete() {
    try {
      await deleteOpportunity(opp.id)
      toast.success('Opportunity removed')
      onDeleted?.(opp.id)
    } catch {
      toast.error('Could not delete')
    }
  }

  return (
    <article
      className="card flex flex-col gap-4 animate-slide-up group"
      style={enterDelay ? { animationDelay: enterDelay } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge type="platform" value={opp.platform} />
            {opp.rank && (
              <span className="badge bg-surface2 text-ink2 border-border">
                #{opp.rank}
              </span>
            )}
            {opp.is_eligible && (
              <span className="badge bg-success-soft text-success border-success/20">
                Eligible
              </span>
            )}
          </div>
          <h3 className="type-h3 text-ink line-clamp-2">{opp.title}</h3>
          {opp.company && (
            <p className="text-sm text-muted mt-0.5">{opp.company}</p>
          )}
        </div>
        <button
          id={`delete-opp-${opp.id}`}
          onClick={handleDelete}
          className="shrink-0 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Delete opportunity"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Reasoning — primary product value */}
      {opp.eligibility_reason && (
        <p className="text-sm font-medium text-ink2 leading-relaxed line-clamp-2">
          {opp.eligibility_reason}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        {deadline && (
          <span
            className={`flex items-center gap-1 ${
              isUrgent ? 'text-urgent font-semibold' : ''
            }`}
          >
            <Clock size={12} />
            {isUrgent && <span className="type-mono">DUE SOON</span>}
            {deadline}
          </span>
        )}
        {opp.stipend && (
          <span className="flex items-center gap-1">
            <DollarSign size={12} />
            {opp.stipend}
          </span>
        )}
        {opp.location && (
          <span className="flex items-center gap-1 truncate max-w-[10rem]">
            <MapPin size={12} />
            {opp.location}
          </span>
        )}
      </div>

      {/* Score + tags */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <MatchScore score={opp.eligibility_score} />
        {opp.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {opp.tags.slice(0, 4).map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-surface2 text-ink2 text-[11px] font-medium border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          id={`tailor-opp-${opp.id}`}
          onClick={() => onTailor?.(opp)}
          className="btn btn-secondary flex-1"
        >
          <Sparkles size={13} /> Tailor
        </button>
        <a
          id={`apply-opp-${opp.id}`}
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary flex-1"
        >
          Apply <ExternalLink size={13} />
        </a>
      </div>
    </article>
  )
}
