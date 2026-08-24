import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api, type Plan } from "@/lib/api";
import { useState } from "react";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["sub-status"],
    queryFn: api.subscriptions.status,
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["sub-plans"],
    queryFn: api.subscriptions.plans,
  });

  const payMut = useMutation({
    mutationFn: (planId: string) => api.subscriptions.payment(planId),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["sub-status"] });
      setFeedback(data.message ?? "تم تفعيل الاشتراك بنجاح");
      setTimeout(() => setFeedback(""), 5000);
    },
    onError: (e: any) => {
      setError(e.message);
      setTimeout(() => setError(""), 5000);
    },
  });

  const cancelMut = useMutation({
    mutationFn: api.subscriptions.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-status"] });
      setFeedback("تم إلغاء الاشتراك");
      setTimeout(() => setFeedback(""), 4000);
    },
  });

  const planColorMap: Record<string, { ring: string; badge: string; btn: string }> = {
    free: {
      ring: "border-slate-300",
      badge: "bg-slate-100 text-slate-600",
      btn: "bg-slate-700 hover:bg-slate-800",
    },
    monthly: {
      ring: "border-emerald-400",
      badge: "bg-emerald-100 text-emerald-700",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    yearly: {
      ring: "border-blue-400",
      badge: "bg-blue-100 text-blue-700",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
  };

  return (
    <Layout title="الاشتراكات">
      {plans?.demoMode && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <span className="font-bold">⚠️ وضع تجريبي:</span> المدفوعات حالياً محاكاة فقط لأغراض العرض. لا تُدخل بيانات بطاقة حقيقية — لن تُقبل ولن تُخزن.
        </div>
      )}
      {feedback && (
        <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Current status */}
      {!statusLoading && status && (
        <div className={`mb-8 p-5 rounded-xl border ${
          status.isSubscribed ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
        }`}>
          <h3 className="font-semibold text-slate-800 mb-2">الاشتراك الحالي</h3>
          {status.isSubscribed ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  خطة{" "}
                  <span className="font-medium text-emerald-700">
                    {status.plan === "monthly" ? "الشهرية" : status.plan === "yearly" ? "السنوية" : "المجانية"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  تنتهي في {status.endDate ? new Date(status.endDate).toLocaleDateString("ar-JO") : "—"} ({status.daysRemaining} يوم متبقي)
                </p>
              </div>
              <button
                onClick={() => { if (confirm("هل تريد إلغاء اشتراكك؟")) cancelMut.mutate(); }}
                disabled={cancelMut.isPending}
                className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60"
              >
                إلغاء الاشتراك
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">لا يوجد اشتراك نشط. اختر خطة أدناه للبدء.</p>
          )}
        </div>
      )}

      {/* Plans */}
      {plansLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {(plans?.plans ?? []).map((plan: Plan) => {
            const colors = planColorMap[plan.id] ?? planColorMap.free;
            const isCurrent = status?.plan === plan.id && status.isSubscribed;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${colors.ring} ${isCurrent ? "shadow-md" : ""}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 text-base">الخطة {plan.name}</h4>
                  {isCurrent && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.badge}`}>
                      الحالية
                    </span>
                  )}
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-slate-800">
                    {plan.price === 0 ? "مجاناً" : `${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-500 text-sm mr-1">
                      {plan.currency} / {plan.durationDays === 30 ? "شهر" : "سنة"}
                    </span>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => payMut.mutate(plan.id)}
                  disabled={payMut.isPending || isCurrent}
                  className={`w-full text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${colors.btn}`}
                >
                  {isCurrent ? "الخطة النشطة" : plan.price === 0 ? "تفعيل مجاني" : `اشترك الآن — ${plan.price} ${plan.currency}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        الدفع تجريبي — لا تتطلب هذه المنصة بيانات بطاقة حقيقية
      </p>
    </Layout>
  );
}
