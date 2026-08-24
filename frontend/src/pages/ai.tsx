import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";

type AiTab = "recommendations" | "suggestions" | "prices" | "forecast" | "chat";

const TABS: { id: AiTab; label: string }[] = [
  { id: "recommendations", label: "توصيات الشراء" },
  { id: "suggestions", label: "اقتراحات الأدوية" },
  { id: "prices", label: "تحسين الأسعار" },
  { id: "forecast", label: "توقع الطلب" },
  { id: "chat", label: "مساعد الذكاء الاصطناعي" },
];

interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

export default function AiPage() {
  const [tab, setTab] = useState<AiTab>("recommendations");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "مرحباً! أنا مساعد DoseWise الذكي. كيف يمكنني مساعدتك في إدارة صيدليتك اليوم؟" },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "كيف أحسن إدارة مخزوني؟",
    "ما هي أفضل استراتيجية للتسعير؟",
    "كيف أزيد الطلب على أدويتي؟",
  ]);

  const [selectedMedicine, setSelectedMedicine] = useState<string>("");

  const { data: medicinesData } = useQuery({
    queryKey: ["ai-medicines"],
    queryFn: api.ai.medicines,
  });
  const { data: recData, isLoading: recLoading } = useQuery({
    queryKey: ["ai-rec"],
    queryFn: api.ai.recommendations,
  });
  const { data: sugData, isLoading: sugLoading } = useQuery({
    queryKey: ["ai-sug"],
    queryFn: api.ai.medicineSuggestions,
  });
  const { data: priceData, isLoading: priceLoading } = useQuery({
    queryKey: ["ai-price", selectedMedicine],
    queryFn: () => api.ai.priceOptimization(selectedMedicine || undefined),
  });
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["ai-forecast", selectedMedicine],
    queryFn: () => api.ai.demandForecast(selectedMedicine || undefined),
  });

  const chatMut = useMutation({
    mutationFn: (msg: string) => api.ai.chat(msg),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "ai", text: data.response }]);
      if (data.suggestions?.length) setSuggestions(data.suggestions);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "ai", text: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى." }]);
    },
  });

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    chatMut.mutate(text);
  };

  const isAnalysisTab = tab === "prices" || tab === "forecast";

  return (
    <Layout title="الذكاء الاصطناعي">
      {/* Medicine selector */}
      {isAnalysisTab && (
        <div className="mb-5 bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-slate-700 sm:w-40 flex-shrink-0">
            اختر دواءً للتحليل
          </label>
          <div className="flex-1 flex gap-2">
            <select
              value={selectedMedicine}
              onChange={(e) => setSelectedMedicine(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— كل الأدوية (تحليل عام) —</option>
              {(medicinesData?.medicines ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {selectedMedicine && (
              <button
                onClick={() => setSelectedMedicine("")}
                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Recommendations */}
      {tab === "recommendations" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            توصيات مبنية على الأدوية الأكثر طلباً على المنصة وحالة مخزونك الحالي
          </p>
          {recLoading && <p className="text-sm text-slate-400 text-center py-8">جاري التحليل...</p>}
          {!recLoading && (recData?.recommendations ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              لا توجد توصيات حالياً. أضف أدوية إلى مخزونك لتلقي توصيات مخصصة.
            </p>
          )}
          {(recData?.recommendations ?? []).map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{r.medicine}</p>
                <p className="text-xs text-slate-500 mt-1">{r.reason}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-bold text-emerald-700">{Math.round(r.confidence * 100)}%</div>
                <div className="text-xs text-slate-400">ثقة</div>
                <div className="mt-1 w-16 h-1.5 bg-slate-200 rounded-full">
                  <div
                    className="h-1.5 bg-emerald-500 rounded-full"
                    style={{ width: `${r.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {tab === "suggestions" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            أدوية مقترح توفيرها بناءً على عدد الطلبات الفعلي خلال آخر 30 يوماً
          </p>
          {sugLoading && <p className="text-sm text-slate-400 text-center py-8">جاري التحليل...</p>}
          {!sugLoading && (sugData?.suggestions ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              لا توجد بيانات اقتراحات بعد.
            </p>
          )}
          {(sugData?.suggestions ?? []).map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  الطلب المتوقع: <span className="font-medium text-slate-700">{s.estimatedDemand} وحدة</span>
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1.5 rounded-full font-medium ${
                s.trend === "صاعد" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}>
                {s.trend === "صاعد" ? "اتجاه صاعد" : "مستقر"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Prices */}
      {tab === "prices" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            {selectedMedicine
              ? `تحليل أسعار "${selectedMedicine}" بالمقارنة مع متوسط السوق على المنصة`
              : "توصيات لتحسين أسعار أدويتك بناءً على متوسط الأسعار على المنصة"}
          </p>
          {priceLoading && <p className="text-sm text-slate-400 text-center py-8">جاري التحليل...</p>}
          {!priceLoading && (priceData?.optimizations ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              {selectedMedicine
                ? "لا توجد بيانات تسعير لهذا الدواء في مخزونك."
                : "لا توجد أدوية في مخزونك للتحليل. أضف أدوية أولاً."}
            </p>
          )}
          {(priceData?.optimizations ?? []).map((p, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-800 text-sm mb-2">{p.medicine}</p>
              <div className="flex items-center gap-4 mb-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-500">{p.currentPrice.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">السعر الحالي (JOD)</div>
                </div>
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    p.suggestedPrice > p.currentPrice ? "text-emerald-600" : "text-blue-600"
                  }`}>
                    {p.suggestedPrice.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">السعر المقترح (JOD)</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{p.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Forecast */}
      {tab === "forecast" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            {selectedMedicine
              ? `توقع الطلب لدواء "${selectedMedicine}" خلال الشهر القادم`
              : "توقع الطلب على الأدوية الأكثر طلباً الشهر القادم"}
          </p>
          {forecastLoading && <p className="text-sm text-slate-400 text-center py-8">جاري التحليل...</p>}
          {!forecastLoading && (forecastData?.forecasts ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              لا توجد بيانات توقع حالياً.
            </p>
          )}
          {(forecastData?.forecasts ?? []).map((f, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{f.medicine}</p>
                <p className="text-xs text-slate-500 mt-1">{f.seasonality}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800">{f.nextMonthDemand}</p>
                <p className="text-xs text-slate-500">وحدة / شهر</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                  f.trend === "صاعد" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {f.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      {tab === "chat" && (
        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 bg-white rounded-xl border border-slate-200 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white rounded-tr-sm"
                      : "bg-slate-100 text-slate-800 rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {chatMut.isPending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-400 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
                  جاري الرد...
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendChat(s)}
                  className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)}
              placeholder="اكتب سؤالك هنا..."
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => sendChat(chatInput)}
              disabled={chatMut.isPending || !chatInput.trim()}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              إرسال
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
