// ────────────────────────────────────────────────────────────────
// components/FilterBar.jsx — Search + filter controls for Dashboard
// Emits filter state changes via onChange callback.
// ────────────────────────────────────────────────────────────────

import { Search, SlidersHorizontal, Check } from 'lucide-react'

export default function FilterBar({ filters, onChange }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="sticky top-8 flex flex-col gap-6">
      <div>
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="filter-search"
              type="text"
              placeholder="Search..."
              value={filters.search || ''}
              onChange={(e) => set('search', e.target.value)}
              className="input w-full"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-platform" className="text-xs font-semibold text-muted uppercase tracking-wider">Platform</label>
            <select
              id="filter-platform"
              value={filters.platform || ''}
              onChange={(e) => set('platform', e.target.value)}
              className="input w-full"
            >
              <option value="">All Platforms</option>
              <optgroup label="Original">
                <option value="internshala">Internshala</option>
                <option value="unstop">Unstop</option>
                <option value="devpost">Devpost</option>
              </optgroup>
              <optgroup label="ATS Networks">
                <option value="greenhouse">Greenhouse (24 cos.)</option>
                <option value="lever">Lever (18 cos.)</option>
              </optgroup>
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1.5">
             <label htmlFor="filter-sort" className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
               <SlidersHorizontal size={12} /> Sort By
             </label>
            <select
              id="filter-sort"
              value={filters.sort || 'rank'}
              onChange={(e) => set('sort', e.target.value)}
              className="input w-full"
            >
              <option value="rank">Best Match</option>
              <option value="deadline">Deadline</option>
              <option value="scraped">Newest</option>
            </select>
          </div>

          {/* Eligible only */}
          <button
            type="button"
            onClick={() => set('eligible', !filters.eligible)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors mt-2 ${
              filters.eligible
                ? 'bg-accent-soft border-accent text-accent'
                : 'bg-surface border-border-strong text-ink2 hover:bg-surface2'
            }`}
          >
            <span
              className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${
                filters.eligible ? 'bg-accent border-accent' : 'border-muted bg-transparent'
              }`}
            >
              {filters.eligible && <Check size={12} className="text-on-accent" />}
            </span>
            Eligible only
          </button>
        </div>
      </div>
    </div>
  )
}
