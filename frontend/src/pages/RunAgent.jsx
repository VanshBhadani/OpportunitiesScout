// ────────────────────────────────────────────────────────────────
// pages/RunAgent.jsx — Agent trigger + live status polling + log history
// Polls /api/agent/status/{id} every 2s while a run is active
// Duration ticks live every second during a run
// Refresh button reloads both history and current run
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { runAgent, getAgentStatus, getAgentLogs, sendDigest } from '../api'
import StatusBadge from '../components/StatusBadge'
import { Zap, RefreshCw, Mail, Clock, CheckCircle, XCircle, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Live ticking clock ────────────────────────────────────────────

function useLiveDuration(startedAt, finishedAt) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!startedAt) { setElapsed('—'); return }
    if (finishedAt) {
      // static once finished
      setElapsed(formatSecs(Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)))
      return
    }
    // tick every second while running
    const tick = () => {
      const secs = Math.round((Date.now() - new Date(startedAt)) / 1000)
      setElapsed(formatSecs(secs))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, finishedAt])

  return elapsed
}

function formatSecs(secs) {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

// ── Stat card ─────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, pulse }) {
  return (
    <div className="card text-center relative overflow-hidden">
      {pulse && (
        <div className="absolute inset-0 rounded-2xl animate-pulse bg-brand-500/5 pointer-events-none" />
      )}
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
        <Icon size={18} className={`text-white ${pulse && label === 'Duration' ? 'animate-spin' : ''}`} />
      </div>
      <div className="text-2xl font-bold text-slate-100">{value ?? '—'}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export default function RunAgent() {
  const [currentRun, setCurrentRun] = useState(null)
  const [logs, setLogs] = useState([])
  const [running, setRunning] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 360  // 12 minutes × 2s

  const isRunning = currentRun?.status === 'running'
  const duration = useLiveDuration(currentRun?.started_at, currentRun?.finished_at)

  // Load log history
  const loadLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const data = await getAgentLogs()
      setLogs(data)

      // If the most recent log is still "running" and we have no currentRun tracked,
      // pick it up automatically so the stats box re-appears after a page refresh
      if (data.length > 0 && data[0].status === 'running' && !currentRun) {
        setCurrentRun(data[0])
      }
    } catch { /* silently ignore */ }
    finally {
      if (showSpinner) setRefreshing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mount — load history and auto-resume any in-progress run
  useEffect(() => {
    async function init() {
      try {
        const data = await getAgentLogs()
        setLogs(data)
        if (data.length > 0 && data[0].status === 'running') {
          setCurrentRun(data[0])   // resume polling for the last run
        }
      } catch { /* ignore */ }
    }
    init()
  }, [])

  // Poll active run status every 2 seconds
  useEffect(() => {
    if (!isRunning || !currentRun?.id) return

    pollCountRef.current = 0
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(pollRef.current)
        toast.error('Polling timed out. Refresh to check status.')
        loadLogs()
        return
      }
      try {
        const data = await getAgentStatus(currentRun.id)
        setCurrentRun(data)
        if (data.status !== 'running') {
          clearInterval(pollRef.current)
          loadLogs()
          if (data.status === 'completed')
            toast.success(`Run #${data.id} completed! Found ${data.opportunities_found} opportunities.`)
          else
            toast.error(`Run #${data.id} failed.`)
        }
      } catch {
        clearInterval(pollRef.current)
      }
    }, 2000)

    return () => clearInterval(pollRef.current)
  }, [currentRun?.id, isRunning])   // only re-attach when run id changes or running state flips

  async function handleRun() {
    setRunning(true)
    try {
      const data = await runAgent()
      const stub = {
        id: data.run_log_id,
        status: 'running',
        started_at: new Date().toISOString(),
        finished_at: null,
        opportunities_found: 0,
        opportunities_eligible: 0,
      }
      setCurrentRun(stub)
      toast('Agent started! Stats update every 2 seconds.', { icon: '⚡' })
    } catch {
      toast.error('Failed to start agent — is the backend running?')
    } finally {
      setRunning(false)
    }
  }

  async function handleDigest() {
    setSendingDigest(true)
    try {
      await sendDigest()
      toast.success('Digest email sent!')
    } catch {
      toast.error('Failed to send digest — check SMTP settings')
    } finally {
      setSendingDigest(false)
    }
  }

  // Manual refresh: reload both history table AND current run stats
  async function handleRefresh() {
    setRefreshing(true)
    try {
      const [logsData] = await Promise.all([
        getAgentLogs(),
        // If a run is active, also refetch its latest stats
        currentRun?.id
          ? getAgentStatus(currentRun.id).then(setCurrentRun).catch(() => {})
          : Promise.resolve(),
      ])
      setLogs(logsData)
      toast.success('Refreshed', { duration: 1200 })
    } catch {
      toast.error('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const activeStatus = currentRun?.status
  const statusIcon =
    activeStatus === 'running'   ? <Loader2 size={18} className="animate-spin text-yellow-400" /> :
    activeStatus === 'completed' ? <CheckCircle size={18} className="text-green-400" /> :
    activeStatus === 'failed'    ? <XCircle size={18} className="text-red-400" /> : null

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
          <Zap size={18} className="text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gradient">Run Agent</h1>
          <p className="text-xs text-slate-500">Trigger the full scrape → AI check → rank pipeline</p>
        </div>
      </div>

      {/* Main trigger card */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-100">Discovery Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scrapes Internshala, Unstop &amp; Devpost · Checks eligibility via GLM-4-Flash · Ranks results
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              id="run-agent-btn"
              onClick={handleRun}
              disabled={running || isRunning}
              className="btn-primary"
            >
              {running || isRunning
                ? <><Loader2 size={14} className="animate-spin" /> Running…</>
                : <><Zap size={14} /> Run Now</>}
            </button>
            <button
              id="send-digest-btn"
              onClick={handleDigest}
              disabled={sendingDigest}
              className="btn-ghost"
            >
              {sendingDigest ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send Digest
            </button>
          </div>
        </div>

        {/* Current run status — live updating */}
        {currentRun && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              {statusIcon}
              <span className="text-sm font-medium text-slate-200">Run #{currentRun.id}</span>
              <StatusBadge type="status" value={currentRun.status} />
              {isRunning && (
                <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> polling every 2s
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Found"
                value={currentRun.opportunities_found ?? 0}
                icon={Search}
                color="bg-brand-600"
                pulse={isRunning}
              />
              <StatCard
                label="Eligible"
                value={currentRun.opportunities_eligible ?? 0}
                icon={CheckCircle}
                color="bg-green-600"
                pulse={isRunning}
              />
              <StatCard
                label="Duration"
                value={duration}
                icon={Clock}
                color="bg-purple-600"
                pulse={isRunning}
              />
            </div>
            {currentRun.error_message && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {currentRun.error_message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log history */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">Run History</h2>
          <button
            id="refresh-logs-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-ghost text-xs py-1"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No runs yet. Hit "Run Now" to start!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-white/5">
                  <th className="pb-2 text-left font-medium">#</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Started</th>
                  <th className="pb-2 text-left font-medium">Duration</th>
                  <th className="pb-2 text-right font-medium">Found</th>
                  <th className="pb-2 text-right font-medium">Eligible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map(log => (
                  <tr
                    key={log.id}
                    className={`hover:bg-white/2 transition-colors ${log.id === currentRun?.id && isRunning ? 'bg-brand-500/5' : ''}`}
                  >
                    <td className="py-2.5 text-slate-400">#{log.id}</td>
                    <td className="py-2.5"><StatusBadge type="status" value={log.status} /></td>
                    <td className="py-2.5 text-slate-400">
                      {new Date(log.started_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {log.finished_at
                        ? formatSecs(Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000))
                        : <span className="text-yellow-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Running</span>
                      }
                    </td>
                    <td className="py-2.5 text-right text-slate-300">{log.opportunities_found}</td>
                    <td className="py-2.5 text-right text-green-400">{log.opportunities_eligible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
