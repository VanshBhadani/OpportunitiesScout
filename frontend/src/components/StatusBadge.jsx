// ────────────────────────────────────────────────────────────────
// components/StatusBadge.jsx — Coloured pill badge for platform
// and run-status labels throughout the UI
// ────────────────────────────────────────────────────────────────

const PLATFORM_STYLES = {
  internshala: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  unstop:      'bg-orange-500/15 text-orange-400 border-orange-500/30',
  devpost:     'bg-teal-500/15 text-teal-400 border-teal-500/30',
}

const STATUS_STYLES = {
  running:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
}

export default function StatusBadge({ type = 'platform', value = '' }) {
  const styles =
    type === 'platform'
      ? PLATFORM_STYLES[value] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'
      : STATUS_STYLES[value] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'

  return (
    <span className={`badge border ${styles}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  )
}
