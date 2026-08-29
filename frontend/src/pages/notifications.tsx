import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  Ban,
  PackageCheck,
  Inbox,
  CheckCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, type Notification, type NotificationType } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { cn, FOCUS_RING } from "@/lib/utils";

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{${key}}`;
  });
}

function getTargetRoute(type: NotificationType | null, requestId: number | null): string {
  if (!requestId) return "/requests";
  switch (type) {
    case "REQUEST_RECEIVED":
    case "REQUEST_CANCELLED":
    case "REQUEST_COMPLETED":
      return "/requests?tab=received";
    case "REQUEST_ACCEPTED":
    case "REQUEST_REJECTED":
      return "/requests?tab=sent";
    default:
      return "/requests";
  }
}

function NotificationIcon({ type }: { type: NotificationType | null }) {
  switch (type) {
    case "REQUEST_RECEIVED":
      return <Inbox className="w-5 h-5 text-amber-600 flex-shrink-0" aria-hidden="true" />;
    case "REQUEST_ACCEPTED":
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />;
    case "REQUEST_REJECTED":
      return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden="true" />;
    case "REQUEST_CANCELLED":
      return <Ban className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden="true" />;
    case "REQUEST_COMPLETED":
      return <PackageCheck className="w-5 h-5 text-blue-600 flex-shrink-0" aria-hidden="true" />;
    default:
      return <Bell className="w-5 h-5 text-[#3f8b8e] flex-shrink-0" aria-hidden="true" />;
  }
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pendingMarkId, setPendingMarkId] = useState<number | null>(null);
  const { t, lang } = useLanguage();

  const locale = lang === "ar" ? "ar-JO" : "en-JO";
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }),
    [locale]
  );

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => api.notifications.my(unreadOnly),
    refetchInterval: 15000,
  });

  useEffect(() => {
    setPendingMarkId(null);
  }, [data]);

  const markAllMut = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      toast({ title: t.notifications.markAllSuccess });
    },
    onError: () => {
      toast({ variant: "destructive", title: t.notifications.markAllError });
    },
  });

  const inFlightMarkRef = useRef<Set<number>>(new Set());
  const inFlightMarkAllRef = useRef<boolean>(false);

  const handleMarkOne = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    if (inFlightMarkRef.current.has(id)) return;
    inFlightMarkRef.current.add(id);
    try {
      setPendingMarkId(id);
      await api.notifications.markRead(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    } catch {
      toast({ variant: "destructive", title: t.notifications.markReadError });
    } finally {
      inFlightMarkRef.current.delete(id);
      setTimeout(() => btn?.focus?.(), 50);
    }
  };

  const handleOpenNotification = async (n: Notification) => {
    const target = getTargetRoute(n.type, n.requestId);
    if (!n.isRead) {
      try {
        setPendingMarkId(n.id);
        await api.notifications.markRead(n.id);
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["notifications-count"] });
      } catch {
        toast({ variant: "destructive", title: t.notifications.markReadError });
      } finally {
        setPendingMarkId(null);
        setLocation(target);
      }
    } else {
      setLocation(target);
    }
  };

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const hasData = data !== undefined;

  return (
    <Layout title={t.notifications.title}>
      {/* Header section */}
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[#1b3a5f]">{t.notifications.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.notifications.subtitle}</p>
        </div>

        {/* Filter and controls bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span
              role="status"
              aria-live="polite"
              className="text-sm font-semibold text-[#1b3a5f] bg-[#eef5f5] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <Bell className="w-4 h-4 text-[#3f8b8e]" aria-hidden="true" />
              {unreadCount > 0
                ? interpolate(t.notifications.unreadCount, { count: numberFmt.format(unreadCount) })
                : t.notifications.noUnread}
            </span>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none min-h-[44px]">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="w-4 h-4 text-[#3f8b8e] rounded border-slate-300 focus:ring-[#3f8b8e] accent-[#3f8b8e]"
                aria-label={t.notifications.unreadOnly}
              />
              <span>{t.notifications.unreadOnly}</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {isFetching && hasData && (
              <span
                role="status"
                className="text-xs text-slate-400 flex items-center gap-1 min-h-[44px]"
                title={t.notifications.loading}
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3f8b8e]" aria-hidden="true" />
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllMut.mutate()}
              disabled={unreadCount === 0 || markAllMut.isPending}
              className={cn("min-h-[44px] border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5", FOCUS_RING)}
              aria-label={t.notifications.markAllRead}
            >
              <CheckCheck className="w-4 h-4 text-[#3f8b8e]" aria-hidden="true" />
              <span>{t.notifications.markAllRead}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stale data background refresh error */}
      {isError && hasData && (
        <Alert variant="destructive" className="mb-4" role="alert">
          <p className="text-sm">{t.notifications.staleError}</p>
        </Alert>
      )}

      {/* Primary states */}
      {isLoading ? (
        <div className="space-y-3" role="status" aria-label={t.notifications.loading}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex gap-4 items-start">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && !hasData ? (
        <Alert variant="destructive" role="alert" className="p-6">
          <p className="font-medium text-base mb-2">{t.errors.query}</p>
          <Button
            variant="outline"
            size="sm"
            className={cn("mt-2 bg-white text-slate-800 border-slate-300 min-h-[44px]", FOCUS_RING)}
            onClick={() => refetch()}
          >
            {t.errors.retry}
          </Button>
        </Alert>
      ) : !notifications.length ? (
        <Empty className="bg-white rounded-xl border border-slate-200 p-12">
          <EmptyMedia variant="icon" className="bg-[#eef5f5] text-[#3f8b8e] p-4 rounded-full">
            {unreadOnly ? <BellOff className="w-8 h-8" /> : <Bell className="w-8 h-8" />}
          </EmptyMedia>
          <EmptyTitle className="text-[#1b3a5f] mt-4 font-bold text-lg">
            {unreadOnly ? t.empty.notificationsUnread : t.empty.notifications}
          </EmptyTitle>
          {unreadOnly && (
            <EmptyDescription className="text-slate-500 text-sm mt-1">
              <Button
                variant="link"
                className="text-[#3f8b8e] p-0 h-auto font-medium"
                onClick={() => setUnreadOnly(false)}
              >
                {t.notifications.title}
              </Button>
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: Notification) => {
            const isMutatingThis = pendingMarkId === n.id;
            const targetUrl = getTargetRoute(n.type, n.requestId);

            // Construct text content
            let messageText = n.message;
            if (n.type && n.metadata && t.notifications.types[n.type]) {
              const template = t.notifications.types[n.type];
              messageText = interpolate(template, {
                pharmacy: n.metadata.counterpartyName,
                medicine: n.metadata.medicineName,
                qty: numberFmt.format(n.metadata.requestedQuantity),
              });
            }

            const rowLabel = n.metadata?.medicineName
              ? interpolate(t.notifications.viewRequestAria, { medicine: n.metadata.medicineName })
              : messageText;

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={rowLabel}
                onClick={() => handleOpenNotification(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenNotification(n);
                  }
                }}
                className={cn(
                  "group relative p-4 rounded-xl border transition-all cursor-pointer",
                  "hover:shadow-md hover:border-[#3f8b8e]/40 focus-within:ring-2 focus-within:ring-[#3f8b8e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3f8b8e] focus-visible:ring-offset-2",
                  n.isRead
                    ? "bg-white border-slate-200"
                    : "bg-emerald-50/70 border-emerald-200 shadow-sm"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Visual Unread Indicator & Icon */}
                    <div className="relative mt-0.5 flex-shrink-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          n.isRead ? "bg-slate-100" : "bg-white shadow-sm border border-emerald-200"
                        )}
                      >
                        <NotificationIcon type={n.type} />
                      </div>
                      {!n.isRead && (
                        <span
                          className="absolute -top-1 -end-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"
                          title={t.notifications.unreadOnly}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            "text-sm break-words leading-relaxed",
                            n.isRead ? "text-slate-700" : "text-slate-900 font-semibold"
                          )}
                        >
                          {messageText}
                        </p>
                      </div>

                      {/* Metadata tags if present */}
                      {n.metadata && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-medium">
                            {n.metadata.medicineName}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">
                            {interpolate(t.notifications.details.qty, {
                              qty: numberFmt.format(n.metadata.requestedQuantity),
                            })}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">
                            {n.metadata.counterpartyName}
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                        <span>{dateFmt.format(new Date(n.createdAt))}</span>
                        {n.requestId && (
                          <span className="inline-flex items-center gap-1 text-[#3f8b8e] group-hover:underline font-medium">
                            {t.notifications.viewRequest}
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOne(e, n.id)}
                        disabled={isMutatingThis}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium min-h-[44px]",
                          "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          FOCUS_RING
                        )}
                        aria-label={t.notifications.markReadAria}
                      >
                        {isMutatingThis ? t.loading : t.notifications.markRead}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
