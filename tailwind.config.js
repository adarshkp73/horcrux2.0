/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pure-black': '#000000',
        'pure-white': '#FFFFFF',
        'night': '#111111',
        'grey-dark': '#333333',
        'grey-mid': '#888888',
        'grey-light': '#F5F5F5',
      }
    },
  },
  plugins: [],
}