// ────────────────────────────────────────────────────────────────
// components/FilterBar.jsx — Search + filter controls for Dashboard
// Emits filter state changes via onChange callback
// ────────────────────────────────────────────────────────────────

import { Search, SlidersHorizontal } from 'lucide-react'

export default function FilterBar({ filters, onChange }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          id="filter-search"
          type="text"
          placeholder="Search title or company…"
          value={filters.search || ''}
          onChange={e => set('search', e.target.value)}
          className="input pl-8"
        />
      </div>

      {/* Platform */}
      <select
        id="filter-platform"
        value={filters.platform || ''}
        onChange={e => set('platform', e.target.value)}
        className="input w-44"
      >
        <option value="">All Platforms</option>

        <optgroup label="── Original ──">
          <option value="internshala">Internshala</option>
          <option value="unstop">Unstop</option>
          <option value="devpost">Devpost</option>
        </optgroup>

        <optgroup label="── ATS Networks ──">
          <option value="greenhouse">Greenhouse (24 cos.)</option>
          <option value="lever">Lever (18 cos.)</option>
        </optgroup>

        <optgroup label="── Big Tech ──">
          <option value="google">Google</option>
          <option value="microsoft">Microsoft</option>
          <option value="amazon">Amazon</option>
        </optgroup>
      </select>

      {/* Eligible only */}
      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
        <input
          id="filter-eligible"
          type="checkbox"
          checked={!!filters.eligible}
          onChange={e => set('eligible', e.target.checked ? true : undefined)}
          className="w-4 h-4 rounded accent-brand-500"
        />
        Eligible only
      </label>

      {/* Sort */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <SlidersHorizontal size={14} />
        <select
          id="filter-sort"
          value={filters.sort || 'rank'}
          onChange={e => set('sort', e.target.value)}
          className="input w-36"
        >
          <option value="rank">Sort: Best Match</option>
          <option value="deadline">Sort: Deadline</option>
          <option value="scraped">Sort: Newest</option>
        </select>
      </div>
    </div>
  )
}
