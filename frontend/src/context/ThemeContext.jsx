import { createContext, useContext, useEffect, useState } from "react";

export const VALID_THEMES = ["warm", "blueprint", "slate"];

/**
 * Progressive Depth mapping per docs/design.md §1:
 * - /          -> warm
 * - /lapor     -> blueprint
 * - /tiket/:id -> blueprint
 * - /dinas     -> warm
 * - /rapor     -> warm (light Catatan Kerja page)
 */
export function getThemeForPath(pathname = "/") {
  if (pathname.startsWith("/lapor") || pathname.startsWith("/tiket")) {
    return "blueprint";
  }
  return "warm";
}

const ThemeContext = createContext({
  theme: "warm",
  setTheme: () => {},
});

export function ThemeProvider({ initialTheme = "warm", children }) {
  const [theme, setThemeState] = useState(() =>
    VALID_THEMES.includes(initialTheme) ? initialTheme : "warm"
  );

  const setTheme = (nextTheme) => {
    if (VALID_THEMES.includes(nextTheme)) {
      setThemeState(nextTheme);
    }
  };

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
