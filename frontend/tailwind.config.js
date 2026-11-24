/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        line: "var(--line)",
        fg: {
          DEFAULT: "var(--fg)",
          muted: "var(--fg-muted)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          fg: "var(--brand-fg)",
          soft: "var(--brand-soft)",
        },
      },
      fontFamily: {
        head: ["Lexend", "sans-serif"],
        sans: ['"Source Sans 3"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
