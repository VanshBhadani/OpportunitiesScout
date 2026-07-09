// ────────────────────────────────────────────────────────────────
// components/StatusBadge.jsx — Coloured pill badge for platform
// and run-status labels throughout the UI
// ────────────────────────────────────────────────────────────────

const PLATFORM_STYLES = {
  internshala: 'bg-accent-soft text-accent border-accent/20',
  unstop:      'bg-urgent-soft text-urgent border-urgent/20',
  devpost:     'bg-success-soft text-success border-success/20',
}

const STATUS_STYLES = {
  running:   'bg-urgent-soft text-urgent border-urgent/20',
  completed: 'bg-success-soft text-success border-success/20',
  failed:    'bg-danger-soft text-danger border-danger/20',
}

export default function StatusBadge({ type = 'platform', value = '' }) {
  const styles =
    type === 'platform'
      ? PLATFORM_STYLES[value] || 'bg-surface2 text-ink2 border-border-strong'
      : STATUS_STYLES[value] || 'bg-surface2 text-ink2 border-border-strong'

  return (
    <span className={`badge ${styles}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  )
}
