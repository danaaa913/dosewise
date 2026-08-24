import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Lang, type Translations } from "./translations";

const STORAGE_KEY = "dosewise.lang";

interface LanguageContextValue {
  lang: Lang;
  hasChosen: boolean;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): Lang | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ar" || stored === "en" ? stored : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? "ar");
  const [hasChosen, setHasChosen] = useState<boolean>(() => readStoredLang() !== null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = translations[lang].dir;
  }, [lang]);

  const setLang = (next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
    setHasChosen(true);
  };

  return (
    <LanguageContext.Provider value={{ lang, hasChosen, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
