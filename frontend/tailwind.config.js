/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary semantic tokens (CSS-variable driven, auto-switch light/dark)
        brand:      "rgb(var(--color-brand)      / <alpha-value>)",
        brand2:     "rgb(var(--color-brand2)     / <alpha-value>)",
        brandLight: "rgb(var(--color-brandLight) / <alpha-value>)",
        // Aliases kept for backward compat
        moss:       "rgb(var(--color-brand)      / <alpha-value>)",
        moss2:      "rgb(var(--color-brand2)     / <alpha-value>)",
        mossLight:  "rgb(var(--color-brandLight) / <alpha-value>)",
        // Neutral palette
        paper:      "rgb(var(--color-paper)      / <alpha-value>)",
        surface:    "rgb(var(--color-surface)    / <alpha-value>)",
        // Elevated surface — modals, dropdowns, selected panels, popovers
        lift:       "rgb(var(--color-lift)       / <alpha-value>)",
        ink:        "rgb(var(--color-ink)        / <alpha-value>)",
        clay:       "rgb(var(--color-clay)       / <alpha-value>)",
        line:       "rgb(var(--color-line)       / <alpha-value>)",
        gold:       "rgb(var(--color-gold)       / <alpha-value>)",
        goldLight:  "rgb(var(--color-goldLight)  / <alpha-value>)",
        // Chat bubble tokens — sent / received
        bubbleMe:   "rgb(var(--color-bubbleMe)   / <alpha-value>)",
        bubbleThem: "rgb(var(--color-bubbleThem) / <alpha-value>)",
        cert: {
          bg:        "#F8F7F2",
          primary:   "#166534",
          secondary: "#15803D",
          light:     "#DCFCE7",
          text1:     "#17201B",
          text2:     "#4B5563",
        },
      },
      fontFamily: {
        display:   ["'Fraunces'", "serif"],
        body:      ["'Inter'", "sans-serif"],
        mono:      ["'JetBrains Mono'", "monospace"],
        cormorant: ["'Cormorant Garamond'", "serif"],
      },
      borderRadius: {
        sk: "10px",
      },
      boxShadow: {
        'elev-1': '0 1px 3px 0 rgb(0 0 0 / 0.12), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'elev-2': '0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
        'elev-3': '0 10px 15px -3px rgb(0 0 0 / 0.20), 0 4px 6px -4px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
}
