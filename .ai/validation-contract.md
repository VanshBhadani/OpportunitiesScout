# Validation Contract — Frontend Complete Redesign

## Summary
Complete redesign of the OpportunityScout frontend from scratch. Every page, component, and style is rebuilt against a new visual system (DESIGN.md) while preserving 100% of existing features and backend API connections.

## Classification
- Project type: Frontend redesign (React 19 + Vite + Tailwind v4)
- Complexity: High — full surface redesign across 3 pages + 8 components + global styles
- Risk: Medium — visual-only changes, no backend/API changes, but all frontend files are rewritten

## Dynamic Routing
- Capabilities: frontend, ui
- Skills: ui-ux-pro-max, impeccable
- Dispatch agents: @worker (Kimi K2.7 Code)
- Runtime models: opencode-go/kimi-k2.7-code
- Validators/reviewers: @validator (DeepSeek V4 Pro) — optional UX scope by request

## Features
1. App shell with split workspace layout (dark sidebar + light content)
2. Dashboard — opportunity grid with filters, search, pagination, clear-all, tailor trigger
3. OpportunityCard — platform badge, match score (bold visual), reasoning text, deadline urgency, tags, Tailor + Apply
4. FilterBar — search, platform filter, eligible toggle, sort
5. TailorPanel — slide-in glass panel with 5 AI analysis sections, copy buttons, cache, re-analyze
6. Profile — form with resume upload + AI parse + PDF viewer + scanning FX + localStorage persistence
7. RunAgent — pipeline trigger, pre-run config, AI provider tabs, live stats, progress log, run history, send digest
8. GlmIndicator — floating status pill
9. SplashScreen — premium intro animation
10. Navbar/Sidebar — navigation with active states, Quick Run trigger
11. Global styles — new design tokens, typography, effects, animations

## Acceptance Criteria
- All 3 pages render and function identically to current behavior (same API calls, same data flow)
- All API endpoints in api.js remain unchanged and fully connected
- New visual system matches DESIGN.md (light base, dark sidebar, electric blue accent, Space Grotesk + Inter + JetBrains Mono, purposeful glassmorphism, brutalist structure)
- WCAG AA contrast on all text/surface combinations
- prefers-reduced-motion respected on all animations
- Responsive: works on 375px, 768px, 1024px, 1440px
- No gradient text, no decorative orbs/particles, no cream backgrounds, no generic indigo-violet
- Build passes (tsc + vite build)
- No TypeScript errors

## Out Of Scope
- Backend changes (no API, database, or server changes)
- New features (no functionality additions, only visual redesign)
- Live mode configuration
- Browser automation testing
- Commit / merge

## Agent Packet Constraints
- Files to modify: All files under frontend/src/ (App.jsx, main.jsx, index.css, api.js [API CONNECTIONS ONLY — do not change endpoints], all components/*, all pages/*), frontend/index.html, frontend/tailwind.config.js, frontend/postcss.config.js
- Files to avoid: backend/*, requirements.txt, render.yaml, vercel.json, .env*, .opencode/*, .ai/*, PRODUCT.md, DESIGN.md, AGENTS.md, graphify-out/*
- Relevant memory: PRODUCT.md (brand personality, anti-references, design principles), DESIGN.md (full visual system spec)
- Relevant discovery output: Complete frontend source read — all 11 source files analyzed for feature/API mapping

## Validation Plan
- Default: Level 1 quick validation (tsc + vite build)
- Optional requested validation: UX scope (static review) — by request after implementation
