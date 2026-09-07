import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "moneycontrol_theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateSettings } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    } catch {
      return "system";
    }
  });

  // Once the logged-in user's saved preference loads, it becomes the
  // source of truth (in case they set it from another device).
  useEffect(() => {
    if (user?.theme && user.theme !== theme) {
      setThemeState(user.theme);
      try {
        localStorage.setItem(STORAGE_KEY, user.theme);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    if (user) {
      updateSettings({ theme: next }).catch(() => {
        // best-effort sync; the local preference still applies
      });
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
