/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ["'Inter'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        background: 'oklch(0.98 0.003 250)',
        surface: 'oklch(1 0 0)',
        surface2: 'oklch(0.96 0.005 250)',
        ink: 'oklch(0.18 0.015 250)',
        ink2: 'oklch(0.30 0.015 250)',
        muted: 'oklch(0.48 0.015 250)',
        border: 'oklch(0.92 0.008 250)',
        'border-strong': 'oklch(0.85 0.01 250)',
        accent: 'oklch(0.50 0.25 255)',
        'accent-hover': 'oklch(0.45 0.25 255)',
        'accent-soft': 'oklch(0.95 0.03 255)',
        'on-accent': 'oklch(1 0 0)',
        urgent: 'oklch(0.62 0.22 35)',
        'urgent-soft': 'oklch(0.95 0.04 35)',
        success: 'oklch(0.55 0.15 145)',
        'success-soft': 'oklch(0.95 0.04 145)',
        danger: 'oklch(0.55 0.22 25)',
        'danger-soft': 'oklch(0.95 0.04 25)',
        dark: 'oklch(0.15 0.015 250)',
        'dark-surface': 'oklch(0.20 0.015 250)',
        'on-dark': 'oklch(0.95 0.01 250)',
        'on-dark-muted': 'oklch(0.65 0.015 250)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        lg: '0 8px 32px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
