/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#10b981",
        brand2: "#059669",
        brandLight: "#d1fae5",
        moss: "#10b981",
        moss2: "#059669",
        mossLight: "#d1fae5",
        gold: "#d97706",
        goldLight: "#fef3c7",
        paper: "#FAFAF9",
        ink: "#0f172a",
        clay: "#64748b",
        line: "#e2e8f0",
        cert: {
          bg: "#F8F7F2",
          primary: "#166534",
          secondary: "#15803D",
          light: "#DCFCE7",
          text1: "#17201B",
          text2: "#4B5563"
        }
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        cormorant: ["'Cormorant Garamond'", "serif"],
      },
      borderRadius: {
        sk: "10px",
      }
    }
  },
  plugins: [],
}
