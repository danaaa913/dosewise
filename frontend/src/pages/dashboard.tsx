import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Link } from "wouter";

export default function DashboardPage() {
  const { pharmacy } = useAuth();

  const { data: medicines } = useQuery({
    queryKey: ["my-medicines"],
    queryFn: api.medicines.my,
  });

  const { data: sentRequests } = useQuery({
    queryKey: ["requests-sent"],
    queryFn: api.requests.sent,
  });

  const { data: receivedRequests } = useQuery({
    queryKey: ["requests-received"],
    queryFn: api.requests.received,
  });

  const { data: subStatus } = useQuery({
    queryKey: ["sub-status"],
    queryFn: api.subscriptions.status,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.notifications.my(),
  });

  const stats = [
    {
      label: "أدويتي",
      value: medicines?.length ?? 0,
      sub: `${medicines?.filter((m) => m.isAvailable).length ?? 0} متاحة`,
      href: "/my-medicines",
      color: "emerald",
    },
    {
      label: "طلبات أرسلتها",
      value: sentRequests?.length ?? 0,
      sub: `${sentRequests?.filter((r) => r.status === "pending").length ?? 0} معلقة`,
      href: "/requests",
      color: "blue",
    },
    {
      label: "طلبات واردة",
      value: receivedRequests?.length ?? 0,
      sub: `${receivedRequests?.filter((r) => r.status === "pending").length ?? 0} تحتاج ردًا`,
      href: "/requests",
      color: "amber",
    },
    {
      label: "إشعارات غير مقروءة",
      value: notifData?.unreadCount ?? 0,
      sub: "اضغط للعرض",
      href: "/notifications",
      color: "violet",
    },
  ];

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
  };
  const valueColorMap: Record<string, string> = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
  };

  const pendingReceived = receivedRequests?.filter((r) => r.status === "pending") ?? [];

  return (
    <Layout title="لوحة التحكم">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-slate-800">مرحباً، {pharmacy?.name}</h3>
        <p className="text-sm text-slate-500 mt-1">إليك ملخص نشاط صيدليتك</p>
      </div>

      {subStatus && !subStatus.isSubscribed && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">لا يوجد اشتراك نشط</p>
            <p className="text-xs text-amber-600 mt-0.5">فعّل اشتراكك للاستفادة من جميع الميزات</p>
          </div>
          <Link
            href="/subscriptions"
            className="text-xs font-medium bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            عرض الخطط
          </Link>
        </div>
      )}

      {subStatus?.isSubscribed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              اشتراك {subStatus.plan === "monthly" ? "الشهري" : subStatus.plan === "yearly" ? "السنوي" : "المجاني"} نشط
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">{subStatus.daysRemaining} يوم متبقي</p>
          </div>
          <span className="text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg">نشط</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`block p-5 rounded-xl border ${colorMap[s.color]} hover:shadow-sm transition-shadow`}
          >
            <p className={`text-3xl font-bold ${valueColorMap[s.color]}`}>{s.value}</p>
            <p className="text-sm font-medium text-slate-700 mt-1">{s.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
          </Link>
        ))}
      </div>

      {pendingReceived.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">طلبات تحتاج ردًا</h4>
            <Link href="/requests" className="text-xs text-emerald-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="space-y-3">
            {pendingReceived.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{req.medicineName}</p>
                  <p className="text-xs text-slate-500">
                    من: {req.requesterName} — الكمية: {req.requestedQuantity}
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                  معلق
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/my-medicines", label: "إضافة دواء جديد" },
          { href: "/browse", label: "تصفح الأدوية المتاحة" },
          { href: "/ai", label: "الذكاء الاصطناعي" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="block text-center p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </Layout>
  );
}
