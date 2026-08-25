import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, type Notification } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { t } = useLanguage();

  const { data, isLoading, isError, refetch } = useQuery({
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
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex gap-3">
              <Skeleton className="w-2 h-2 rounded-full mt-1.5" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/4" /></div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>{t.errors.retry}</Button>
        </Alert>
      ) : !notifications.length ? (
        <Empty>
          <EmptyMedia variant="icon">
            {unreadOnly ? <BellOff className="size-6" /> : <Bell className="size-6" />}
          </EmptyMedia>
          <EmptyTitle>{unreadOnly ? t.empty.notificationsUnread : t.empty.notifications}</EmptyTitle>
        </Empty>
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
