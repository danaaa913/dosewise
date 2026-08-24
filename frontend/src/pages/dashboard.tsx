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
      label: "Ø£Ø¯ÙˆÙŠØªÙŠ",
      value: medicines?.length ?? 0,
      sub: `${medicines?.filter((m) => m.isAvailable).length ?? 0} Ù…ØªØ§Ø­Ø©`,
      href: "/my-medicines",
      color: "emerald",
    },
    {
      label: "Ø·Ù„Ø¨Ø§Øª Ø£Ø±Ø³Ù„ØªÙ‡Ø§",
      value: sentRequests?.length ?? 0,
      sub: `${sentRequests?.filter((r) => r.status === "pending").length ?? 0} Ù…Ø¹Ù„Ù‚Ø©`,
      href: "/requests",
      color: "blue",
    },
    {
      label: "Ø·Ù„Ø¨Ø§Øª ÙˆØ§Ø±Ø¯Ø©",
      value: receivedRequests?.length ?? 0,
      sub: `${receivedRequests?.filter((r) => r.status === "pending").length ?? 0} ØªØ­ØªØ§Ø¬ Ø±Ø¯Ù‹Ø§`,
      href: "/requests",
      color: "amber",
    },
    {
      label: "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡Ø©",
      value: notifData?.unreadCount ?? 0,
      sub: "Ø§Ø¶ØºØ· Ù„Ù„Ø¹Ø±Ø¶",
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
    <Layout title="Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-slate-800">Ù…Ø±Ø­Ø¨Ø§Ù‹ØŒ {pharmacy?.name}</h3>
        <p className="text-sm text-slate-500 mt-1">Ø¥Ù„ÙŠÙƒ Ù…Ù„Ø®Øµ Ù†Ø´Ø§Ø· ØµÙŠØ¯Ù„ÙŠØªÙƒ</p>
      </div>

      {subStatus && !subStatus.isSubscribed && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø§Ø´ØªØ±Ø§Ùƒ Ù†Ø´Ø·</p>
            <p className="text-xs text-amber-600 mt-0.5">ÙØ¹Ù‘Ù„ Ø§Ø´ØªØ±Ø§ÙƒÙƒ Ù„Ù„Ø§Ø³ØªÙØ§Ø¯Ø© Ù…Ù† Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…ÙŠØ²Ø§Øª</p>
          </div>
          <Link
            href="/subscriptions"
            className="text-xs font-medium bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Ø¹Ø±Ø¶ Ø§Ù„Ø®Ø·Ø·
          </Link>
        </div>
      )}

      {subStatus?.isSubscribed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Ø§Ø´ØªØ±Ø§Ùƒ {subStatus.plan === "monthly" ? "Ø§Ù„Ø´Ù‡Ø±ÙŠ" : subStatus.plan === "yearly" ? "Ø§Ù„Ø³Ù†ÙˆÙŠ" : "Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠ"} Ù†Ø´Ø·
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">{subStatus.daysRemaining} ÙŠÙˆÙ… Ù…ØªØ¨Ù‚ÙŠ</p>
          </div>
          <span className="text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg">Ù†Ø´Ø·</span>
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
            <h4 className="font-semibold text-slate-800">Ø·Ù„Ø¨Ø§Øª ØªØ­ØªØ§Ø¬ Ø±Ø¯Ù‹Ø§</h4>
            <Link href="/requests" className="text-xs text-emerald-600 hover:underline">
              Ø¹Ø±Ø¶ Ø§Ù„ÙƒÙ„
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
                    Ù…Ù†: {req.requesterName} â€” Ø§Ù„ÙƒÙ…ÙŠØ©: {req.requestedQuantity}
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                  Ù…Ø¹Ù„Ù‚
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/my-medicines", label: "Ø¥Ø¶Ø§ÙØ© Ø¯ÙˆØ§Ø¡ Ø¬Ø¯ÙŠØ¯" },
          { href: "/browse", label: "ØªØµÙØ­ Ø§Ù„Ø£Ø¯ÙˆÙŠØ© Ø§Ù„Ù…ØªØ§Ø­Ø©" },
          { href: "/analytics" },
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
