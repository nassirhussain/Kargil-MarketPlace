/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        mint: '#EEE9DF',
        teal: '#B08D57',
        coral: '#B08D57',
        cream: '#F7F5F0'
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
}
