/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0B0E14",
          card: "#151921",
          border: "#2A2F3A"
        },
        neon: {
          blue: "#00F0FF",
          purple: "#BC13FE",
          green: "#00FF94"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"], // Ensure a good mono font is used if available
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    }
  },
  plugins: []
};
