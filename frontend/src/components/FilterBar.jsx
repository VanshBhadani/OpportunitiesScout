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
    <div className="mb-6">
      <div className="type-mono mb-2">// FILTERS</div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="filter-search"
            type="text"
            placeholder="Search title or company…"
            value={filters.search || ''}
            onChange={(e) => set('search', e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Platform */}
        <select
          id="filter-platform"
          value={filters.platform || ''}
          onChange={(e) => set('platform', e.target.value)}
          className="input w-44"
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

        {/* Eligible only */}
        <button
          type="button"
          onClick={() => set('eligible', !filters.eligible)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${
            filters.eligible
              ? 'bg-accent-soft border-accent text-accent'
              : 'bg-surface border-border-strong text-ink2 hover:bg-surface2'
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              filters.eligible ? 'bg-accent border-accent' : 'border-muted bg-transparent'
            }`}
          >
            {filters.eligible && <Check size={10} className="text-on-accent" />}
          </span>
          Eligible only
        </button>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted" />
          <select
            id="filter-sort"
            value={filters.sort || 'rank'}
            onChange={(e) => set('sort', e.target.value)}
            className="input w-40"
          >
            <option value="rank">Best Match</option>
            <option value="deadline">Deadline</option>
            <option value="scraped">Newest</option>
          </select>
        </div>
      </div>
    </div>
  )
}
