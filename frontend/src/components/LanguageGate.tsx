import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";

export function LanguageGate() {
  const { setLang, t, lang } = useLanguage();

  const options: Array<{ value: Lang; title: string; sub: string; flag: string }> = [
    { value: "ar", title: t.chooseArabic, sub: t.chooseArabicSub, flag: "🇯🇴" },
    { value: "en", title: t.chooseEnglish, sub: t.chooseEnglishSub, flag: "🌐" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#1b3a5f] via-[#1e4a52] to-[#3f8b8e] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo size={64} />
        </div>
        <h1 className="text-xl font-bold text-[#1b3a5f]">{t.welcomeTitle}</h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">{t.welcomeSubtitle}</p>

        <div className="grid grid-cols-2 gap-4" dir={lang === "ar" ? "rtl" : "ltr"}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => setLang(option.value)}
              className="group border-2 border-slate-200 rounded-2xl p-6 hover:border-[#3f8b8e] hover:bg-[#f0f7f7] transition-all"
            >
              <span className="text-3xl block mb-3">{option.flag}</span>
              <span className="block text-lg font-bold text-[#1b3a5f] group-hover:text-[#3f8b8e]">
                {option.title}
              </span>
              <span className="block text-xs text-slate-400 mt-1.5">{option.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
