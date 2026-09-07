import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import es from "../i18n/es";
import en from "../i18n/en";
import type { TranslationKey } from "../i18n/es";
import { useAuth } from "./AuthContext";

export type Language = "es" | "en";

const STORAGE_KEY = "moneycontrol_language";
const dictionaries: Record<Language, Record<TranslationKey, string>> = { es, en };

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, updateSettings } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Language | null) ?? "es";
    } catch {
      return "es";
    }
  });

  useEffect(() => {
    if (user?.language && user.language !== language) {
      setLanguageState(user.language);
      try {
        localStorage.setItem(STORAGE_KEY, user.language);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    if (user) {
      updateSettings({ language: next }).catch(() => {
        // best-effort sync; the local preference still applies
      });
    }
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let str = dictionaries[language][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      }
    }
    return str;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
