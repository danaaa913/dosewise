import { Globe } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /** Use light colors for dark backgrounds (admin login) */
  light?: boolean;
}

export function LanguageSwitcher({ className, light = false }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const next = lang === "ar" ? "en" : "ar";
  const label = lang === "ar" ? "EN" : "ع";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        light
          ? "text-white/80 hover:text-white hover:bg-white/10"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
        className
      )}
    >
      <Globe className="size-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
