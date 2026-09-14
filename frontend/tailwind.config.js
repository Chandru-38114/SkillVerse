/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        brand2: "rgb(var(--color-brand2) / <alpha-value>)",
        brandLight: "rgb(var(--color-brandLight) / <alpha-value>)",
        moss: "rgb(var(--color-brand) / <alpha-value>)",
        moss2: "rgb(var(--color-brand2) / <alpha-value>)",
        mossLight: "rgb(var(--color-brandLight) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        goldLight: "rgb(var(--color-goldLight) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        clay: "rgb(var(--color-clay) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
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
