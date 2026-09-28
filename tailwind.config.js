/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#111827',
          800: '#1f2937',
          600: '#4b5563'
        }
      }
    }
  },
  plugins: []
};
