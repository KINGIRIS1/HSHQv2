/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}" // Quét các file ở root như App.tsx, index.tsx
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}