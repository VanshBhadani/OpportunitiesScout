// ────────────────────────────────────────────────────────────────
// pages/Dashboard.jsx — Main opportunity discovery view
// Grid of OpportunityCards with live search, filters, pagination
// TailorPanel slides in when user clicks "✨ Tailor" on a card
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
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Inbox size={28} className="text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-1">No opportunities found</h3>
      <p className="text-sm text-slate-500 max-w-xs">
        Run the agent to scrape and discover opportunities, or adjust your filters.
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
  const [filters, setFilters] = useState({ search: '', platform: '', eligible: undefined, sort: 'rank' })
  const [selectedOpp, setSelectedOpp] = useState(null)  // drives TailorPanel

  const fetchOpps = useCallback(async (newPage = 0, currentFilters = filters) => {
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
    } catch (err) {
      setError('Failed to load opportunities. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchOpps(0, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  function handleFilterChange(newFilters) {
    setFilters(newFilters)
    setPage(0)
  }

  function handleDeleted(id) {
    setOpps(prev => prev.filter(o => o.id !== id))
  }

  async function handleClearAll() {
    if (!window.confirm(`Delete all ${opps.length > 0 ? 'opportunities' : 'opportunities'}? This cannot be undone.`)) return
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
      {/* Page heading */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Opportunities</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-matched internships, competitions &amp; hackathons — ranked just for you.
          </p>
        </div>
        {opps.length > 0 && (
          <button
            id="clear-all-opportunities"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            <Trash2 size={12} /> Clear All
          </button>
        )}
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      ) : error ? (
        <div className="card text-center py-10">
          <p className="text-red-400 text-sm">{error}</p>
          <button className="btn-ghost mt-4 mx-auto" onClick={() => fetchOpps(page)}>
            Retry
          </button>
        </div>
      ) : opps.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {opps.map(opp => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                onDeleted={handleDeleted}
                onTailor={setSelectedOpp}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              id="pagination-prev"
              onClick={() => fetchOpps(page - 1)}
              disabled={page === 0}
              className="btn-ghost"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-sm text-slate-500">Page {page + 1}</span>
            <button
              id="pagination-next"
              onClick={() => fetchOpps(page + 1)}
              disabled={!hasMore}
              className="btn-ghost"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      {/* AI Tailor Panel — slides in over the page */}
      <TailorPanel
        opp={selectedOpp}
        onClose={() => setSelectedOpp(null)}
      />
    </div>
  )
}
