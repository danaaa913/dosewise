import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";

export function LanguageGate() {
  const { setLang, t, lang } = useLanguage();

  const options: Array<{ value: Lang; title: string; sub: string; badge: string }> = [
    { value: "ar", title: t.chooseArabic, sub: t.chooseArabicSub, badge: "ع" },
    { value: "en", title: t.chooseEnglish, sub: t.chooseEnglishSub, badge: "E" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#1b3a5f] via-[#1e4a52] to-[#3f8b8e] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo size={64} />
        </div>
        <h1 className="text-xl font-bold text-[#1b3a5f]">{t.welcomeTitle}</h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">{t.welcomeSubtitle}</p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4" dir={lang === "ar" ? "rtl" : "ltr"}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => setLang(option.value)}
              className="group border-2 border-slate-200 rounded-2xl p-4 sm:p-6 hover:border-[#3f8b8e] hover:bg-[#f0f7f7] transition-all min-w-0"
            >
              <span className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#eef5f5] flex items-center justify-center text-xl font-bold text-[#1b3a5f] group-hover:bg-[#d6ebec]">
                {option.badge}
              </span>
              <span className="block text-base sm:text-lg font-bold text-[#1b3a5f] group-hover:text-[#3f8b8e]">
                {option.title}
              </span>
              <span className="block text-xs text-slate-400 mt-1.5 break-words">{option.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
