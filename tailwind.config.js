/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04060F',
          900: '#050816',
          850: '#070B18',
          800: '#0A0F1F',
          700: '#101730',
        },
        accent: {
          DEFAULT: '#4F46E5',
          soft: '#6366F1',
          light: '#818CF8',
          sky: '#60A5FA',
          blue: '#2563EB',
          cyan: '#22D3EE',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 50px -12px rgba(99, 102, 241, 0.5)',
        'glow-sm': '0 0 24px -8px rgba(99, 102, 241, 0.4)',
        card: '0 24px 70px -30px rgba(0, 0, 0, 0.75)',
      },
      animation: {
        'spin-slow': 'spin 16s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3.2s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        blink: 'blink 1.1s steps(1) infinite',
        dash: 'dash 4s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        dash: {
          to: { strokeDashoffset: '-40' },
        },
      },
    },
  },
  plugins: [],
}
