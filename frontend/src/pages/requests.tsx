import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Send } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, type ExchangeRequest } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "معلق", cls: "bg-amber-100 text-amber-700" },
  accepted: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-600" },
  cancelled: { label: "ملغى", cls: "bg-slate-200 text-slate-600" },
  completed: { label: "مكتمل", cls: "bg-blue-100 text-blue-700" },
  expired: { label: "منتهي", cls: "bg-slate-200 text-slate-500" },
};

export default function RequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const { t } = useLanguage();

  const showFeedback = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 3000);
  };

  const { data: received, isLoading: loadingReceived, isError: errReceived, refetch: refetchReceived } = useQuery({
    queryKey: ["requests-received"],
    queryFn: api.requests.received,
  });

  const { data: sent, isLoading: loadingSent, isError: errSent, refetch: refetchSent } = useQuery({
    queryKey: ["requests-sent"],
    queryFn: api.requests.sent,
  });

  const acceptMut = useMutation({
    mutationFn: (id: number) => api.requests.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      showFeedback("تم قبول الطلب بنجاح");
    },
    onError: (e: Error) => showFeedback(e.message, true),
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.requests.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      showFeedback("تم رفض الطلب");
    },
    onError: (e: Error) => showFeedback(e.message, true),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.requests.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      showFeedback("تم إلغاء الطلب");
    },
    onError: (e: Error) => showFeedback(e.message, true),
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => api.requests.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      showFeedback("تم تأكيد الاستلام — اكتمل الطلب 🎉");
    },
    onError: (e: Error) => showFeedback(e.message, true),
  });

  const requests: ExchangeRequest[] = tab === "received" ? (received ?? []) : (sent ?? []);
  const isLoading = tab === "received" ? loadingReceived : loadingSent;

  const pendingCount = received?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Layout title="الطلبات">
      {feedback && (
        <div
          className={`mb-4 p-3 border rounded-lg text-sm ${
            feedback.isError
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("received")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
            tab === "received" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          الطلبات الواردة
          {pendingCount > 0 && (
            <span className="mr-1.5 text-xs bg-amber-500 text-white rounded-full px-1.5 py-0.5">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "sent" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          الطلبات المُرسلة
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-3 gap-4"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div>
            </div>
          ))}
        </div>
      ) : (tab === "received" ? errReceived : errSent) ? (
        <Alert variant="destructive">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => tab === "received" ? refetchReceived() : refetchSent()}>{t.errors.retry}</Button>
        </Alert>
      ) : !requests.length ? (
        <Empty>
          <EmptyMedia variant="icon">
            {tab === "received" ? <Inbox className="size-6" /> : <Send className="size-6" />}
          </EmptyMedia>
          <EmptyTitle>
            {tab === "received" ? t.empty.requestsReceived : t.empty.requestsSent}
          </EmptyTitle>
        </Empty>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const s = STATUS_LABELS[req.status] ?? { label: req.status, cls: "bg-slate-100 text-slate-600" };
            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        #{req.id} — {new Date(req.requestDate).toLocaleDateString("ar-JO")}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-800 text-sm">{req.medicineName}</h4>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-500">
                      <span>
                        <span className="text-slate-600 font-medium">الطالب: </span>
                        {req.requesterName}
                      </span>
                      <span>
                        <span className="text-slate-600 font-medium">المزود: </span>
                        {req.providerName}
                      </span>
                      <span>
                        <span className="text-slate-600 font-medium">الكمية المطلوبة: </span>
                        {req.requestedQuantity}
                      </span>
                    </div>
                    {req.responseDate && (
                      <p className="text-xs text-slate-400 mt-1">
                        تاريخ الرد: {new Date(req.responseDate).toLocaleDateString("ar-JO")}
                      </p>
                    )}
                  </div>

                  {/* Actions for received pending */}
                  {tab === "received" && req.status === "pending" && (
                    <div className="flex gap-2 mr-4 flex-shrink-0">
                      <button
                        onClick={() => acceptMut.mutate(req.id)}
                        disabled={acceptMut.isPending || rejectMut.isPending}
                        className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                      >
                        قبول
                      </button>
                      <button
                        onClick={() => rejectMut.mutate(req.id)}
                        disabled={acceptMut.isPending || rejectMut.isPending}
                        className="border border-red-300 text-red-600 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
                      >
                        رفض
                      </button>
                    </div>
                  )}

                  {/* Actions for sent requests */}
                  {tab === "sent" && req.status === "pending" && (
                    <div className="flex gap-2 mr-4 flex-shrink-0">
                      <button
                        onClick={() => cancelMut.mutate(req.id)}
                        disabled={cancelMut.isPending}
                        className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
                      >
                        إلغاء الطلب
                      </button>
                    </div>
                  )}
                  {tab === "sent" && req.status === "accepted" && (
                    <div className="flex gap-2 mr-4 flex-shrink-0">
                      <button
                        onClick={() => completeMut.mutate(req.id)}
                        disabled={completeMut.isPending}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        تأكيد الاستلام
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
