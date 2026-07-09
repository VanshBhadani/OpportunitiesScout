// ────────────────────────────────────────────────────────────────
// pages/Dashboard.jsx — Main opportunity discovery view
// Preserves: filters, pagination, selected opp, clear-all, TailorPanel.
// New visual: light canvas, brutalist cards, spatial layout.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { getOpportunities, deleteAllOpportunities } from '../api'
import OpportunityCard from '../components/OpportunityCard'
import FilterBar from '../components/FilterBar'
import TailorPanel from '../components/TailorPanel'
import { Inbox, Loader2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-surface2 flex items-center justify-center mb-4 border border-border-strong">
        <Inbox size={28} className="text-muted" />
      </div>
      <h3 className="type-h2 text-ink mb-1">No opportunities found</h3>
      <p className="text-sm text-muted max-w-xs">
        Run the agent to discover opportunities, or adjust your filters.
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    platform: '',
    eligible: undefined,
    sort: 'rank',
  })
  const [selectedOpp, setSelectedOpp] = useState(null)

  const fetchOpps = useCallback(
    async (newPage = 0, currentFilters = filters) => {
      setLoading(true)
      setError(null)
      try {
        const params = {
          limit: PAGE_SIZE,
          offset: newPage * PAGE_SIZE,
        }
        if (currentFilters.search) params.search = currentFilters.search
        if (currentFilters.platform) params.platform = currentFilters.platform
        if (currentFilters.eligible) params.eligible = true

        const data = await getOpportunities(params)
        setOpps(data)
        setHasMore(data.length === PAGE_SIZE)
        setPage(newPage)
      } catch {
        setError('Failed to load opportunities. Make sure the backend is running.')
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchOpps(0, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  function handleFilterChange(newFilters) {
    setFilters(newFilters)
    setPage(0)
  }

  function handleDeleted(id) {
    setOpps((prev) => prev.filter((o) => o.id !== id))
  }

  async function handleClearAll() {
    if (!window.confirm('Delete all opportunities? This cannot be undone.')) return
    try {
      const res = await deleteAllOpportunities()
      toast.success(res.message || 'All opportunities cleared')
      setOpps([])
      setHasMore(false)
    } catch {
      toast.error('Failed to clear opportunities')
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="type-h1 text-ink">Opportunities</h1>
          <p className="text-sm text-muted mt-1">
            AI-matched internships, competitions &amp; hackathons — ranked for you.
          </p>
        </div>
        {opps.length > 0 && (
          <button
            id="clear-all-opportunities"
            onClick={handleClearAll}
            className="btn btn-ghost self-start"
          >
            <Trash2 size={13} /> Clear All
          </button>
        )}
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="card text-center py-10">
          <p className="text-danger text-sm">{error}</p>
          <button className="btn btn-secondary mt-4 mx-auto" onClick={() => fetchOpps(page)}>
            Retry
          </button>
        </div>
      ) : opps.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            {opps.map((opp, i) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                onDeleted={handleDeleted}
                onTailor={setSelectedOpp}
                enterDelay={`${Math.min(i, 7) * 40}ms`}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              id="pagination-prev"
              onClick={() => fetchOpps(page - 1)}
              disabled={page === 0}
              className="btn btn-secondary"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-sm text-muted font-mono">Page {page + 1}</span>
            <button
              id="pagination-next"
              onClick={() => fetchOpps(page + 1)}
              disabled={!hasMore}
              className="btn btn-secondary"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      <TailorPanel opp={selectedOpp} onClose={() => setSelectedOpp(null)} />
    </div>
  )
}
