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
        accent:     "rgb(var(--color-accent)     / <alpha-value>)",
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
        display:   ["Fraunces", "Georgia", "serif"],
        body:      ["Inter", "system-ui", "sans-serif"],
        mono:      ["'JetBrains Mono'", "monospace"],
        // Legacy alias - points at the same stack as display so nothing breaks.
        cormorant: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        sk:    "10px", /* buttons */
        'sk-md': "12px", /* inputs, small panels */
        'sk-lg': "16px", /* cards */
      },
      boxShadow: {
        'hard-1':     '0 3px 0 rgb(var(--color-line))',
        'hard-2':     '0 4px 0 rgb(var(--color-line)), 0 7px 0 rgb(var(--color-ink))',
        'hard-3':     '0 5px 0 rgb(var(--color-ink))',
        'hard-press': '0 2px 0 rgb(var(--color-line)), 0 4px 0 rgb(var(--color-ink))',
        // Aliases kept for backward compat
        'elev-1': '0 3px 0 rgb(var(--color-line))',
        'elev-2': '0 4px 0 rgb(var(--color-line)), 0 7px 0 rgb(var(--color-ink))',
        'elev-3': '0 5px 0 rgb(var(--color-ink))',
      },
    },
  },
  plugins: [],
}
