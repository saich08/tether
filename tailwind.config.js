/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f9fc',
          100: '#f0f2f8',
          200: '#e2e6f3',
          300: '#c8cfe8',
          400: '#a8b3d8',
          800: '#1a1d2e',
          850: '#141625',
          900: '#0e1020',
          950: '#090b15'
        },
        accent: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5'
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
