# DESIGN.md — OpportunityScout

## Overview

A premium, spatial workspace for AI-tailored opportunity discovery. Light base with dark essence: a near-white canvas with a dark glass sidebar, deep electric-blue accent, and purposeful glassmorphism. Bold maximalist typography meets restrained brutalist structure — hard borders, monospace labels, stark contrast blocks — softened by translucent layered surfaces. The result reads as a serious, expensive tool, not a template.

**Register:** product (design serves the product)
**Color strategy:** Full palette — 4 named roles used deliberately
**Aesthetic family:** Glassmorphism + Neo-Brutalist structure + Maximalist commitment
**Reference energy:** Raycast (sharp tool UI), Vercel (precision, typography), Render (dark-accented confidence)

## Color

All values in OKLCH. Verified for WCAG AA contrast.

### Tokens

| Token | OKLCH | Hex (approx) | Role |
|------|-------|------|------|
| `--bg` | `oklch(0.98 0.003 250)` | `#F7F8FC` | Page background — near-white, faintest cool tint (NOT cream) |
| `--surface` | `oklch(1 0 0)` | `#FFFFFF` | Cards, elevated surfaces |
| `--surface-2` | `oklch(0.96 0.005 250)` | `#EEF0F6` | Secondary surface, input backgrounds |
| `--ink` | `oklch(0.18 0.015 250)` | `#1A1B26` | Primary text, dark panels |
| `--ink-2` | `oklch(0.30 0.015 250)` | `#3D3E50` | Secondary headings |
| `--muted` | `oklch(0.48 0.015 250)` | `#6B6D80` | Secondary text (≥4.5:1 on bg) |
| `--border` | `oklch(0.92 0.008 250)` | `#DDE0EA` | Subtle dividers |
| `--border-strong` | `oklch(0.85 0.01 250)` | `#C5C9D6` | Brutalist hard borders |
| `--accent` | `oklch(0.50 0.25 255)` | `#0046FF` | Electric blue — brand, CTAs, active states |
| `--accent-hover` | `oklch(0.45 0.25 255)` | `#003ACC` | Hover/pressed on accent |
| `--accent-soft` | `oklch(0.95 0.03 255)` | `#E0E7FF` | Accent tint backgrounds |
| `--on-accent` | `oklch(1 0 0)` | `#FFFFFF` | Text on accent surfaces |
| `--urgent` | `oklch(0.62 0.22 35)` | `#D94F1A` | Deadline urgency, warnings |
| `--success` | `oklch(0.55 0.15 145)` | `#1B8A4A` | Eligible, success states |
| `--danger` | `oklch(0.55 0.22 25)` | `#CC3333` | Destructive actions |
| `--dark` | `oklch(0.15 0.015 250)` | `#0E0F1A` | Dark panels — the "dark essence" |
| `--dark-surface` | `oklch(0.20 0.015 250)` | `#1E1F2E` | Elevated dark surfaces |
| `--on-dark` | `oklch(0.95 0.01 250)` | `#F2F3F8` | Text on dark panels |
| `--on-dark-muted` | `oklch(0.65 0.015 250)` | `#9FA1B5` | Secondary text on dark |

### Usage rules

- **Body text** is `--ink` on `--bg` / `--surface`. Never use `--muted` for body-length text on `--surface-2`; bump to `--ink-2`.
- **Accent** carries CTAs, active nav, match-score emphasis, focus rings. Not a wash — used sharply and deliberately.
- **Dark panels** (`--dark`) are the "dark essence": the sidebar, the Tailor panel, the splash. They create dramatic contrast against the light canvas.
- **Urgent** is reserved for deadline pressure (< 7 days) and warnings. Never decorative.
- **Success** for eligible badges, completed runs. Always paired with an icon or text, never color alone.

## Typography

| Role | Font | Weights | Notes |
|------|------|---------|-------|
| Display | Space Grotesk | 600, 700 | Headings, hero numbers, brand wordmark. Geometric, distinctive, technical. |
| Body | Inter | 400, 500, 600 | All body text, labels, UI copy. Clean, legible workhorse. |
| Mono | JetBrains Mono | 400, 500 | Brutalist labels, log output, technical metadata, section markers. |

### Type scale

| Token | Size | Weight | Family | Usage |
|-------|------|--------|--------|-------|
| `text-display` | `clamp(2.5rem, 5vw, 4rem)` | 700 | Space Grotesk | Page heroes, splash wordmark |
| `text-h1` | `clamp(1.75rem, 3vw, 2.25rem)` | 700 | Space Grotesk | Page titles |
| `text-h2` | `1.25rem` | 600 | Space Grotesk | Section headings |
| `text-h3` | `1rem` | 600 | Inter | Card titles, subsections |
| `text-body` | `0.9375rem` (15px) | 400 | Inter | Body text |
| `text-sm` | `0.8125rem` (13px) | 400 | Inter | Secondary text, meta |
| `text-xs` | `0.6875rem` (11px) | 500 | Inter | Badges, captions |
| `text-mono` | `0.75rem` | 500 | JetBrains Mono | Labels, log lines, technical accents |

### Rules

- Display headings: `letter-spacing: -0.03em`, `line-height: 1.1`, `text-wrap: balance`.
- Body: `line-height: 1.6`, `max-width: 65ch` for prose blocks.
- Mono labels: `letter-spacing: 0.05em`, `text-transform: uppercase` for brutalist section markers.
- Numbers in stats/scores: `font-variant-numeric: tabular-nums` to prevent layout shift.
- No gradient text. Ever. Emphasis via weight, size, or color.

## Layout & Spatial System

### App shell — NOT linear

The app uses a **split workspace** layout, not a top-to-bottom scroll:

- **Left sidebar** (`--dark`, 260px desktop / collapsible mobile): navigation, brand, quick-run trigger. This is the "dark essence" — a glassmorphic dark panel anchoring the left edge.
- **Main content area** (`--bg`, fills remaining width): the active page. Light, spacious, with glass cards floating on the canvas.
- **Overlays**: Tailor panel slides in from the right over a scrim. GLM indicator floats bottom-right. Splash covers all on load.

This creates spatial depth: the user moves between the dark sidebar zone and the light content zone. It is not a single column scrolled top to bottom.

### Spacing scale

4px base: `4, 8, 12, 16, 24, 32, 48, 64, 96`. Use `24` as the default card padding, `32-48` between sections, `8-12` between related items.

### Z-index scale

```
--z-base: 0
--z-content: 1
--z-sidebar: 10
--z-sticky: 20
--z-dropdown: 30
--z-scrim: 40
--z-panel: 50
--z-toast: 100
--z-splash: 9999
```

### Responsive

- Mobile-first. Breakpoints: `640, 768, 1024, 1440`.
- Sidebar collapses to a bottom nav bar (≤5 items) on `< 768px`.
- Card grids: `repeat(auto-fit, minmax(280px, 1fr))`.
- Content max-width: `max-w-7xl` (1280px) for the main area.

## Effects

### Glassmorphism (purposeful, not default)

Used on three surfaces only:
1. **Sidebar** — `background: var(--dark)` with `backdrop-filter: blur(24px)` and a subtle top border highlight.
2. **Tailor panel** — translucent dark surface sliding over a blurred scrim.
3. **Navbar/bottom-nav on mobile** — `background: rgba(255,255,255,0.85)` with `backdrop-filter: blur(20px)`.

Cards are NOT glass by default. They are solid `--surface` with a hard 1px border. Glass is earned, not reflexive.

### Brutalist structure

- **Hard borders**: `1px solid var(--border-strong)` on cards, inputs, dividers. No soft shadows on these.
- **Mono labels**: section markers in JetBrains Mono, uppercase, `letter-spacing: 0.05em` — e.g., `// MATCH REASON`, `// DEADLINE`.
- **Stark contrast blocks**: the sidebar is a solid dark block against the light canvas. No gradient transition.
- **Visible grid**: card grids show their structure — consistent gutters, aligned edges.

### Shadows

Minimal. Two levels:
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.04)` — subtle card lift.
- `--shadow-lg`: `0 8px 32px rgba(0,0,0,0.08)` — panels, modals, floating elements.

No drop shadows on text. No colored shadows. No glow effects.

### Motion

- Duration: `150ms` for micro-interactions, `250ms` for panel transitions, `400ms` max for overlays.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) for entering; `cubic-bezier(0.4, 0, 1, 1)` for exiting.
- Transform/opacity only. Never animate width/height/top/left.
- `@media (prefers-reduced-motion: reduce)`: all transitions become instant or crossfade.
- Stagger list entrances by `40ms` per item, max 8 items staggered.
- Splash screen: max 2s total, with reduced-motion instant fade.

## Components

### Buttons

| Class | Background | Text | Border | Usage |
|-------|-----------|------|--------|-------|
| `.btn-primary` | `--accent` | `--on-accent` | none | Primary CTA (Run, Apply, Save) |
| `.btn-secondary` | `--surface` | `--ink` | `1px solid --border-strong` | Secondary actions (Refresh, Retry) |
| `.btn-ghost` | transparent | `--muted` | `1px solid --border` | Tertiary (Clear All, dismiss) |
| `.btn-danger` | `--danger` | white | none | Destructive (Delete) |

All buttons: `border-radius: 10px`, `padding: 0.5rem 1rem`, `font-size: 0.8125rem`, `font-weight: 600`, `min-height: 40px` (touch target). Hover: darken bg. Active: `scale(0.97)`. Focus: `2px` ring in `--accent`.

### Cards

Solid `--surface`, `1px solid --border`, `border-radius: 14px`, `padding: 24px`. Hover: border shifts to `--border-strong`. No glass, no gradient. The match score and reasoning text get visual primacy inside the card.

### Inputs

`--surface-2` background, `1px solid --border-strong`, `border-radius: 10px`, `padding: 0.625rem 1rem`. Focus: border → `--accent`, `box-shadow: 0 0 0 3px var(--accent-soft)`. Placeholder: `--muted` (must hit 4.5:1 — verify).

### Badges

`border-radius: 999px`, `padding: 0.125rem 0.5rem`, `font-size: 0.6875rem`, `font-weight: 600`. Platform badges use tinted backgrounds (accent-soft, urgent-tint, success-tint) with matching text colors. Always paired with an icon or text label.

### Match score visualization

NOT a thin progress bar. The match score is a bold, large number (Space Grotesk 700, `1.75rem`) with a circular or arc indicator. Color-coded: ≥70% accent blue, 40-69% urgent orange, <40% muted. Always accompanied by the reasoning text — the reasoning IS the product.

## Page Specifications

### Dashboard

- Page title + subtitle at top, with "Clear All" as a ghost button.
- FilterBar: search input (left, flexible), platform select, eligible toggle, sort select — all in a single row that wraps on mobile. Mono label `// FILTERS` above.
- Opportunity grid: `repeat(auto-fit, minmax(300px, 1fr))`. Cards show platform badge, rank, title, company, deadline (with urgency color), match score (bold number + arc), reasoning text (prominent, 2-line clamp), tags, Tailor + Apply buttons.
- Pagination: prev/next with page number, centered.
- Empty state: centered icon + heading + helper text + CTA to run agent.

### Profile

- Single column (max-w-2xl) when no resume uploaded.
- Two-column grid (form left, PDF viewer right) when resume is active. PDF panel is sticky.
- Resume upload: drag-drop zone with brutalist dashed border. Parsing state shows a scanning animation (redesigned — not the old orb-based FX).
- Form fields: name, email, CGPA, skills (tag input), preferred roles (tag input), preferred locations (tag input), resume text (textarea).
- AI-filled fields highlighted with accent-soft background + accent border + "AI filled" mono label.
- Save button full-width, primary.

### RunAgent

- Pipeline trigger card: title, description, Run Now + Send Digest buttons.
- Pre-run config: max opportunities input + process-all toggle. Mono labels.
- AI provider tabs: NVIDIA / GLM / Custom. Custom fields expand inline.
- Live run stats: 3 stat cards (Found, Eligible, Duration) with bold Space Grotesk numbers.
- Progress log: terminal-style, JetBrains Mono, dark background (`--dark-surface`), auto-scroll.
- Run history: clean table with status badges, dates, durations, counts.

### Tailor Panel

- Slides in from right, max-width 520px, `--dark` background with glassmorphism.
- Scrim: `rgba(14,15,26,0.5)` with `backdrop-filter: blur(8px)`.
- Header: AI Tailor label (mono), opportunity title, re-analyze + close buttons.
- 5 sections: matching skills (success-tinted), missing skills (urgent-tinted), bullet points (numbered, copyable), cover letter pitch (quote-styled, copyable), pro tip.
- Footer: Apply Now button (primary, full-width).
- Escape key closes. Cache survives navigation.

### GLM Indicator

- Floating bottom-right, glassmorphic light pill.
- Active: accent-tinted, pulsing dot, "AI busy" label.
- Idle: invisible (no DOM impact).
- `aria-live="polite"` for screen readers.

### Splash Screen

- Full-screen `--dark` overlay.
- Brand wordmark in Space Grotesk 700, large, centered.
- Tagline in Inter, muted.
- Loading indicator: 3 dots or a minimal progress bar.
- Max 2s. Slides up and fades. Reduced-motion: instant fade.

## Anti-patterns (do NOT ship)

- No gradient text (`background-clip: text` + gradient).
- No glassmorphism on every card — only sidebar, Tailor panel, mobile nav.
- No side-stripe borders (`border-left` accent on cards).
- No identical card grids with icon + heading + text repeated endlessly.
- No uppercase tracked eyebrow above every section.
- No numbered section markers (01/02/03) unless the section is an actual sequence.
- No floating orbs, particles, or decorative background FX.
- No cream/sand/beige backgrounds.
- No generic indigo-violet-pink gradients.
- No text that overflows its container at any breakpoint.
