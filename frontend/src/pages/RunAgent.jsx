// ────────────────────────────────────────────────────────────────
// pages/RunAgent.jsx — Agent trigger + live status polling + log history
// Polls /api/agent/status/{id} every 2s while a run is active
// Duration ticks live every second during a run
// Refresh button reloads both history and current run
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { runAgent, getAgentStatus, getAgentLogs, sendDigest, getAiProvider, setAiProvider, getAgentProgress } from '../api'
import StatusBadge from '../components/StatusBadge'
import { Zap, RefreshCw, Mail, Clock, CheckCircle, XCircle, Loader2, Search, Cpu, Terminal, SlidersHorizontal, Infinity } from 'lucide-react'
import toast from 'react-hot-toast'

// Backend stores datetimes as naive UTC (no 'Z').  Without the suffix
// JavaScript treats them as LOCAL time (IST = UTC+5:30), making durations
// appear to be ~330 minutes longer than reality.
function parseUtc(s) {
  if (!s) return null
  // Append Z only if no timezone info is already present
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

function useLiveDuration(startedAt, finishedAt) {
  const [elapsed, setElapsed] = useState('')

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
  const [provider, setProvider] = useState('nvidia')
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [progressLogs, setProgressLogs] = useState([])
  // ── Pre-run config ─────────────────────────────────────────────
  const [maxProcess, setMaxProcess] = useState(50)
  const [processAll, setProcessAll] = useState(false)
  // ── Custom AI provider ─────────────────────────────────────────
  const [customApiKey, setCustomApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('https://integrate.api.nvidia.com/v1')
  const [customModel, setCustomModel] = useState('')
  const [showCustomFields, setShowCustomFields] = useState(false)
  const pollRef = useRef(null)
  const progressPollRef = useRef(null)
  const progressEndRef = useRef(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 360

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

  // On mount — load history, auto-resume any in-progress run, fetch active provider
  useEffect(() => {
    async function init() {
      try {
        const data = await getAgentLogs()
        setLogs(data)
        if (data.length > 0 && data[0].status === 'running') {
          setCurrentRun(data[0])   // resume polling for the last run
        }
      } catch { /* ignore */ }
      try {
        const p = await getAiProvider()
        setProvider(p.provider)
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
          // Fetch final progress
          try { const p = await getAgentProgress(currentRun.id); setProgressLogs(p.logs) } catch {}
          loadLogs()
          if (data.status === 'completed')
            toast.success(`Run #${data.id} completed! Found ${data.opportunities_found} opportunities.`)
          else
            toast.error(`Run #${data.id} failed.`)
        }
      } catch {
        clearInterval(pollRef.current)
        clearInterval(progressPollRef.current)
        // Fetch real status from DB so UI doesn't stay stuck on "Running"
        loadLogs()
        setCurrentRun(prev => prev ? { ...prev, status: 'failed', error_message: 'Lost connection to backend — check Render logs.' } : prev)
      }
    }, 2000)

    // Also poll progress every 3 seconds
    progressPollRef.current = setInterval(async () => {
      try {
        const p = await getAgentProgress(currentRun.id)
        setProgressLogs(p.logs)
        // Auto-scroll
        progressEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } catch { /* ignore */ }
    }, 3000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(progressPollRef.current)
    }
  }, [currentRun?.id, isRunning])

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
      const payload = newProvider === 'custom'
        ? { provider: 'custom', custom_api_key: customApiKey, custom_base_url: customBaseUrl, custom_model: customModel }
        : { provider: newProvider }
      const data = await setAiProvider(payload)
      setProvider(data.provider)
      setShowCustomFields(data.provider === 'custom')
      const label = data.provider === 'nvidia' ? 'NVIDIA NIM (Default)' : data.provider === 'glm' ? 'ZhipuAI GLM' : 'Custom Provider'
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
      const data = await setAiProvider({ provider: 'custom', custom_api_key: customApiKey, custom_base_url: customBaseUrl, custom_model: customModel })
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
              Scrapes Internshala, Unstop &amp; Devpost · Checks eligibility via{' '}
              <span className={provider === 'nvidia' ? 'text-green-400' : 'text-purple-400'}>
                {provider === 'nvidia' ? 'NVIDIA NIM (minimax-m2.5)' : 'ZhipuAI GLM-4-Flash'}
              </span>
              {' '}· Ranks results
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

        {/* Pre-run config */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Processing Config</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Max opportunities input */}
            <div className={`p-3 rounded-xl border transition-all ${
              processAll ? 'border-white/5 bg-white/2 opacity-50' : 'border-white/10 bg-white/5'
            }`}>
              <div className="text-xs text-slate-400 mb-1.5 font-medium">Opportunities to check</div>
              <div className="flex items-center gap-2">
                <input
                  id="max-process-input"
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={maxProcess}
                  disabled={processAll || isRunning}
                  onChange={e => setMaxProcess(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-20 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-100
                             focus:outline-none focus:border-brand-500 disabled:opacity-40 text-center"
                />
                <span className="text-xs text-slate-500">
                  → {Math.ceil(maxProcess / 10)} sub-batch{Math.ceil(maxProcess / 10) !== 1 ? 'es' : ''} of 10
                </span>
              </div>
            </div>

            {/* Process All toggle */}
            <div
              onClick={() => !isRunning && setProcessAll(p => !p)}
              className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                processAll
                  ? 'border-brand-500/50 bg-brand-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  processAll ? 'border-brand-500 bg-brand-500' : 'border-white/30'
                }`}>
                  {processAll && <CheckCircle size={10} className="text-white" />}
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-200 flex items-center gap-1">
                    <Infinity size={11} className="text-brand-400" /> Process All
                  </div>
                  <div className="text-xs text-slate-500">All unscored opps, sub-batches of 10</div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary line */}
          <div className="mt-2 text-xs text-slate-600">
            {processAll
              ? '⚡ Will check every unscored opportunity found (may take longer)'
              : `⚡ Will check up to ${maxProcess} opportunities in ${Math.ceil(maxProcess / 10)} × 10 sub-batches`
            }
          </div>
        </div>

        {/* AI Provider toggle */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">AI Provider</span>
          </div>

          {/* Provider tabs */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-3">
            {[
              { id: 'nvidia', label: '⚡ Default (NVIDIA NIM)', desc: 'Uses built-in API key' },
              { id: 'glm',    label: 'ZhipuAI GLM',             desc: 'Uses ZHIPUAI_API_KEY' },
              { id: 'custom', label: '🔧 Custom',                desc: 'Your own API key + model' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === 'custom') { setShowCustomFields(true); if (provider !== 'custom') return }
                  handleProviderSwitch(opt.id)
                }}
                disabled={switchingProvider}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                  provider === opt.id
                    ? opt.id === 'nvidia' ? 'bg-white/10 text-green-400'
                      : opt.id === 'glm'  ? 'bg-white/10 text-purple-400'
                      : 'bg-white/10 text-orange-400'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {switchingProvider && provider !== opt.id ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Current provider info or custom fields */}
          {provider !== 'custom' ? (
            <div className="text-xs text-slate-600">
              {provider === 'nvidia' ? '⚡ minimaxai/minimax-m2.5 via NVIDIA NIM (default key)'
                : '🔮 glm-4.7-flash via ZhipuAI Z.AI'}
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <div className="text-xs text-orange-400/80 mb-2">Custom provider settings are saved and used for all AI calls until you switch back.</div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">API Key *</label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={e => setCustomApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-400/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Base URL *</label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={e => setCustomBaseUrl(e.target.value)}
                  placeholder="https://integrate.api.nvidia.com/v1"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-400/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Model Name *</label>
                <input
                  type="text"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="e.g. meta/llama-3.1-70b-instruct"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-orange-400/50"
                />
              </div>
              <button
                onClick={handleSaveCustom}
                disabled={switchingProvider}
                className="w-full py-1.5 text-xs font-medium bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 rounded-lg transition-all disabled:opacity-50"
              >
                {switchingProvider ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                Save &amp; Use Custom Provider
              </button>
            </div>
          )}
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

            {/* Live progress log */}
            {progressLogs.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500 font-medium">Live Progress</span>
                </div>
                <div className="bg-black/40 rounded-xl p-3 max-h-48 overflow-y-auto font-mono space-y-1.5 border border-white/5">
                  {progressLogs.map((entry, i) => (
                    <div key={i} className={`text-xs flex gap-2 ${
                      entry.stage === 'error' ? 'text-red-400' :
                      entry.stage === 'done'  ? 'text-green-400' :
                      'text-slate-300'
                    }`}>
                      <span className="text-slate-600 flex-shrink-0 tabular-nums">
                        {entry.ts ? new Date(entry.ts + 'Z').toLocaleTimeString('en-IN', { timeStyle: 'short' }) : ''}
                      </span>
                      <span>{entry.message}</span>
                    </div>
                  ))}
                  {isRunning && (
                    <div className="text-xs text-brand-400 flex items-center gap-1">
                      <Loader2 size={9} className="animate-spin" /> running...
                    </div>
                  )}
                  <div ref={progressEndRef} />
                </div>
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
                      {parseUtc(log.started_at)?.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {log.finished_at
                        ? formatSecs(Math.round((parseUtc(log.finished_at) - parseUtc(log.started_at)) / 1000))
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
