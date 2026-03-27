/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'retro-bg': '#c0c0c0', // Windows 95 grey
        'retro-blue': '#000080', // Title bar blue
        'retro-pink': '#ff00ff', // Accent pink
        'retro-yellow': '#ffff00', // Warning yellow
        'retro-green': '#4f954fff', // Success green
        'pastel-pink': '#fbcfe8',
        'pastel-yellow': '#fef08a',
        'pastel-blue': '#bfdbfe',
        'window-bg': '#ffffff',
      },
      boxShadow: {
        'window': 'inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #ffffff',
        'button': 'inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
        'button-pressed': 'inset -1px -1px #ffffff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080',
      },
    },
  },
  plugins: [],
}
