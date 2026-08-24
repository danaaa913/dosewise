import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api, type Notification } from "@/lib/api";
import { useState } from "react";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => api.notifications.my(unreadOnly),
    refetchInterval: 15000,
  });

  const markMut = useMutation({
    mutationFn: (id: number) => api.notifications.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Layout title="الإشعارات">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات غير مقروءة"}
          </p>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-3.5 h-3.5 text-emerald-600 rounded"
            />
            <span className="text-xs text-slate-600">غير المقروءة فقط</span>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">جاري التحميل...</div>
      ) : !notifications.length ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm">
            {unreadOnly ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: Notification) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-colors ${
                n.isRead
                  ? "bg-white border-slate-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      n.isRead ? "bg-slate-300" : "bg-emerald-500"
                    }`}
                  />
                  <div>
                    <p className={`text-sm ${n.isRead ? "text-slate-600" : "text-slate-800 font-medium"}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString("ar-JO")}
                    </p>
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markMut.mutate(n.id)}
                    disabled={markMut.isPending}
                    className="text-xs text-emerald-600 hover:underline whitespace-nowrap flex-shrink-0 disabled:opacity-60"
                  >
                    تحديد كمقروء
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
