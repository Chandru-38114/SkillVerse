/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12151B",
        paper: "#F6F4EE",
        moss: "#2F5D50",
        moss2: "#3F7D6C",
        clay: "#C4622D",
        gold: "#C9A24B",
        line: "#D9D4C6",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        sk: "10px",
      },
    },
  },
  plugins: [],
}