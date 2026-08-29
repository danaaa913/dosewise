import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, formatPrice } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";

type AnalyticsTab = "recommendations" | "suggestions" | "prices" | "forecast";

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<AnalyticsTab>("recommendations");
  const [selectedMedicine, setSelectedMedicine] = useState<string>("");

  const { data: medicinesData } = useQuery({
    queryKey: ["analytics-medicines"],
    queryFn: api.ai.medicines,
  });
  const { data: recData, isLoading: recLoading, isError: recError, refetch: recRefetch } = useQuery({
    queryKey: ["analytics-rec"],
    queryFn: api.ai.recommendations,
  });
  const { data: sugData, isLoading: sugLoading, isError: sugError, refetch: sugRefetch } = useQuery({
    queryKey: ["analytics-sug"],
    queryFn: api.ai.medicineSuggestions,
  });
  const { data: priceData, isLoading: priceLoading, isError: priceError, refetch: priceRefetch } = useQuery({
    queryKey: ["analytics-price", selectedMedicine],
    queryFn: () => api.ai.priceOptimization(selectedMedicine || undefined),
  });
  const { data: forecastData, isLoading: forecastLoading, isError: forecastError, refetch: forecastRefetch } = useQuery({
    queryKey: ["analytics-forecast", selectedMedicine],
    queryFn: () => api.ai.demandForecast(selectedMedicine || undefined),
  });

  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: "recommendations", label: t.analytics.tabs.recommendations },
    { id: "suggestions", label: t.analytics.tabs.suggestions },
    { id: "prices", label: t.analytics.tabs.prices },
    { id: "forecast", label: t.analytics.tabs.forecast },
  ];

  const isAnalysisTab = tab === "prices" || tab === "forecast";

  return (
    <Layout title={t.nav.analytics}>
      <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        {t.analytics.disclaimer}
      </div>

      {isAnalysisTab && (
        <div className="mb-5 bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-slate-700 sm:w-40 flex-shrink-0">
            {t.analytics.pickMedicine}
          </label>
          <div className="flex-1 flex gap-2">
            <select
              value={selectedMedicine}
              onChange={(e) => setSelectedMedicine(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t.analytics.allMedicines}</option>
              {(medicinesData?.medicines ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {selectedMedicine && (
              <button
                onClick={() => setSelectedMedicine("")}
                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                {t.analytics.clear}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label={t.nav.analytics}
        className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl overflow-x-auto"
      >
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            role="tab"
            aria-selected={tab === tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === tabItem.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "recommendations" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">{t.analytics.recommendationsHint}</p>
          {recLoading && <p className="text-sm text-slate-400 text-center py-8">{t.loading}</p>}
          {recError && !recLoading && (
            <Alert variant="destructive" className="my-4">
              <p className="text-sm">{t.errors.query}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => recRefetch()}>{t.errors.retry}</Button>
            </Alert>
          )}
          {!recLoading && !recError && (recData?.recommendations ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              {t.analytics.noRecommendations}
            </p>
          )}
          {(recData?.recommendations ?? []).map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-800 text-sm">{r.medicine}</p>
              <p className="text-xs text-slate-500 mt-1">{r.reason}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "suggestions" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">{t.analytics.suggestionsHint}</p>
          {sugLoading && <p className="text-sm text-slate-400 text-center py-8">{t.loading}</p>}
          {sugError && !sugLoading && (
            <Alert variant="destructive" className="my-4">
              <p className="text-sm">{t.errors.query}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => sugRefetch()}>{t.errors.retry}</Button>
            </Alert>
          )}
          {!sugLoading && !sugError && (sugData?.suggestions ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              {t.analytics.noData}
            </p>
          )}
          {(sugData?.suggestions ?? []).map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.analytics.expectedDemand}: <span className="font-medium text-slate-700">{s.estimatedDemand} {t.analytics.units}</span>
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1.5 rounded-full font-medium ${
                s.trend === "صاعد" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}>
                {s.trend === "صاعد" ? t.analytics.rising : t.analytics.stable}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "prices" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            {selectedMedicine
              ? `${t.analytics.priceFor} "${selectedMedicine}"`
              : t.analytics.pricesHint}
          </p>
          {priceLoading && <p className="text-sm text-slate-400 text-center py-8">{t.loading}</p>}
          {priceError && !priceLoading && (
            <Alert variant="destructive" className="my-4">
              <p className="text-sm">{t.errors.query}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => priceRefetch()}>{t.errors.retry}</Button>
            </Alert>
          )}
          {!priceLoading && !priceError && (priceData?.optimizations ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              {selectedMedicine ? t.analytics.noPriceForMedicine : t.analytics.noMedicines}
            </p>
          )}
          {(priceData?.optimizations ?? []).map((p, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-800 text-sm mb-2">{p.medicine}</p>
              <div className="flex items-center gap-4 mb-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-500">{formatPrice(p.currentPrice)}</div>
                  <div className="text-xs text-slate-400">{t.analytics.currentPrice}</div>
                </div>
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 rtl:-scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    p.suggestedPrice > p.currentPrice ? "text-emerald-600" : "text-blue-600"
                  }`}>
                    {formatPrice(p.suggestedPrice)}
                  </div>
                  <div className="text-xs text-slate-400">{t.analytics.suggestedPrice}</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">{p.reason}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "forecast" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            {selectedMedicine
              ? `${t.analytics.forecastFor} "${selectedMedicine}"`
              : t.analytics.forecastHint}
          </p>
          {forecastLoading && <p className="text-sm text-slate-400 text-center py-8">{t.loading}</p>}
          {forecastError && !forecastLoading && (
            <Alert variant="destructive" className="my-4">
              <p className="text-sm">{t.errors.query}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => forecastRefetch()}>{t.errors.retry}</Button>
            </Alert>
          )}
          {!forecastLoading && !forecastError && (forecastData?.forecasts ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 bg-white rounded-xl border border-slate-200">
              {t.analytics.noData}
            </p>
          )}
          {(forecastData?.forecasts ?? []).map((f, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{f.medicine}</p>
                <p className="text-xs text-slate-500 mt-1">{f.seasonality}</p>
              </div>
              <div className="text-end">
                <p className="text-lg font-bold text-slate-800">{f.nextMonthDemand}</p>
                <p className="text-xs text-slate-500">{t.analytics.unitsPerMonth}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                  f.trend === "صاعد" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {f.trend === "صاعد" ? t.analytics.rising : t.analytics.stable}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
