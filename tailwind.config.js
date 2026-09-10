/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables so light/dark stay in sync.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        section: 'rgb(var(--c-section) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--c-brand-ink) / <alpha-value>)',
        protein: 'rgb(var(--c-protein) / <alpha-value>)',
        carbs: 'rgb(var(--c-carbs) / <alpha-value>)',
        fat: 'rgb(var(--c-fat) / <alpha-value>)',
        burn: 'rgb(var(--c-burn) / <alpha-value>)',
        water: 'rgb(var(--c-water) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        insight: 'rgb(var(--c-insight) / <alpha-value>)',
        achievement: 'rgb(var(--c-achievement) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(.96) translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.32,.72,0,1)',
        'fade-in': 'fade-in .2s ease-out',
        'pop-in': 'pop-in .24s cubic-bezier(.32,.72,0,1) both',
      },
    },
  },
  plugins: [],
}
