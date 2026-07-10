import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, User, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, id: 'nav-dashboard' },
  { to: '/profile', label: 'Profile',   icon: User,            id: 'nav-profile'   },
  { to: '/run',     label: 'Run Agent', icon: Zap,             id: 'nav-run'        },
]

export default function Navbar() {
  const { pathname } = useLocation()
  
  const activeIdx = NAV_ITEMS.findIndex(item =>
    item.to === '/'
      ? pathname === '/'
      : pathname.startsWith(item.to.split('#')[0])
  )

  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex justify-center pointer-events-none">
        <motion.nav
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-full border shadow-2xl pointer-events-auto"
          style={{
            backgroundColor: 'rgba(15, 15, 20, 0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
          }}
        >
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon
            const isActive = activeIdx === idx
            const isHovered = hoveredIdx === idx
            const isRunAgent = item.to === '/run'

            return (
              <Link
                key={item.to}
                to={item.to}
                id={item.id}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="relative flex items-center justify-center outline-none"
              >
                <motion.div
                  layout
                  className={`flex items-center justify-center h-12 rounded-full relative z-10 transition-colors duration-200 ${
                    isActive ? 'px-4' : 'px-0 w-12'
                  } ${
                    isActive 
                      ? 'text-white bg-blue-600'
                      : isRunAgent 
                        ? 'text-blue-400 bg-transparent hover:bg-blue-500/10' 
                        : 'text-muted bg-transparent hover:text-ink2 hover:bg-white/5'
                  }`}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <Icon 
                    size={isRunAgent ? 19 : 18} 
                    strokeWidth={isActive || (isRunAgent && isHovered) ? 2.5 : 2}
                    className={`relative z-10 shrink-0 transition-all duration-300 ${
                      isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 
                      isRunAgent && isHovered ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''
                    }`}
                  />
                  
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        layout
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-wide relative z-10"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                {/* Subtle outer glow for Run Agent when active or hovered */}
                {isRunAgent && (isActive || isHovered) && (
                  <motion.div
                    layoutId="runAgentGlow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-full bg-blue-500/20 blur-[8px] pointer-events-none"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            )
          })}
        </motion.nav>
      </div>
    </>
  )
}

