import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { api, type Plan } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const { t, lang } = useLanguage();

  const locale = lang === "ar" ? "ar-JO" : "en-JO";
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["sub-status"],
    queryFn: api.subscriptions.status,
  });

  const { data: plans, isLoading: plansLoading, isError: plansError, refetch: plansRefetch } = useQuery({
    queryKey: ["sub-plans"],
    queryFn: api.subscriptions.plans,
  });

  const payMut = useMutation({
    mutationFn: (planId: string) => api.subscriptions.payment(planId),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["sub-status"] });
      setFeedback(data.message ?? t.subscriptions.successActivated);
      setTimeout(() => setFeedback(""), 5000);
    },
    onError: (e: any) => {
      setError(e.message ?? t.subscriptions.errors.action);
      setTimeout(() => setError(""), 5000);
    },
  });

  const cancelMut = useMutation({
    mutationFn: api.subscriptions.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-status"] });
      setFeedback(t.subscriptions.successCancelled);
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

  const planName = (planId: string | null | undefined) => {
    if (planId === "monthly") return t.subscriptions.plan.monthly;
    if (planId === "yearly") return t.subscriptions.plan.yearly;
    return t.subscriptions.plan.free;
  };

  return (
    <Layout title={t.subscriptions.title}>
      {plans?.demoMode && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <span className="font-bold">{t.subscriptions.demoModeTitle}</span>{" "}
          {t.subscriptions.demoModeDesc}
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
          <h3 className="font-semibold text-slate-800 mb-2">{t.subscriptions.currentTitle}</h3>
          {status.isSubscribed ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  {t.subscriptions.planLabel}{" "}
                  <span className="font-medium text-emerald-700">
                    {planName(status.plan)}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.subscriptions.endsOn
                    .replace("{date}", status.endDate ? dateFmt.format(new Date(status.endDate as string)) : "—")
                    .replace("{count}", String(status.daysRemaining))}
                </p>
              </div>
              <button
                onClick={() => setCancelOpen(true)}
                disabled={cancelMut.isPending}
                className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60"
              >
                {t.subscriptions.cancelButton}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t.subscriptions.noActive}</p>
          )}
        </div>
      )}

      {/* Plans */}
      {plansLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-20" />
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}</div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : plansError ? (
        <Alert variant="destructive">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => plansRefetch()}>{t.errors.retry}</Button>
        </Alert>
      ) : !(plans?.plans?.length) ? (
        <Empty>
          <EmptyMedia variant="icon"><CreditCard className="size-6" /></EmptyMedia>
          <EmptyTitle>{t.empty.subscriptions}</EmptyTitle>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {(plans?.plans ?? []).map((plan: Plan) => {
            const colors = planColorMap[plan.id] ?? planColorMap.free;
            const isCurrent = status?.plan === plan.id && status.isSubscribed;
            const periodLabel = plan.durationDays === 30 ? t.subscriptions.perMonth : t.subscriptions.perYear;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${colors.ring} ${isCurrent ? "shadow-md" : ""}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 text-base">
                    {t.subscriptions.planCardTitle.replace("{name}", plan.name)}
                  </h4>
                  {isCurrent && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors.badge}`}>
                      {t.subscriptions.currentBadge}
                    </span>
                  )}
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-slate-800">
                    {plan.price === 0 ? t.subscriptions.free : `${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-500 text-sm mr-1">
                      {plan.currency} / {periodLabel}
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
                  {isCurrent
                    ? t.subscriptions.activePlanButton
                    : plan.price === 0
                      ? t.subscriptions.activateFree
                      : t.subscriptions.subscribeNow
                          .replace("{price}", `${plan.price}`)
                          .replace("{currency}", plan.currency)}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        {t.subscriptions.demoFooter}
      </p>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.subscriptions.cancelTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.subscriptions.cancelDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.subscriptions.cancelDialogCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMut.mutate()}>
              {t.subscriptions.cancelConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}