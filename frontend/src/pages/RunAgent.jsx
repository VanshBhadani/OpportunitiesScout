// ────────────────────────────────────────────────────────────────
// pages/RunAgent.jsx — Agent trigger + live status polling + history
// Preserves: runAgent, status/progress/logs polling, digest, provider
// config, custom provider fields, live stats, history table.
// New visual: light canvas, terminal log, stat cards, mono labels.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  runAgent, getAgentStatus, getAgentLogs, sendDigest,
  getAiProvider, setAiProvider, getAgentProgress, deleteRunLog,
} from '../api'
import StatusBadge from '../components/StatusBadge'
import {
  Zap, RefreshCw, Mail, Clock, CheckCircle, XCircle,
  Loader2, Search, Cpu, Terminal, SlidersHorizontal, Infinity, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Backend stores datetimes as naive UTC. Append Z only if no tz info.
function parseUtc(s) {
  if (!s) return null
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

function useLiveDuration(startedAt, finishedAt) {
  const [elapsed, setElapsed] = useState('—')

  useEffect(() => {
    if (!startedAt) { setElapsed('—'); return }
    const start = parseUtc(startedAt)
    if (finishedAt) {
      const end = parseUtc(finishedAt)
      setElapsed(formatSecs(Math.round((end - start) / 1000)))
      return
    }
    const tick = () => {
      const secs = Math.round((Date.now() - start) / 1000)
      setElapsed(formatSecs(Math.max(0, secs)))
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

function StatCard({ label, value, icon: Icon, color, pulse }) {
  return (
    <div className="card text-center relative overflow-hidden">
      {pulse && (
        <div className="absolute inset-0 rounded-[14px] animate-pulse bg-accent/5 pointer-events-none" />
      )}
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
        <Icon size={20} className="text-on-accent" />
      </div>
      <div className="font-display font-bold text-3xl text-ink tabular-nums">{value ?? '—'}</div>
      <div className="type-mono text-muted mt-1">{label}</div>
    </div>
  )
}

export default function RunAgent() {
  const [currentRun, setCurrentRun]   = useState(null)
  const [logs, setLogs]               = useState([])
  const [running, setRunning]         = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [provider, setProvider]       = useState('nvidia')
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [progressLogs, setProgressLogs] = useState([])

  const [maxProcess, setMaxProcess] = useState(50)
  const [processAll, setProcessAll] = useState(false)

  const [customApiKey, setCustomApiKey]     = useState('')
  const [customBaseUrl, setCustomBaseUrl]   = useState('https://integrate.api.nvidia.com/v1')
  const [customModel, setCustomModel]       = useState('')
  const [showCustomFields, setShowCustomFields] = useState(false)

  const pollRef          = useRef(null)
  const progressPollRef  = useRef(null)
  const progressEndRef   = useRef(null)
  const pollCountRef     = useRef(0)
  const MAX_POLLS        = 360

  const isRunning = currentRun?.status === 'running'
  const duration  = useLiveDuration(currentRun?.started_at, currentRun?.finished_at)

  const loadLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const data = await getAgentLogs()
      setLogs(data)
      if (data.length > 0 && data[0].status === 'running' && !currentRun) {
        setCurrentRun(data[0])
      }
    } catch { /* silently ignore */ }
    finally {
      if (showSpinner) setRefreshing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const data = await getAgentLogs()
        setLogs(data)
        if (data.length > 0 && data[0].status === 'running') {
          setCurrentRun(data[0])
        }
      } catch { /* ignore */ }
      try {
        const p = await getAiProvider()
        setProvider(p.provider)
        setShowCustomFields(p.provider === 'custom')
      } catch { /* ignore */ }
    }
    init()
  }, [])

  useEffect(() => {
    if (!isRunning || !currentRun?.id) return

    pollCountRef.current = 0
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(pollRef.current)
        clearInterval(progressPollRef.current)
        toast.error('Polling timed out. Refresh to check status.')
        loadLogs()
        return
      }
      try {
        const data = await getAgentStatus(currentRun.id)
        setCurrentRun(data)
        if (data.status !== 'running') {
          clearInterval(pollRef.current)
          clearInterval(progressPollRef.current)
          try {
            const p = await getAgentProgress(currentRun.id)
            setProgressLogs(p.logs)
          } catch {}
          loadLogs()
          if (data.status === 'completed')
            toast.success(`Run #${data.id} completed! Found ${data.opportunities_found} opportunities.`)
          else
            toast.error(`Run #${data.id} failed.`)
        }
      } catch {
        clearInterval(pollRef.current)
        clearInterval(progressPollRef.current)
        loadLogs()
        setCurrentRun((prev) =>
          prev ? { ...prev, status: 'failed', error_message: 'Lost connection to backend — check Render logs.' } : prev
        )
      }
    }, 2000)

    progressPollRef.current = setInterval(async () => {
      try {
        const p = await getAgentProgress(currentRun.id)
        setProgressLogs(p.logs)
        progressEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } catch { /* ignore */ }
    }, 3000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(progressPollRef.current)
    }
  }, [currentRun?.id, isRunning, loadLogs])

  async function handleRun() {
    setRunning(true)
    setProgressLogs([])
    const config = { max_process: processAll ? null : maxProcess }
    try {
      const data = await runAgent(config)
      const stub = {
        id: data.run_log_id,
        status: 'running',
        started_at: new Date().toISOString(),
        finished_at: null,
        opportunities_found: 0,
        opportunities_eligible: 0,
      }
      setCurrentRun(stub)
      const batchCount = processAll ? '?' : Math.ceil(maxProcess / 10)
      toast(`Agent started! Will check ${processAll ? 'all' : maxProcess} opps in ${batchCount} sub-batches.`, { icon: '⚡' })
    } catch {
      toast.error('Failed to start agent — is the backend running?')
    } finally {
      setRunning(false)
    }
  }

  async function handleProviderSwitch(newProvider) {
    if (newProvider === provider || switchingProvider) return
    setSwitchingProvider(true)
    try {
      const payload =
        newProvider === 'custom'
          ? { provider: 'custom', custom_api_key: customApiKey, custom_base_url: customBaseUrl, custom_model: customModel }
          : { provider: newProvider }
      const data = await setAiProvider(payload)
      setProvider(data.provider)
      setShowCustomFields(data.provider === 'custom')
      const label =
        data.provider === 'nvidia' ? 'NVIDIA NIM (Default)' :
        data.provider === 'glm'    ? 'ZhipuAI GLM' :
        'Custom Provider'
      toast.success(`Switched to ${label}`)
    } catch {
      toast.error('Failed to switch provider')
    } finally {
      setSwitchingProvider(false)
    }
  }

  async function handleSaveCustom() {
    if (!customModel.trim()) { toast.error('Model name is required'); return }
    if (!customApiKey.trim()) { toast.error('API key is required'); return }
    setSwitchingProvider(true)
    try {
      const data = await setAiProvider({
        provider: 'custom',
        custom_api_key: customApiKey,
        custom_base_url: customBaseUrl,
        custom_model: customModel,
      })
      setProvider(data.provider)
      toast.success('Custom provider saved!')
    } catch {
      toast.error('Failed to save custom provider')
    } finally {
      setSwitchingProvider(false)
    }
  }

  async function handleDigest() {
    setSendingDigest(true)
    try {
      await sendDigest()
      toast.success('Digest email sent!')
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
      toast.error(`SMTP Error: ${detail}`)
    } finally {
      setSendingDigest(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const [logsData] = await Promise.all([
        getAgentLogs(),
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

  async function handleDeleteLog(logId) {
    if (!window.confirm(`Delete run #${logId} from history? This cannot be undone.`)) return
    try {
      await deleteRunLog(logId)
      setLogs((prev) => prev.filter((l) => l.id !== logId))
      if (currentRun?.id === logId) setCurrentRun(null)
      toast.success(`Run #${logId} deleted`)
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Delete failed'
      toast.error(detail)
    }
  }

  const activeStatus = currentRun?.status
  const statusIcon =
    activeStatus === 'running'   ? <Loader2 size={18} className="animate-spin text-urgent" /> :
    activeStatus === 'completed' ? <CheckCircle size={18} className="text-success" /> :
    activeStatus === 'failed'    ? <XCircle size={18} className="text-danger" /> : null

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
          <Zap size={18} className="text-accent" />
        </div>
        <div>
          <h1 className="type-h1 text-ink">Run Agent</h1>
          <p className="text-sm text-muted">Trigger the full scrape → AI check → rank pipeline</p>
        </div>
      </div>

      {/* Trigger card */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="type-h3 text-ink">Discovery Pipeline</h2>
            <p className="text-sm text-muted mt-0.5">
              Scrapes Internshala, Unstop &amp; Devpost · Checks eligibility via{' '}
              <span className={provider === 'nvidia' ? 'text-success' : 'text-ink2'}>
                {provider === 'nvidia' ? 'NVIDIA NIM (llama-3.3-70b)' : 'ZhipuAI GLM-4-Flash'}
              </span>
              {' '}· Ranks results
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              id="run-agent-btn"
              onClick={handleRun}
              disabled={running || isRunning}
              className="btn btn-primary"
            >
              {running || isRunning ? (
                <><Loader2 size={14} className="animate-spin" /> Running…</>
              ) : (
                <><Zap size={14} /> Run Now</>
              )}
            </button>
            <button
              id="send-digest-btn"
              onClick={handleDigest}
              disabled={sendingDigest}
              className="btn btn-secondary"
            >
              {sendingDigest ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send Digest
            </button>
          </div>
        </div>

        {/* Pre-run config */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={13} className="text-muted" />
            <span className="type-mono">Processing Config</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border transition-all ${
              processAll ? 'border-border bg-surface opacity-50' : 'border-border-strong bg-surface2'
            }`}>
              <div className="text-xs font-semibold text-ink2 mb-1.5">Opportunities to check</div>
              <div className="flex items-center gap-2">
                <input
                  id="max-process-input"
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={maxProcess}
                  disabled={processAll || isRunning}
                  onChange={(e) => setMaxProcess(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-20 bg-surface border border-border-strong rounded-lg px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-accent disabled:opacity-40"
                />
                <span className="text-xs text-muted">
                  → {Math.ceil(maxProcess / 10)} sub-batch{Math.ceil(maxProcess / 10) !== 1 ? 'es' : ''} of 10
                </span>
              </div>
            </div>

            <div
              onClick={() => !isRunning && setProcessAll((p) => !p)}
              className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                processAll
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-strong bg-surface2 hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  processAll ? 'border-accent bg-accent' : 'border-muted'
                }`}>
                  {processAll && <CheckCircle size={10} className="text-on-accent" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1">
                    <Infinity size={11} className="text-accent" /> Process All
                  </div>
                  <div className="text-xs text-muted">All unscored opps, sub-batches of 10</div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            {processAll
              ? 'Will check every unscored opportunity found (may take longer).'
              : `Will check up to ${maxProcess} opportunities in ${Math.ceil(maxProcess / 10)} × 10 sub-batches.`
            }
          </p>
        </div>

        {/* AI Provider */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={13} className="text-muted" />
            <span className="type-mono">AI Provider</span>
          </div>

          <div className="flex rounded-xl overflow-hidden border border-border-strong mb-3">
            {[
              { id: 'nvidia', label: 'Default (NVIDIA NIM)', desc: 'Built-in API key' },
              { id: 'glm',    label: 'ZhipuAI GLM',          desc: 'Uses ZHIPUAI_API_KEY' },
              { id: 'custom', label: 'Custom',               desc: 'Your own key + model' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === 'custom') { setShowCustomFields(true); if (provider !== 'custom') return }
                  handleProviderSwitch(opt.id)
                }}
                disabled={switchingProvider}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                  provider === opt.id
                    ? 'bg-surface2 text-accent'
                    : 'text-muted hover:text-ink hover:bg-surface2/50'
                }`}
              >
                {switchingProvider && provider !== opt.id ? (
                  <Loader2 size={10} className="animate-spin inline mr-1" />
                ) : null}
                {opt.label}
              </button>
            ))}
          </div>

          {provider !== 'custom' ? (
            <p className="text-xs text-muted">
              {provider === 'nvidia'
                ? 'meta/llama-3.3-70b-instruct via NVIDIA NIM (default key).'
                : 'glm-4.7-flash via ZhipuAI Z.AI.'}
            </p>
          ) : (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-accent font-semibold">
                Custom provider settings are saved and used for all AI calls until you switch back.
              </p>
              <div>
                <label className="text-xs text-muted block mb-1">API Key *</label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Base URL *</label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://integrate.api.nvidia.com/v1"
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Model Name *</label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. meta/llama-3.1-70b-instruct"
                  className="input"
                />
              </div>
              <button
                onClick={handleSaveCustom}
                disabled={switchingProvider}
                className="btn btn-primary w-full"
              >
                {switchingProvider ? <Loader2 size={12} className="animate-spin" /> : null}
                Save &amp; Use Custom Provider
              </button>
            </div>
          )}
        </div>

        {/* Live run */}
        {currentRun && (
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              {statusIcon}
              <span className="type-h3 text-ink">Run #{currentRun.id}</span>
              <StatusBadge type="status" value={currentRun.status} />
              {isRunning && (
                <span className="ml-auto text-xs text-muted flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> polling every 2s
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Found"    value={currentRun.opportunities_found ?? 0}    icon={Search}     color="bg-accent"     pulse={isRunning} />
              <StatCard label="Eligible" value={currentRun.opportunities_eligible ?? 0} icon={CheckCircle} color="bg-success"    pulse={isRunning} />
              <StatCard label="Duration" value={duration}                                icon={Clock}      color="bg-ink2"       pulse={isRunning} />
            </div>

            {currentRun.error_message && (
              <div className="mt-3 p-3 rounded-xl bg-danger-soft border border-danger/20 text-sm text-danger">
                {currentRun.error_message}
              </div>
            )}

            {progressLogs.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={12} className="text-muted" />
                  <span className="type-mono">Live Progress</span>
                </div>
                <div className="bg-dark-surface rounded-xl p-3 max-h-48 overflow-y-auto font-mono space-y-1.5 border border-white/10">
                  {progressLogs.map((entry, i) => (
                    <div
                      key={i}
                      className={`text-xs flex gap-2 ${
                        entry.stage === 'error' ? 'text-danger' :
                        entry.stage === 'done'  ? 'text-success' :
                        'text-on-dark'
                      }`}
                    >
                      <span className="text-on-dark-muted flex-shrink-0 tabular-nums">
                        {entry.ts ? new Date(entry.ts + 'Z').toLocaleTimeString('en-IN', { timeStyle: 'short' }) : ''}
                      </span>
                      <span>{entry.message}</span>
                    </div>
                  ))}
                  {isRunning && (
                    <div className="text-xs text-accent flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> running...
                    </div>
                  )}
                  <div ref={progressEndRef} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="type-h3 text-ink">Run History</h2>
          <button
            id="refresh-logs-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost text-xs py-1"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No runs yet. Hit "Run Now" to start!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="pb-2 text-left font-semibold">#</th>
                  <th className="pb-2 text-left font-semibold">Status</th>
                  <th className="pb-2 text-left font-semibold">Started</th>
                  <th className="pb-2 text-left font-semibold">Duration</th>
                  <th className="pb-2 text-right font-semibold">Found</th>
                  <th className="pb-2 text-right font-semibold">Eligible</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-surface2/50 transition-colors ${
                      log.id === currentRun?.id && isRunning ? 'bg-accent-soft/50' : ''
                    }`}
                  >
                    <td className="py-2.5 text-muted font-mono">#{log.id}</td>
                    <td className="py-2.5"><StatusBadge type="status" value={log.status} /></td>
                    <td className="py-2.5 text-muted">
                      {parseUtc(log.started_at)?.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 text-muted">
                      {log.finished_at
                        ? formatSecs(Math.round((parseUtc(log.finished_at) - parseUtc(log.started_at)) / 1000))
                        : <span className="text-urgent flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Running</span>
                      }
                    </td>
                    <td className="py-2.5 text-right text-ink font-semibold">{log.opportunities_found}</td>
                    <td className="py-2.5 text-right text-success font-semibold">{log.opportunities_eligible}</td>
                    <td className="py-2.5 text-right">
                      {log.status !== 'running' && (
                        <button
                          id={`delete-log-${log.id}`}
                          onClick={() => handleDeleteLog(log.id)}
                          title={`Delete run #${log.id}`}
                          className="p-1 rounded-lg text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
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
