// ────────────────────────────────────────────────────────────────
// components/Navbar.jsx — Floating bottom dock
// Apple Dynamic Island × macOS Dock × Arc Browser vibes.
// Features: spring capsule indicator, magnetic magnification,
// cursor-proximity tilt, scroll-collapse, idle fade.
// ────────────────────────────────────────────────────────────────

import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, User, Zap, Settings } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

const NAV_ITEMS = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, id: 'nav-dashboard' },
  { to: '/profile', label: 'Profile',   icon: User,            id: 'nav-profile'   },
  { to: '/run',     label: 'Run Agent', icon: Zap,             id: 'nav-run',      isHero: true },
  { to: '/profile#settings', label: 'Settings', icon: Settings, id: 'nav-settings' },
]

// Spring lerp: smooth interpolation with configurable stiffness
function springLerp(current, target, stiffness = 0.18) {
  return current + (target - current) * stiffness
}

export default function Navbar() {
  const { pathname } = useLocation()

  // ── State ─────────────────────────────────────────────────────
  const [capsuleX, setCapsuleX]         = useState(null)   // capsule slide position
  const [capsuleW, setCapsuleW]         = useState(0)
  const [hoverIdx, setHoverIdx]         = useState(null)
  const [mouseXRel, setMouseXRel]       = useState(null)   // cursor x relative to dock center
  const [scrolled, setScrolled]         = useState(false)
  const [idle, setIdle]                 = useState(false)
  const [tilt, setTilt]                 = useState(0)
  const [isNear, setIsNear]             = useState(false)
  const [clickIdx, setClickIdx]         = useState(null)   // for click spring pop
  const [runPulse, setRunPulse]         = useState(false)

  // ── Refs ──────────────────────────────────────────────────────
  const dockRef      = useRef(null)
  const itemRefs     = useRef([])
  const idleTimer    = useRef(null)
  const rafRef       = useRef(null)
  const capsuleAnim  = useRef({ x: null, w: 0 })
  const frameActive  = useRef(false)

  // ── Active route index ────────────────────────────────────────
  const activeIdx = NAV_ITEMS.findIndex(item =>
    item.to === pathname || (item.to !== '/' && pathname.startsWith(item.to.split('#')[0]))
  )

  // ── Capsule spring animation ───────────────────────────────────
  const animateCapsule = useCallback(() => {
    const el = itemRefs.current[activeIdx]
    if (!el || !dockRef.current) return

    const dockRect = dockRef.current.getBoundingClientRect()
    const itemRect = el.getBoundingClientRect()
    const targetX  = itemRect.left - dockRect.left + dockRect.scrollLeft
    const targetW  = itemRect.width

    if (capsuleAnim.current.x === null) {
      capsuleAnim.current = { x: targetX, w: targetW }
      setCapsuleX(targetX)
      setCapsuleW(targetW)
      return
    }

    if (!frameActive.current) {
      frameActive.current = true
      const tick = () => {
        capsuleAnim.current.x = springLerp(capsuleAnim.current.x, targetX, 0.22)
        capsuleAnim.current.w = springLerp(capsuleAnim.current.w, targetW, 0.22)
        setCapsuleX(capsuleAnim.current.x)
        setCapsuleW(capsuleAnim.current.w)

        const dxDone = Math.abs(capsuleAnim.current.x - targetX) < 0.5
        const dwDone = Math.abs(capsuleAnim.current.w - targetW) < 0.5
        if (dxDone && dwDone) {
          frameActive.current = false
        } else {
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [activeIdx])

  useEffect(() => {
    // Small delay so DOM has rendered
    const t = setTimeout(animateCapsule, 10)
    return () => { clearTimeout(t); cancelAnimationFrame(rafRef.current) }
  }, [animateCapsule, pathname])

  // ── Scroll collapse ───────────────────────────────────────────
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 60)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Idle fade ─────────────────────────────────────────────────
  const resetIdle = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 4000)
  }, [])

  useEffect(() => {
    resetIdle()
    window.addEventListener('mousemove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    return () => {
      clearTimeout(idleTimer.current)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
    }
  }, [resetIdle])

  // ── Cursor proximity (tilt + proximity awareness) ─────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!dockRef.current) return
      const rect = dockRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const dockY   = rect.top + rect.height / 2
      const dx = e.clientX - centerX
      const dy = e.clientY - dockY
      const dist = Math.sqrt(dx * dx + dy * dy)

      const NEAR_THRESHOLD = 160
      setIsNear(dist < NEAR_THRESHOLD)

      if (dist < NEAR_THRESHOLD) {
        // Tilt: max ±2deg, falls off with distance
        const tiltAmt = (dx / (rect.width / 2)) * 2 * Math.max(0, 1 - dist / NEAR_THRESHOLD)
        setTilt(tiltAmt)
        // Relative x for magnification math
        setMouseXRel(e.clientX - rect.left)
      } else {
        setTilt(0)
        setMouseXRel(null)
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ── Run hero pulse ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setRunPulse(p => !p)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  // ── Magnification math ────────────────────────────────────────
  function getItemScale(idx) {
    if (NAV_ITEMS[idx].isHero) return hoverIdx === idx ? 1.18 : 1.0
    if (mouseXRel === null || !dockRef.current) return 1
    const el = itemRefs.current[idx]
    if (!el || !dockRef.current) return 1
    const dockRect = dockRef.current.getBoundingClientRect()
    const itemRect = el.getBoundingClientRect()
    const itemCenterX = itemRect.left - dockRect.left + itemRect.width / 2
    const dist = Math.abs(mouseXRel - itemCenterX)
    const maxDist = 90
    const maxScale = 1.22
    if (dist > maxDist) return 1
    return 1 + (maxScale - 1) * Math.pow(1 - dist / maxDist, 2)
  }

  function getItemY(idx) {
    if (NAV_ITEMS[idx].isHero) return 0
    const scale = getItemScale(idx)
    return -(scale - 1) * 12  // lift proportional to magnification
  }

  function handleItemClick(idx) {
    setClickIdx(idx)
    setTimeout(() => setClickIdx(null), 300)
  }

  // ── Composed dock classes/styles ──────────────────────────────
  const dockOpacity = idle && !isNear ? 0.55 : 1
  const dockScale   = scrolled ? 0.93 : 1
  const dockBlur    = scrolled ? 50 : 36

  return (
    <>
      {/* Skip-to-content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ── Floating Dock ─────────────────────────────────────── */}
      <nav
        ref={dockRef}
        aria-label="Main navigation"
        style={{
          opacity: dockOpacity,
          transform: `scale(${dockScale}) rotate(${tilt}deg)`,
          backdropFilter: `blur(${dockBlur}px)`,
          WebkitBackdropFilter: `blur(${dockBlur}px)`,
          transition: 'opacity 0.6s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: [
            '0 8px 40px rgba(0,0,0,0.45)',
            '0 2px 8px rgba(0,0,0,0.3)',
            '0 0 0 1px rgba(255,255,255,0.08)',
            isNear
              ? '0 0 60px rgba(59,130,246,0.18), 0 16px 60px rgba(0,0,0,0.5)'
              : '0 0 30px rgba(59,130,246,0.08), 0 16px 40px rgba(0,0,0,0.4)',
          ].join(', '),
        }}
        className="dock-nav fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 px-3 py-2.5 rounded-full"
      >
        {/* Ambient glow underneath */}
        <div
          className="dock-glow pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(ellipse 80% 40% at 50% 110%, rgba(59,130,246,0.22), transparent)',
            filter: 'blur(4px)',
          }}
        />

        {/* Spring capsule active indicator */}
        {capsuleX !== null && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: capsuleX,
              width: capsuleW,
              top: 4,
              bottom: 4,
              borderRadius: 9999,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.18) 100%)',
              boxShadow: '0 0 16px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
              transition: 'none', // driven by RAF, not CSS
            }}
          />
        )}

        {/* Nav items */}
        {NAV_ITEMS.map((item, idx) => {
          const Icon    = item.icon
          const isActive = activeIdx === idx
          const isClick  = clickIdx === idx
          const scale    = getItemScale(idx)
          const yOff     = getItemY(idx)
          const isHero   = item.isHero

          return (
            <Link
              key={item.to}
              to={item.to}
              id={item.id}
              ref={el => itemRefs.current[idx] = el}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleItemClick(idx)}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                transform: isClick
                  ? `scale(0.88) translateY(${yOff}px)`
                  : `scale(${scale}) translateY(${yOff}px)`,
                transition: isClick
                  ? 'transform 0.12s cubic-bezier(0.4,0,1,1)'
                  : 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
                zIndex: isHero ? 2 : 1,
              }}
              className={`
                relative flex flex-col items-center justify-center rounded-full
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                ${isHero
                  ? 'w-16 h-16 mx-2'
                  : 'w-14 h-14'
                }
              `}
            >
              {/* Hero Run Agent: special glow ring + pulse */}
              {isHero && (
                <>
                  {/* Outer pulsing ring */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: 'transparent',
                      boxShadow: runPulse
                        ? '0 0 0 3px rgba(59,130,246,0.55), 0 0 28px rgba(59,130,246,0.35)'
                        : '0 0 0 2px rgba(59,130,246,0.28), 0 0 14px rgba(59,130,246,0.15)',
                      transition: 'box-shadow 1.1s ease-in-out',
                      borderRadius: 9999,
                    }}
                  />
                  {/* Hero bg disc */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #6366f1 100%)',
                      opacity: hoverIdx === idx ? 1 : 0.9,
                      boxShadow: hoverIdx === idx
                        ? '0 0 40px rgba(59,130,246,0.8), 0 0 80px rgba(59,130,246,0.3)'
                        : '0 0 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.2)',
                      transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                  {/* Ripple on click */}
                  {isClick && (
                    <div
                      className="absolute inset-0 rounded-full animate-ping pointer-events-none"
                      style={{ background: 'rgba(59,130,246,0.4)' }}
                    />
                  )}
                </>
              )}

              {/* Regular item hover glow */}
              {!isHero && hoverIdx === idx && (
                <div
                  className="absolute inset-1 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                    boxShadow: '0 0 12px rgba(59,130,246,0.2)',
                  }}
                />
              )}

              {/* Icon */}
              <Icon
                size={isHero ? 22 : 19}
                strokeWidth={isActive || isHero ? 2.2 : 1.8}
                style={{
                  color: isHero
                    ? '#ffffff'
                    : isActive
                      ? '#60a5fa'
                      : hoverIdx === idx
                        ? '#93c5fd'
                        : 'rgba(255,255,255,0.55)',
                  position: 'relative',
                  zIndex: 1,
                  filter: (isActive && !isHero)
                    ? 'drop-shadow(0 0 6px rgba(96,165,250,0.7))'
                    : isHero
                      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.6))'
                      : 'none',
                  transition: 'color 0.2s ease, filter 0.2s ease',
                }}
              />

              {/* Label */}
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  position: 'relative',
                  zIndex: 1,
                  marginTop: isHero ? 2 : 1,
                  color: isHero
                    ? 'rgba(255,255,255,0.85)'
                    : isActive
                      ? '#60a5fa'
                      : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.2s ease',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
