/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- ApexMatch "Cyber-Quant" design system ---
        obsidian: {
          DEFAULT: '#0b0e14',
          deep: '#090a0f',
        },
        surface: {
          // legacy scale kept for older components; 800/700 remap onto the new brand surface/border
          950: '#090a0f',
          900: '#0b0e14',
          800: '#141923',
          700: '#232b3e',
          600: '#2c3549',
        },
        neon: {
          green: '#00ff87',
          magenta: '#ff2a85',
          magenta2: '#ff2e93',
        },
        electric: {
          blue: '#38bdf8',
        },
        ink: {
          muted: '#94a3b8',
        },
        // legacy alias so older `accent-*` classes keep resolving during the rebrand
        accent: {
          emerald: '#00ff87',
          violet: '#ff2a85',
          amber: '#facc15',
          rose: '#ff2a85',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(148,163,184,0.08), 0 8px 24px -8px rgba(0,0,0,0.5)',
        'glow-green': '0 0 0 1px rgba(0,255,135,0.25), 0 0 24px -4px rgba(0,255,135,0.35)',
        'glow-magenta': '0 0 0 1px rgba(255,42,133,0.3), 0 0 28px -4px rgba(255,42,133,0.4)',
        'glow-blue': '0 0 0 1px rgba(56,189,248,0.25), 0 0 24px -6px rgba(56,189,248,0.35)',
      },
      dropShadow: {
        'neon-green': '0 0 10px rgba(0,255,135,0.4)',
        'neon-magenta': '0 0 10px rgba(255,42,133,0.4)',
        'neon-blue': '0 0 10px rgba(56,189,248,0.4)',
      },
    },
  },
  plugins: [],
};
