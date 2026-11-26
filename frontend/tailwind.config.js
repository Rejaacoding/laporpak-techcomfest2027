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
        semantic: {
          success: "var(--semantic-success)",
          "success-soft": "var(--semantic-success-soft)",
          warning: "var(--semantic-warning)",
          "warning-soft": "var(--semantic-warning-soft)",
          error: "var(--semantic-error)",
          "error-soft": "var(--semantic-error-soft)",
          info: "var(--semantic-info)",
          "info-soft": "var(--semantic-info-soft)",
        },
        status: {
          open: "var(--status-open)",
          "in-progress": "var(--status-in-progress)",
          "pending-validation": "var(--status-pending-validation)",
          closed: "var(--status-closed)",
          "auto-closed": "var(--status-auto-closed)",
          overdue: "var(--status-overdue)",
          disputed: "var(--status-disputed)",
          escalated: "var(--status-escalated)",
          "out-of-scope": "var(--status-out-of-scope)",
          "rejected-spam": "var(--status-rejected-spam)",
        },
      },
      fontFamily: {
        head: ["Lexend", "sans-serif"],
        sans: ['"Source Sans 3"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",   /* 12px — Inputs & Buttons */
        "2xl": "1rem",   /* 16px — Cards & Modals */
        "3xl": "1.5rem", /* 24px — Frames & Mobile Sheets */
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        popover: "var(--shadow-popover)",
        modal: "var(--shadow-modal)",
      },
    },
  },
  plugins: [],
};
