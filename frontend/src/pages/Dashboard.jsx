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
import { motion } from 'framer-motion'

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

function RightSidebarWidgets({ opps }) {
  const eligibleCount = opps.filter((o) => o.is_eligible).length
  const totalCount = opps.length

  // Find upcoming deadlines
  const upcoming = opps
    .filter((o) => o.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4)

  return (
    <div className="sticky top-8 flex flex-col gap-6">
      {/* Quick Stats */}
      <div className="card p-5 border-border-strong bg-surface/50">
        <h4 className="type-mono mb-4 text-muted">// QUICK STATS</h4>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-ink2">Loaded Matches</span>
          <span className="text-sm font-bold text-ink">{totalCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-ink2">Eligible Matches</span>
          <span className="text-sm font-bold text-success bg-success-soft px-2 py-0.5 rounded-md border border-success/20">{eligibleCount}</span>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      {upcoming.length > 0 && (
        <div className="card p-5 border-border-strong bg-surface/50">
          <h4 className="type-mono mb-4 text-muted">// UPCOMING DEADLINES</h4>
          <div className="flex flex-col gap-3">
            {upcoming.map(opp => {
              const date = new Date(opp.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              const isUrgent = (new Date(opp.deadline) - Date.now()) / 86400000 < 7
              return (
                <div key={opp.id} className="flex flex-col gap-1 pb-3 border-b border-border-strong last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-xs font-semibold text-ink leading-relaxed line-clamp-2">{opp.title}</span>
                    <span className={`text-[11px] font-mono shrink-0 mt-0.5 ${isUrgent ? 'text-urgent' : 'text-muted'}`}>{date}</span>
                  </div>
                  {opp.company && <span className="text-[11px] text-muted">{opp.company}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ showSplash }) {
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="relative h-[32px] sm:h-[40px] flex items-center">
          {showSplash ? (
            <h1 className="type-h1 text-transparent select-none pointer-events-none drop-shadow-none">Opportunity Scout</h1>
          ) : (
            <motion.h1 
              layoutId="main-logo" 
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="type-h1 text-ink origin-left whitespace-nowrap absolute left-0"
            >
              Opportunity Scout
            </motion.h1>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-8">
        {/* Left Sidebar - Filters */}
        <aside className="hidden lg:block">
          <FilterBar filters={filters} onChange={handleFilterChange} />
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0">
          {/* Mobile Filter Bar */}
          <div className="block lg:hidden mb-6">
            <FilterBar filters={filters} onChange={handleFilterChange} />
          </div>

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
        </section>

        {/* Right Sidebar - Contextual Widgets */}
        <aside className="hidden lg:block">
          <RightSidebarWidgets opps={opps} />
        </aside>
      </div>

      <TailorPanel opp={selectedOpp} onClose={() => setSelectedOpp(null)} />
    </div>
  )
}
