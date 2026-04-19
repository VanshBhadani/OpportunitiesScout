// ────────────────────────────────────────────────────────────────
// pages/Profile.jsx — Create / edit user profile
// ── Animation sequence ──────────────────────────────────────────
//  idle    → single centred column (max-w-2xl form)
//  parsing → CSS grid 1fr|1fr: form compresses left, PDF slides in right
//            + blue scanning glow + corner brackets + sweep beam
//  done    → glow → emerald, fields stagger-fill
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { getProfile, updateProfile, parseResume } from '../api'
import {
  User, Plus, X, Save, Loader2, Upload, FileText,
  Sparkles, CheckCircle, ScanLine
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Keyframes injected once ────────────────────────────────────────
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

// ── Module-level session state — survives React navigation ──────────
// These persist across Profile unmount/remount (page navigation).
// Cleared only on browser tab reload.
let _stage    = 'idle'      // 'idle' | 'parsing' | 'done'
let _pdfUrl   = null        // data: URL or blob: URL — never revoked on unmount
let _aiFilled = new Set()   // which fields were AI-filled

// ── localStorage helpers (cross-session persistence) ─────────────────
const LS_PDF   = 'oppu_profile_pdf'    // stores full data URL
const LS_STAGE = 'oppu_profile_stage'  // stores 'done'

function lsSavePdf(dataUrl) {
  try {
    localStorage.setItem(LS_PDF,   dataUrl)
    localStorage.setItem(LS_STAGE, 'done')
  } catch (e) {
    // Quota exceeded (PDF > ~5MB) — silent fail, session-only fallback
    console.warn('[profile] localStorage quota exceeded, PDF not persisted:', e)
  }
}
function lsClearPdf() {
  try { localStorage.removeItem(LS_PDF); localStorage.removeItem(LS_STAGE) } catch {}
}
function lsLoadPdf() {
  try {
    const url   = localStorage.getItem(LS_PDF)
    const stage = localStorage.getItem(LS_STAGE)
    return url ? { url, stage: stage || 'done' } : null
  } catch { return null }
}

// ── Tag chip input ─────────────────────────────────────────────────

function TagInput({ id, label, value, onChange, placeholder, highlight }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef()

  function addTag() {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
    inputRef.current?.focus()
  }
  function removeTag(tag) { onChange(value.filter(t => t !== tag)) }
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && !draft && value.length) removeTag(value[value.length - 1])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {highlight && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Sparkles size={11} /> AI filled
          </span>
        )}
      </div>
      <div className={`min-h-11 flex flex-wrap gap-1.5 px-3 py-2 rounded-xl border transition-all duration-500
        ${highlight
          ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
          : 'bg-white/5 border-white/10 focus-within:ring-2 focus-within:ring-brand-500/50'}`}>
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-500/20 text-brand-300 text-xs font-medium">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-white"><X size={10} /></button>
          </span>
        ))}
        <input id={id} ref={inputRef} type="text" value={draft}
          onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : '+ add more'}
          className="flex-1 min-w-24 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
        />
        <button type="button" onClick={addTag} className="text-slate-500 hover:text-brand-400 transition-colors">
          <Plus size={14} />
        </button>
      </div>
      <p className="text-xs text-slate-600 mt-1">Press Enter or comma to add</p>
    </div>
  )
}

// ── Resume drop zone ───────────────────────────────────────────────

function ResumeUpload({ onFile, parsing, hasResume, onHide }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0])
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !parsing && fileRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all select-none
        ${dragging ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
          : 'border-white/15 bg-white/3 hover:border-brand-500/50 hover:bg-brand-500/5'}
        ${parsing ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={e => onFile(e.target.files[0])} />

      {/* Hide preview button */}
      {hasResume && !parsing && (
        <button type="button" onClick={e => { e.stopPropagation(); onHide() }}
          className="absolute top-2 right-2 flex items-center gap-1 text-xs text-slate-500
            hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-white/8 transition-all">
          <X size={11} /> Hide preview
        </button>
      )}

      {parsing ? (
        <>
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center">
            <Sparkles size={22} className="text-brand-400 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">Reading your resume…</p>
            <p className="text-xs text-slate-500 mt-1">GLM-4.7-Flash is extracting your profile</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-brand-500/15 flex items-center justify-center">
            <Upload size={22} className="text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">
              {hasResume ? 'Upload a different resume' : 'Drop your resume PDF here'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              or <span className="text-brand-400 underline underline-offset-2">click to browse</span>
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
            <Sparkles size={12} className="text-brand-400" />
            <span className="text-xs text-brand-300 font-medium">AI will auto-fill your profile</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── PDF viewer with scanning FX ────────────────────────────────────

function PdfViewer({ url, stage }) {
  // stage: 'parsing' | 'done'
  const isScanning = stage === 'parsing'
  const isDone     = stage === 'done'

  const borderColor = isScanning
    ? 'rgba(99,102,241,0.7)'   // brand indigo
    : 'rgba(52,211,153,0.6)'   // emerald

  const glowColor = isScanning
    ? '0 0 0 2px rgba(99,102,241,0.6), 0 0 40px 8px rgba(99,102,241,0.25), inset 0 0 30px 4px rgba(99,102,241,0.1)'
    : '0 0 0 2px rgba(52,211,153,0.6), 0 0 30px 6px rgba(52,211,153,0.2)'

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col"
      style={{ boxShadow: glowColor, transition: 'box-shadow 0.8s ease' }}>

      {/* PDF iframe — fills entire panel */}
      <iframe src={url} title="Uploaded Resume"
        className="flex-1 w-full rounded-2xl bg-white"
        style={{ minHeight: 0, border: 'none' }} />

      {/* Scanning beam sweeps over the iframe */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div style={{ position: 'absolute', left: 0, right: 0, animation: 'scan-beam 2.2s ease-in-out infinite' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.9), transparent)' }} />
            <div style={{ height: 40, background: 'linear-gradient(180deg, rgba(99,102,241,0.18), transparent)' }} />
          </div>
        </div>
      )}

      {/* Corner brackets — animated pulse while scanning */}
      {(isScanning || isDone) && (['tl','tr','bl','br']).map(corner => {
        const pos = {
          tl: { top: 0, left: 0 },
          tr: { top: 0, right: 0 },
          bl: { bottom: 0, left: 0 },
          br: { bottom: 0, right: 0 },
        }[corner]
        const color = isScanning ? 'rgba(99,102,241,0.9)' : 'rgba(52,211,153,0.9)'
        const w = 24, t = 2
        return (
          <div key={corner} className="absolute pointer-events-none z-20"
            style={{ ...pos, width: w, height: w, animation: isScanning ? 'corner-pulse 1.2s ease-in-out infinite' : 'none' }}>
            {/* Horizontal arm */}
            <div style={{
              position: 'absolute', height: t, width: '100%', background: color,
              top: corner.startsWith('t') ? 0 : undefined,
              bottom: corner.startsWith('b') ? 0 : undefined,
            }} />
            {/* Vertical arm */}
            <div style={{
              position: 'absolute', width: t, height: '100%', background: color,
              left: corner.endsWith('l') ? 0 : undefined,
              right: corner.endsWith('r') ? 0 : undefined,
            }} />
          </div>
        )
      })}

      {/* Status pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
          backdrop-blur-md border transition-all duration-700
          ${isScanning
            ? 'bg-[#0d0f1e]/85 border-brand-500/40 text-brand-300'
            : 'bg-[#0a1a12]/85 border-emerald-500/40 text-emerald-300'}`}>
          {isScanning
            ? <><ScanLine size={12} className="animate-pulse" /> AI scanning resume…</>
            : <><CheckCircle size={12} /> Analysis complete</>}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

const EMPTY = {
  name: '', email: '', cgpa: '',
  skills: [], preferred_roles: [], preferred_locations: [], resume_text: ''
}

export default function Profile() {
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  // Initialise from module-level vars so state survives navigation
  const [stage,    setStageState]    = useState(_stage)
  const [pdfUrl,   setPdfUrlState]   = useState(_pdfUrl)
  const [aiFilled, setAiFilledState] = useState(_aiFilled)

  // Keep module vars in sync whenever React state changes
  function setStage(v)    { _stage    = v;  setStageState(v)    }
  function setPdfUrl(v)   { _pdfUrl   = v;  setPdfUrlState(v)   }
  function setAiFilled(v) { _aiFilled = v;  setAiFilledState(v) }

  // On mount: restore PDF from localStorage if module var isn't set (fresh page load)
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
      .then(data => setForm({ ...data, cgpa: data.cgpa ?? '' }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setAiFilled(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('Please upload a PDF file'); return }

    // Convert file → data URL so it can be stored in localStorage
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Persist to localStorage (survives tab close + page reload)
    lsSavePdf(dataUrl)

    // Update module var + React state (dataUrl works directly as iframe src)
    setPdfUrl(dataUrl)
    setStage('parsing')
    try {
      const result = await parseResume(file)
      const filled = new Set()
      setForm(prev => {
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
      else toast.success('✨ Profile auto-filled!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to parse resume')
      setStage('idle')
      lsClearPdf()  // don't persist failed state
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

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin text-brand-400" />
    </div>
  )

  const hasResume = stage !== 'idle'
  const isParsing = stage === 'parsing'
  const isDone    = stage === 'done'

  // Stagger delay for form fields when done
  const sd = (n) => isDone ? `${n * 80}ms` : '0ms'

  const form_content = (
    <form onSubmit={handleSave} className="card space-y-5 h-full">

      {/* ── Resume Upload ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-300">Auto-fill from Resume</h2>
        </div>
        <ResumeUpload onFile={handleFile} parsing={isParsing}
          hasResume={hasResume} onHide={() => { setStage('idle'); setPdfUrl(null); lsClearPdf() }} />
      </div>

      <div className="border-t border-white/8" />

      {/* AI fill banner */}
      {isDone && aiFilled.size > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
          <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Profile auto-filled!</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">Review highlighted fields then save.</p>
          </div>
        </div>
      )}

      {/* ── Basic info ── */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{ transitionDelay: sd(1) }}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-slate-300">Full Name</label>
            {aiFilled.has('name') && <span className="flex items-center gap-1 text-xs text-emerald-400"><Sparkles size={11} /> AI filled</span>}
          </div>
          <input id="profile-name" placeholder="Aryan Singh" value={form.name}
            onChange={e => set('name', e.target.value)}
            className={`input transition-all duration-500 ${aiFilled.has('name') ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`} />
        </div>
        <div style={{ transitionDelay: sd(2) }}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-slate-300">Email</label>
            {aiFilled.has('email') && <span className="flex items-center gap-1 text-xs text-emerald-400"><Sparkles size={11} /> AI filled</span>}
          </div>
          <input id="profile-email" type="email" placeholder="aryan@college.edu" value={form.email}
            onChange={e => set('email', e.target.value)}
            className={`input transition-all duration-500 ${aiFilled.has('email') ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`} />
        </div>
      </div>

      <div style={{ transitionDelay: sd(3) }}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-slate-300">CGPA</label>
          {aiFilled.has('cgpa') && <span className="flex items-center gap-1 text-xs text-emerald-400"><Sparkles size={11} /> AI filled</span>}
        </div>
        <input id="profile-cgpa" type="number" step="0.01" min="0" max="10" placeholder="8.5"
          className={`input w-32 transition-all duration-500 ${aiFilled.has('cgpa') ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`}
          value={form.cgpa} onChange={e => set('cgpa', e.target.value)} />
      </div>

      <TagInput id="profile-skills" label="Skills"
        value={form.skills} onChange={v => set('skills', v)}
        placeholder="Python, React, ML…" highlight={aiFilled.has('skills')} />

      <TagInput id="profile-roles" label="Preferred Roles"
        value={form.preferred_roles} onChange={v => set('preferred_roles', v)}
        placeholder="Data Science, Backend…" highlight={aiFilled.has('preferred_roles')} />

      <TagInput id="profile-locations" label="Preferred Locations"
        value={form.preferred_locations} onChange={v => set('preferred_locations', v)}
        placeholder="Remote, Bangalore…" highlight={false} />

      <div style={{ transitionDelay: sd(6) }}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-slate-300">Resume Text</label>
          {aiFilled.has('resume_text') && <span className="flex items-center gap-1 text-xs text-emerald-400"><Sparkles size={11} /> Extracted from PDF</span>}
        </div>
        <textarea id="profile-resume" rows={5}
          className={`input resize-none transition-all duration-500 ${aiFilled.has('resume_text') ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`}
          placeholder="Paste your resume content here, or upload a PDF above."
          value={form.resume_text} onChange={e => set('resume_text', e.target.value)} />
        <p className="text-xs text-slate-600 mt-1">Used by the AI for accurate matching</p>
      </div>

      <button id="profile-save" type="submit" disabled={saving || isParsing} className="btn-primary w-full justify-center py-3">
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
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <User size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">Your Profile</h1>
            <p className="text-xs text-slate-500">Used by the AI to match you with opportunities</p>
          </div>
        </div>

        {/* ── Layout: single column → two column ────────────── */}
        {!hasResume ? (
          /* IDLE: centred single column */
          <div className="max-w-2xl mx-auto">
            {form_content}
          </div>
        ) : (
          /* ACTIVE: side-by-side grid — form left, PDF right */
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            alignItems: 'start',
          }}>
            {/* Left: scrollable form */}
            <div style={{ minWidth: 0 }}>
              {form_content}
            </div>

            {/* Right: PDF panel — sticky, full viewport height */}
            <div style={{
              position: 'sticky',
              top: '5rem',          /* below navbar */
              height: 'calc(100vh - 7rem)',
              animation: 'slide-in-right 0.6s cubic-bezier(0.22,1,0.36,1) both',
            }}>
              {pdfUrl && <PdfViewer url={pdfUrl} stage={stage} />}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
