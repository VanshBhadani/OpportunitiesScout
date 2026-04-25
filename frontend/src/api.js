// ────────────────────────────────────────────────────────────────
// api.js — Axios wrapper for all backend API calls
// Base URL points to localhost:8000 (proxied via Vite in dev)
// ────────────────────────────────────────────────────────────────

import axios from 'axios'

// In production (Vercel), VITE_API_URL points to the Render backend.
// In local dev, Vite proxies /api → localhost:8000 so we use /api.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Profile ──────────────────────────────────────────────────────

export const getProfile = () => api.get('/profile').then(r => r.data)
export const createProfile = (data) => api.post('/profile', data).then(r => r.data)
export const updateProfile = (data) => api.put('/profile', data).then(r => r.data)

export const parseResume = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/profile/parse-resume', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,  // GLM reasoning model needs up to ~30s
  }).then(r => r.data)
}

// ── Opportunities ─────────────────────────────────────────────────

export const getOpportunities = (params = {}) =>
  api.get('/opportunities', { params }).then(r => r.data)

export const getOpportunity = (id) =>
  api.get(`/opportunities/${id}`).then(r => r.data)

export const deleteOpportunity = (id) =>
  api.delete(`/opportunities/${id}`)

export const deleteAllOpportunities = () =>
  api.delete('/opportunities').then(r => r.data)

export const tailorOpportunity = (id) =>
  api.post(`/opportunities/${id}/tailor`, {}, { timeout: 90000 }).then(r => r.data)

// ── Agent ─────────────────────────────────────────────────────────

export const runAgent = (config = {}) => api.post('/agent/run', config).then(r => r.data)

export const getAgentStatus = (runId) =>
  api.get(`/agent/status/${runId}`).then(r => r.data)
export const getAgentLogs = () => api.get('/agent/logs').then(r => r.data)
export const getAgentProgress = (runId) =>
  api.get(`/agent/progress/${runId}`, { timeout: 5000 }).then(r => r.data)


// ── Email ─────────────────────────────────────────────────────────

export const sendDigest = () => api.post('/email/send-digest').then(r => r.data)

// ── GLM Status ────────────────────────────────────────────────────

export const getGlmStatus = () =>
  api.get('/glm/status', { timeout: 3000 }).then(r => r.data)

// ── AI Provider config ────────────────────────────────────────────

export const getAiProvider = () =>
  api.get('/config/provider').then(r => r.data)

export const setAiProvider = (provider) =>
  api.post('/config/provider', { provider }).then(r => r.data)

export default api
