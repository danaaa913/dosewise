import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Package, SearchX } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, formatPrice, type AvailableMedicine } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";

export default function BrowsePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [requesting, setRequesting] = useState<AvailableMedicine | null>(null);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const { pharmacy } = useAuth();
  const notVerified = pharmacy?.verificationStatus !== "approved";
  const [qty, setQty] = useState("1");
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");
  const submittingRef = useRef(false);

  const { t } = useLanguage();

  useEffect(() => {
    if (!requesting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRequesting(null);
        setRequestError("");
        setIdemKey(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requesting]);

  const { data: medicines, isLoading, isError, refetch } = useQuery({
    queryKey: ["available-medicines", search],
    queryFn: () => api.medicines.available(search || undefined),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      api.requests.send(
        {
          medicineId: requesting!.id,
          requestedQuantity: Number(qty),
        },
        idemKey!
      ),
    onSuccess: () => {
      setRequestSuccess("تم إرسال الطلب بنجاح");
      setRequesting(null);
      setIdemKey(null);
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      setTimeout(() => setRequestSuccess(""), 3000);
    },
    onError: (e: any) => {
      const code = (e as { code?: string })?.code;
      const known: Record<string, string> = {
        PROVIDER_UNAVAILABLE: t.errorCodes.PROVIDER_UNAVAILABLE,
        DUPLICATE_PENDING_REQUEST: t.errorCodes.DUPLICATE_PENDING_REQUEST,
        IDEMPOTENCY_KEY_REUSED: t.errorCodes.IDEMPOTENCY_KEY_REUSED,
        MEDICINE_EXPIRED: t.errorCodes.MEDICINE_EXPIRED,
      };
      setRequestError(code && known[code] ? known[code] : t.requests.errors.send);
    },
  });

  return (
    <Layout title="تصفح الأدوية المتاحة">
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن دواء..."
            className="w-full pr-9 pl-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {requestSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {requestSuccess}
        </div>
      )}

      {/* Request modal */}
      {requesting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">إرسال طلب</h3>
              <button onClick={() => { setRequesting(null); setRequestError(""); setIdemKey(null); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 mb-1 font-medium">{requesting.name}</p>
              <p className="text-xs text-slate-500 mb-4">من: {requesting.pharmacyName} — {requesting.pharmacyCity}</p>
              <p className="text-xs text-slate-500 mb-1">متاح: {requesting.quantity} وحدة — السعر: {formatPrice(requesting.price)} JOD</p>

              {requestError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">{requestError}</p>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الكمية المطلوبة</label>
                <input
                  type="number"
                  min="1"
                  max={requesting.quantity}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    if (submittingRef.current) return;
                    submittingRef.current = true;
                    sendMut.mutate(undefined, {
                      onSettled: () => { submittingRef.current = false; },
                    });
                  }}
                  disabled={sendMut.isPending || notVerified}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {notVerified ? "الإرسال متاح بعد اعتماد الصيدلية" : sendMut.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                </button>
                <button
                  onClick={() => { setRequesting(null); setRequestError(""); setIdemKey(null); }}
                  className="px-4 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>{t.errors.retry}</Button>
        </Alert>
      ) : !medicines?.length ? (
        <Empty>
          <EmptyMedia variant="icon">
            {search ? <SearchX className="size-6" /> : <Package className="size-6" />}
          </EmptyMedia>
          <EmptyTitle>{search ? `${t.empty.browseSearch} "${search}"` : t.empty.browse}</EmptyTitle>
          <EmptyDescription>{search ? "جرّب كلمات بحث مختلفة" : "ستظهر الأدوية المتاحة هنا فور إضافتها من قبل الصيدليات الأخرى"}</EmptyDescription>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-slate-800 text-sm leading-snug">{m.name}</h4>
                <span className="text-sm font-bold text-emerald-700 whitespace-nowrap mr-2">
                  {formatPrice(m.price)} JOD
                </span>
              </div>

              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الصيدلية:</span> {m.pharmacyName}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">المدينة:</span> {m.pharmacyCity}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الكمية المتاحة:</span> {m.quantity} وحدة
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الصلاحية حتى:</span> {m.expiryDate}
                </p>
              </div>

              {m.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{m.description}</p>
              )}

              <button
                onClick={() => {
                  setRequesting(m);
                  setQty("1");
                  setRequestError("");
                  setIdemKey(crypto.randomUUID());
                }}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                طلب هذا الدواء
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
