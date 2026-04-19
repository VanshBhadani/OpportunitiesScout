// ────────────────────────────────────────────────────────────────
// components/OpportunityCard.jsx — Individual opportunity card
// Shows title, company, platform badge, deadline, stipend,
// eligibility score bar, rank, Apply + AI Tailor buttons
// ────────────────────────────────────────────────────────────────

import { ExternalLink, Clock, DollarSign, Trophy, Trash2, Sparkles } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { deleteOpportunity } from '../api'
import toast from 'react-hot-toast'

function EligibilityBar({ score }) {
  const pct = Math.round((score || 0) * 100)
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">Match score</span>
        <span className="text-xs font-semibold text-slate-300">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function OpportunityCard({ opp, onDeleted, onTailor }) {
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
    <div className="card flex flex-col gap-2 animate-slide-up group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge type="platform" value={opp.platform} />
            {opp.rank && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Trophy size={10} /> #{opp.rank}
              </span>
            )}
            {opp.is_eligible && (
              <span className="badge bg-green-500/15 text-green-400 border border-green-500/30">
                ✓ Eligible
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-semibold text-slate-100 text-sm leading-snug line-clamp-2">
            {opp.title}
          </h3>
          {opp.company && (
            <p className="text-xs text-slate-500 mt-0.5">{opp.company}</p>
          )}
        </div>
        <button
          id={`delete-opp-${opp.id}`}
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {deadline && (
          <span className={`flex items-center gap-1 ${isUrgent ? 'text-orange-400 font-medium' : ''}`}>
            <Clock size={11} />
            {isUrgent ? '🔥 ' : ''}{deadline}
          </span>
        )}
        {opp.stipend && (
          <span className="flex items-center gap-1">
            <DollarSign size={11} />
            {opp.stipend}
          </span>
        )}
        {opp.location && (
          <span className="truncate max-w-28">{opp.location}</span>
        )}
      </div>

      {/* Tags */}
      {opp.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {opp.tags.slice(0, 4).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Eligibility bar */}
      <EligibilityBar score={opp.eligibility_score} />

      {/* Reason */}
      {opp.eligibility_reason && (
        <p className="text-xs text-slate-500 italic line-clamp-2 mt-0.5">
          "{opp.eligibility_reason}"
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-auto pt-1">
        {/* AI Tailor */}
        <button
          id={`tailor-opp-${opp.id}`}
          onClick={() => onTailor?.(opp)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
            bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 hover:border-brand-500/50
            text-brand-300 hover:text-brand-200 text-xs font-medium transition-all"
        >
          <Sparkles size={11} /> Tailor
        </button>

        {/* Apply */}
        <a
          id={`apply-opp-${opp.id}`}
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 btn-primary justify-center text-xs py-2"
        >
          Apply <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}


