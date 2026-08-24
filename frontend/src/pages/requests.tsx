import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api, type ExchangeRequest } from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "معلق", cls: "bg-amber-100 text-amber-700" },
  accepted: { label: "مقبول", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-600" },
};

export default function RequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [feedback, setFeedback] = useState("");

  const { data: received, isLoading: loadingReceived } = useQuery({
    queryKey: ["requests-received"],
    queryFn: api.requests.received,
  });

  const { data: sent, isLoading: loadingSent } = useQuery({
    queryKey: ["requests-sent"],
    queryFn: api.requests.sent,
  });

  const acceptMut = useMutation({
    mutationFn: (id: number) => api.requests.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      setFeedback("تم قبول الطلب بنجاح");
      setTimeout(() => setFeedback(""), 3000);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.requests.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      setFeedback("تم رفض الطلب");
      setTimeout(() => setFeedback(""), 3000);
    },
  });

  const requests: ExchangeRequest[] = tab === "received" ? (received ?? []) : (sent ?? []);
  const isLoading = tab === "received" ? loadingReceived : loadingSent;

  const pendingCount = received?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Layout title="الطلبات">
      {feedback && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {feedback}
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
        <div className="text-center py-16 text-slate-400 text-sm">جاري التحميل...</div>
      ) : !requests.length ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm">
            {tab === "received" ? "لا توجد طلبات واردة" : "لم ترسل أي طلبات بعد"}
          </p>
        </div>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
