// ────────────────────────────────────────────────────────────────
// pages/Profile.jsx — Create / edit user profile
// Preserves: getProfile/updateProfile/parseResume, form state,
// tag inputs, resume upload, PDF viewer, scanning FX, AI-fill tracking,
// localStorage + module-level session state.
// New visual: light canvas, brutalist dashed drop-zone, accent AI highlights.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { getProfile, updateProfile, parseResume } from '../api'
import {
  User, Plus, X, Save, Loader2, Upload, FileText,
  Sparkles, CheckCircle, ScanLine,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Keyframes ──────────────────────────────────────────────────────
const STYLES = `
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(80px) scale(0.97); }
    to   { opacity: 1; transform: translateX(0)    scale(1); }
  }
  @keyframes scan-beam {
    0%   { top: 4%; }
    50%  { top: 88%; }
    100% { top: 4%; }
  }
  @keyframes corner-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
`

// ── Module-level session state ─ survives React navigation ──────────
let _stage    = 'idle'
let _pdfUrl   = null
let _aiFilled = new Set()

// ── localStorage helpers ────────────────────────────────────────────
const LS_PDF   = 'oppu_profile_pdf'
const LS_STAGE = 'oppu_profile_stage'

function lsSavePdf(dataUrl) {
  try {
    localStorage.setItem(LS_PDF, dataUrl)
    localStorage.setItem(LS_STAGE, 'done')
  } catch (e) {
    console.warn('[profile] localStorage quota exceeded, PDF not persisted:', e)
  }
}

function lsClearPdf() {
  try {
    localStorage.removeItem(LS_PDF)
    localStorage.removeItem(LS_STAGE)
  } catch {}
}

function lsLoadPdf() {
  try {
    const url   = localStorage.getItem(LS_PDF)
    const stage = localStorage.getItem(LS_STAGE)
    return url ? { url, stage: stage || 'done' } : null
  } catch {
    return null
  }
}

// ── Tag chip input ─────────────────────────────────────────────────

function TagInput({ id, label, value, onChange, placeholder, highlight }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function addTag() {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
    inputRef.current?.focus()
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {highlight && (
          <span className="flex items-center gap-1 type-mono text-accent">
            <Sparkles size={11} /> AI filled
          </span>
        )}
      </div>
      <div
        className={`min-h-[2.75rem] flex flex-wrap gap-1.5 px-3 py-2 rounded-xl border transition-all ${
          highlight
            ? 'bg-accent-soft border-accent focus-within:ring-2 focus-within:ring-accent/30'
            : 'bg-surface2 border-border-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft/50'
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold border border-accent/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-ink"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : '+ add more'}
          className="flex-1 min-w-[6rem] bg-transparent text-sm text-ink placeholder-muted outline-none"
        />
        <button
          type="button"
          onClick={addTag}
          className="text-muted hover:text-accent transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      <p className="text-xs text-muted mt-1">Press Enter or comma to add</p>
    </div>
  )
}

// ── Resume drop zone ───────────────────────────────────────────────

function ResumeUpload({ onFile, parsing, hasResume, onHide }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      onFile(e.dataTransfer.files[0])
    },
    [onFile]
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !parsing && fileRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all select-none ${
          dragging
            ? 'border-accent bg-accent-soft scale-[1.01]'
            : 'border-border-strong bg-surface2 hover:border-accent hover:bg-accent-soft/30'
        } ${parsing ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files[0])}
      />

      {hasResume && !parsing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onHide() }}
          className="absolute top-2 right-2 flex items-center gap-1 text-xs text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-surface2 transition-all"
        >
          <X size={11} /> Hide preview
        </button>
      )}

      {parsing ? (
        <>
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <Sparkles size={22} className="text-accent animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-ink">Reading your resume…</p>
            <p className="text-xs text-muted mt-1">AI is extracting your profile</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <Upload size={22} className="text-accent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-ink">
              {hasResume ? 'Upload a different resume' : 'Drop your resume PDF here'}
            </p>
            <p className="text-xs text-muted mt-1">
              or <span className="text-accent underline underline-offset-2">click to browse</span>
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-soft border border-accent/20">
            <Sparkles size={12} className="text-accent" />
            <span className="text-xs text-accent font-semibold">AI will auto-fill your profile</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── PDF viewer with scanning FX ────────────────────────────────────

function PdfViewer({ url, stage }) {
  const isScanning = stage === 'parsing'
  const isDone     = stage === 'done'

  const borderColor = isScanning ? 'var(--accent)' : 'var(--success)'

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col bg-surface"
      style={{
        boxShadow: `0 0 0 2px ${borderColor}, 0 8px 32px rgba(0,0,0,0.08)`,
        transition: 'box-shadow 0.8s ease',
      }}
    >
      <iframe
        src={url}
        title="Uploaded Resume"
        className="flex-1 w-full rounded-2xl bg-white"
        style={{ minHeight: 0, border: 'none' }}
      />

      {/* Scanning beam */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              animation: 'scan-beam 2.2s ease-in-out infinite',
            }}
          >
            <div
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              }}
            />
            <div
              style={{
                height: 40,
                background: 'linear-gradient(180deg, var(--accent-soft), transparent)',
              }}
            />
          </div>
        </div>
      )}

      {/* Corner brackets */}
      {(isScanning || isDone) &&
        ['tl', 'tr', 'bl', 'br'].map((corner) => {
          const pos = {
            tl: { top: 0, left: 0 },
            tr: { top: 0, right: 0 },
            bl: { bottom: 0, left: 0 },
            br: { bottom: 0, right: 0 },
          }[corner]
          const color = isScanning ? 'var(--accent)' : 'var(--success)'
          const w = 24, t = 2
          return (
            <div
              key={corner}
              className="absolute pointer-events-none z-20"
              style={{
                ...pos,
                width: w,
                height: w,
                animation: isScanning ? 'corner-pulse 1.2s ease-in-out infinite' : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  height: t,
                  width: '100%',
                  background: color,
                  top: corner.startsWith('t') ? 0 : undefined,
                  bottom: corner.startsWith('b') ? 0 : undefined,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: t,
                  height: '100%',
                  background: color,
                  left: corner.endsWith('l') ? 0 : undefined,
                  right: corner.endsWith('r') ? 0 : undefined,
                }}
              />
            </div>
          )
        })}

      {/* Status pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-700 ${
            isScanning
              ? 'bg-dark/85 border-accent/40 text-accent'
              : 'bg-dark/85 border-success/40 text-success'
          }`}
        >
          {isScanning ? (
            <><ScanLine size={12} className="animate-pulse" /> AI scanning resume…</>
          ) : (
            <><CheckCircle size={12} /> Analysis complete</>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

const EMPTY = {
  name: '',
  email: '',
  cgpa: '',
  skills: [],
  preferred_roles: [],
  preferred_locations: [],
  resume_text: '',
}

export default function Profile() {
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [stage,    setStageState]   = useState(_stage)
  const [pdfUrl,   setPdfUrlState]  = useState(_pdfUrl)
  const [aiFilled, setAiFilledState] = useState(_aiFilled)

  function setStage(v)    { _stage    = v;  setStageState(v)    }
  function setPdfUrl(v)   { _pdfUrl   = v;  setPdfUrlState(v)   }
  function setAiFilled(v) { _aiFilled = v;  setAiFilledState(v) }

  useEffect(() => {
    if (!_pdfUrl) {
      const saved = lsLoadPdf()
      if (saved) {
        _pdfUrl  = saved.url
        _stage   = saved.stage
        setStageState(saved.stage)
        setPdfUrlState(saved.url)
      }
    }
    getProfile()
      .then((data) => setForm({ ...data, cgpa: data.cgpa ?? '' }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setAiFilled((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file')
      return
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    lsSavePdf(dataUrl)
    setPdfUrl(dataUrl)
    setStage('parsing')

    try {
      const result = await parseResume(file)
      const filled = new Set()

      setForm((prev) => {
        const next = { ...prev }
        if (result.name)                    { next.name = result.name;                       filled.add('name') }
        if (result.email)                   { next.email = result.email;                     filled.add('email') }
        if (result.cgpa != null)            { next.cgpa = String(result.cgpa);              filled.add('cgpa') }
        if (result.skills?.length)          { next.skills = result.skills;                   filled.add('skills') }
        if (result.preferred_roles?.length) { next.preferred_roles = result.preferred_roles; filled.add('preferred_roles') }
        if (result.resume_text)             { next.resume_text = result.resume_text;         filled.add('resume_text') }
        return next
      })

      setAiFilled(filled)
      setStage('done')
      if (result.warning) toast('Some fields need manual fill', { icon: '⚠️' })
      else toast.success('Profile auto-filled!')
    } catch (err) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')
      const detail    = err?.response?.data?.detail
      const errMsg    = isTimeout
        ? 'Resume upload timed out — the server may be waking up, try again in 30s'
        : detail || err?.message || 'Failed to parse resume'
      console.error('[handleFile] parse failed:', err?.message, err?.response?.data)
      toast.error(errMsg, { duration: 6000 })
      setStage('idle')
      lsClearPdf()
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ ...form, cgpa: form.cgpa ? parseFloat(form.cgpa) : null })
      toast.success('Profile saved!')
      setAiFilled(new Set())
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  const hasResume = stage !== 'idle'
  const isParsing = stage === 'parsing'
  const isDone    = stage === 'done'

  const fieldHighlight = (key) =>
    aiFilled.has(key)
      ? 'border-accent bg-accent-soft ring-1 ring-accent/20'
      : ''

  const form_content = (
    <form onSubmit={handleSave} className="card space-y-5 h-full">
      {/* Resume Upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} className="text-accent" />
          <h2 className="type-h3 text-ink">Auto-fill from Resume</h2>
        </div>
        <ResumeUpload
          onFile={handleFile}
          parsing={isParsing}
          hasResume={hasResume}
          onHide={() => { setStage('idle'); setPdfUrl(null); lsClearPdf() }}
        />
      </div>

      <div className="border-t border-border" />

      {/* AI fill banner */}
      {isDone && aiFilled.size > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-accent-soft border border-accent/20">
          <CheckCircle size={16} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-accent">Profile auto-filled!</p>
            <p className="text-xs text-accent/80 mt-0.5">Review highlighted fields then save.</p>
          </div>
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-ink">Full Name</label>
            {aiFilled.has('name') && (
              <span className="flex items-center gap-1 type-mono text-accent">
                <Sparkles size={11} /> AI filled
              </span>
            )}
          </div>
          <input
            id="profile-name"
            placeholder="Aryan Singh"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={`input transition-all ${fieldHighlight('name')}`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-ink">Email</label>
            {aiFilled.has('email') && (
              <span className="flex items-center gap-1 type-mono text-accent">
                <Sparkles size={11} /> AI filled
              </span>
            )}
          </div>
          <input
            id="profile-email"
            type="email"
            placeholder="aryan@college.edu"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={`input transition-all ${fieldHighlight('email')}`}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-ink">CGPA</label>
          {aiFilled.has('cgpa') && (
            <span className="flex items-center gap-1 type-mono text-accent">
              <Sparkles size={11} /> AI filled
            </span>
          )}
        </div>
        <input
          id="profile-cgpa"
          type="number"
          step="0.01"
          min="0"
          max="10"
          placeholder="8.5"
          value={form.cgpa}
          onChange={(e) => set('cgpa', e.target.value)}
          className={`input w-32 transition-all ${fieldHighlight('cgpa')}`}
        />
      </div>

      <TagInput
        id="profile-skills"
        label="Skills"
        value={form.skills}
        onChange={(v) => set('skills', v)}
        placeholder="Python, React, ML…"
        highlight={aiFilled.has('skills')}
      />

      <TagInput
        id="profile-roles"
        label="Preferred Roles"
        value={form.preferred_roles}
        onChange={(v) => set('preferred_roles', v)}
        placeholder="Data Science, Backend…"
        highlight={aiFilled.has('preferred_roles')}
      />

      <TagInput
        id="profile-locations"
        label="Preferred Locations"
        value={form.preferred_locations}
        onChange={(v) => set('preferred_locations', v)}
        placeholder="Remote, Bangalore…"
        highlight={false}
      />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-ink">Resume Text</label>
          {aiFilled.has('resume_text') && (
            <span className="flex items-center gap-1 type-mono text-accent">
              <Sparkles size={11} /> Extracted from PDF
            </span>
          )}
        </div>
        <textarea
          id="profile-resume"
          rows={5}
          className={`input resize-none transition-all ${fieldHighlight('resume_text')}`}
          placeholder="Paste your resume content here, or upload a PDF above."
          value={form.resume_text}
          onChange={(e) => set('resume_text', e.target.value)}
        />
        <p className="text-xs text-muted mt-1">Used by the AI for accurate matching</p>
      </div>

      <button
        id="profile-save"
        type="submit"
        disabled={saving || isParsing}
        className="btn btn-primary w-full"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )

  return (
    <>
      <style>{STYLES}</style>

      <div className="animate-fade-in">
        {/* Page heading */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <User size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="type-h1 text-ink">Your Profile</h1>
            <p className="text-sm text-muted">Used by the AI to match you with opportunities</p>
          </div>
        </div>

        {!hasResume ? (
          <div className="max-w-2xl mx-auto">{form_content}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="min-w-0">{form_content}</div>
            <div
              className="sticky top-6 h-[calc(100vh-3rem)] animate-slide-in-right"
              style={{ animationDelay: '100ms' }}
            >
              {pdfUrl && <PdfViewer url={pdfUrl} stage={stage} />}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
