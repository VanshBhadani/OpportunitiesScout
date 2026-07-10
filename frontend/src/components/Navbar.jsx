// ────────────────────────────────────────────────────────────────
// components/Navbar.jsx — Refined floating dock
// Thin rounded rectangle · Spring capsule indicator
// Secondary nav items understated · Run Agent subtly primary
// All interaction animations preserved from v1
// ────────────────────────────────────────────────────────────────

import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, User, Zap } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

const NAV_ITEMS = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, id: 'nav-dashboard' },
  { to: '/profile', label: 'Profile',   icon: User,            id: 'nav-profile'   },
  { to: '/run',     label: 'Run Agent', icon: Zap,             id: 'nav-run'        },
]

function springLerp(current, target, stiffness = 0.22) {
  return current + (target - current) * stiffness
}

export default function Navbar() {
  const { pathname } = useLocation()

  // ── State ─────────────────────────────────────────────────────
  const [capsuleX,   setCapsuleX]   = useState(null)
  const [capsuleW,   setCapsuleW]   = useState(0)
  const [hoverIdx,   setHoverIdx]   = useState(null)
  const [mouseXRel,  setMouseXRel]  = useState(null)
  const [scrolled,   setScrolled]   = useState(false)
  const [idle,       setIdle]       = useState(false)
  const [tilt,       setTilt]       = useState(0)
  const [isNear,     setIsNear]     = useState(false)
  const [clickIdx,   setClickIdx]   = useState(null)

  // ── Refs ──────────────────────────────────────────────────────
  const dockRef     = useRef(null)
  const itemRefs    = useRef([])
  const idleTimer   = useRef(null)
  const rafRef      = useRef(null)
  const capsuleAnim = useRef({ x: null, w: 0 })
  const frameActive = useRef(false)

  // ── Active route ──────────────────────────────────────────────
  const activeIdx = NAV_ITEMS.findIndex(item =>
    item.to === '/'
      ? pathname === '/'
      : pathname.startsWith(item.to.split('#')[0])
  )

  // ── Spring capsule (RAF-driven, no CSS transition) ─────────────
  const animateCapsule = useCallback(() => {
    const el = itemRefs.current[activeIdx]
    if (!el || !dockRef.current) return

    const dockRect = dockRef.current.getBoundingClientRect()
    const itemRect = el.getBoundingClientRect()
    const targetX  = itemRect.left - dockRect.left
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
        capsuleAnim.current.x = springLerp(capsuleAnim.current.x, targetX, 0.2)
        capsuleAnim.current.w = springLerp(capsuleAnim.current.w, targetW, 0.2)
        setCapsuleX(capsuleAnim.current.x)
        setCapsuleW(capsuleAnim.current.w)
        const done =
          Math.abs(capsuleAnim.current.x - targetX) < 0.4 &&
          Math.abs(capsuleAnim.current.w - targetW) < 0.4
        if (done) { frameActive.current = false }
        else { rafRef.current = requestAnimationFrame(tick) }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [activeIdx])

  useEffect(() => {
    const t = setTimeout(animateCapsule, 12)
    return () => { clearTimeout(t); cancelAnimationFrame(rafRef.current) }
  }, [animateCapsule, pathname])

  // ── Scroll collapse ───────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
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
    window.addEventListener('keydown',   resetIdle, { passive: true })
    return () => {
      clearTimeout(idleTimer.current)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown',   resetIdle)
    }
  }, [resetIdle])

  // ── Cursor proximity: tilt + magnification ─────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!dockRef.current) return
      const rect    = dockRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top  + rect.height / 2
      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const NEAR = 140

      setIsNear(dist < NEAR)
      if (dist < NEAR) {
        setTilt((dx / (rect.width / 2)) * 1.5 * Math.max(0, 1 - dist / NEAR))
        setMouseXRel(e.clientX - rect.left)
      } else {
        setTilt(0)
        setMouseXRel(null)
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ── Magnification (uniform across all items) ─────────────────
  function getItemScale(idx) {
    if (mouseXRel === null || !dockRef.current) return 1
    const el = itemRefs.current[idx]
    if (!el) return 1
    const dockRect    = dockRef.current.getBoundingClientRect()
    const itemRect    = el.getBoundingClientRect()
    const itemCenterX = itemRect.left - dockRect.left + itemRect.width / 2
    const dist        = Math.abs(mouseXRel - itemCenterX)
    const maxDist     = 80
    const maxScale    = 1.11
    if (dist > maxDist) return 1
    return 1 + (maxScale - 1) * Math.pow(1 - dist / maxDist, 2)
  }

  function getItemY(idx) {
    return -(getItemScale(idx) - 1) * 10
  }

  function handleItemClick(idx) {
    setClickIdx(idx)
    setTimeout(() => setClickIdx(null), 280)
  }

  // ── Dock-level styles ─────────────────────────────────────────
  const dockOpacity = idle && !isNear ? 0.5 : 1
  const dockScale   = scrolled ? 0.94 : 1
  const dockBlur    = scrolled ? 48 : 32

  return (
    <>
      {/* Accessibility: skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ── Dock ─────────────────────────────────────────────────── */}
      <nav
        ref={dockRef}
        aria-label="Main navigation"
        style={{
          opacity:          dockOpacity,
          transform:        `translateX(-50%) scale(${dockScale}) rotate(${tilt}deg)`,
          backdropFilter:   `blur(${dockBlur}px)`,
          WebkitBackdropFilter: `blur(${dockBlur}px)`,
          transition:       'opacity 0.5s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: [
            '0 4px 24px rgba(0,0,0,0.5)',
            '0 1px 0 rgba(255,255,255,0.06) inset',
            isNear
              ? '0 0 0 1px rgba(255,255,255,0.1), 0 8px 48px rgba(0,0,0,0.55), 0 0 40px rgba(59,130,246,0.10)'
              : '0 0 0 1px rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.45)',
          ].join(', '),
          /* Thin elongated rectangle: br=32px */
          borderRadius: '32px',
        }}
        className="dock-nav fixed bottom-6 left-1/2 z-[100] flex items-center px-2 py-0"
        style2={{ height: '62px' }}
      >
        {/* Ambient glow projected below the dock */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2"
          style={{
            width: '60%',
            height: '20px',
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)',
            filter: 'blur(8px)',
            transition: 'opacity 0.4s ease',
            opacity: isNear ? 1 : 0.5,
          }}
        />

        {/* Spring-driven active capsule */}
        {capsuleX !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              left:         capsuleX,
              width:        capsuleW,
              top:          8,
              bottom:       8,
              borderRadius: '20px',
              background:   'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(99,102,241,0.14) 100%)',
              boxShadow:    '0 0 12px rgba(59,130,246,0.22), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          />
        )}

        {/* Nav items */}
        {NAV_ITEMS.map((item, idx) => {
          const Icon     = item.icon
          const isActive = activeIdx === idx
          const isClick  = clickIdx === idx
          const isHov    = hoverIdx === idx
          const scale    = getItemScale(idx)
          const yOff     = getItemY(idx)

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
                  ? `scale(0.90) translateY(${yOff}px)`
                  : `scale(${scale}) translateY(${yOff}px)`,
                transition: isClick
                  ? 'transform 0.10s cubic-bezier(0.4,0,1,1)'
                  : 'transform 0.22s cubic-bezier(0.22,1,0.36,1)',
                zIndex:     isHero ? 2 : 1,
                /* Hero gets a touch more horizontal padding so it reads as distinct */
                padding:    isHero ? '0 10px' : '0 6px',
                height:     '62px',
                display:    'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position:   'relative',
                borderRadius: '24px',
                minWidth:   isHero ? '72px' : '60px',
              }}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0"
            >

              {/* ── Hover highlight (all items uniform) ──────── */}
              {isHov && !isActive && (
                <div
                  aria-hidden="true"
                  style={{
                    position:     'absolute',
                    inset:        '12px 4px',
                    borderRadius: '12px',
                    background:   'rgba(255,255,255,0.04)',
                    transition:   'opacity 0.15s ease',
                  }}
                />
              )}

              {/* Click ripple (all items) */}
              {isClick && (
                <div
                  aria-hidden="true"
                  style={{
                    position:     'absolute',
                    inset:        '12px 4px',
                    borderRadius: '12px',
                    background:   'rgba(59,130,246,0.18)',
                    animation:    'dock-expand 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
                  }}
                />
              )}

              {/* ── Icon ─────────────────────────────────────────── */}
              <Icon
                size={17}
                strokeWidth={isActive ? 2.1 : 1.7}
                aria-hidden="true"
                style={{
                  position:   'relative',
                  zIndex:     1,
                  color: isActive
                    ? 'rgba(147,197,253,0.95)'    /* blue-300 — active page only */
                    : isHov
                      ? 'rgba(203,213,225,0.85)'  /* slate-300 on hover */
                      : 'rgba(148,163,184,0.50)',  /* slate-400 dim idle */
                  filter: isActive
                    ? 'drop-shadow(0 0 4px rgba(147,197,253,0.45))'
                    : 'none',
                  transition: 'color 0.18s ease, filter 0.18s ease',
                }}
              />

              {/* ── Label ────────────────────────────────────────── */}
              <span
                aria-hidden="true"
                style={{
                  position:      'relative',
                  zIndex:        1,
                  marginTop:     '3px',
                  fontSize:      '9.5px',
                  fontWeight:    isActive ? 600 : 500,
                  letterSpacing: '0.045em',
                  fontFamily:    'Inter, system-ui, sans-serif',
                  textTransform: 'uppercase',
                  color: isActive
                    ? 'rgba(147,197,253,0.90)'    /* blue-300 — active page only */
                    : isHov
                      ? 'rgba(203,213,225,0.70)'
                      : 'rgba(100,116,139,0.55)',  /* dim idle */
                  transition: 'color 0.18s ease, font-weight 0.15s ease',
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
