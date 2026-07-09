// ────────────────────────────────────────────────────────────────
// main.jsx — React app entry point
// ────────────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '1px solid var(--border-strong)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
          },
          success: {
            iconTheme: { primary: 'var(--accent)', secondary: 'var(--on-accent)' },
          },
          error: {
            iconTheme: { primary: 'var(--danger)', secondary: 'var(--on-accent)' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
