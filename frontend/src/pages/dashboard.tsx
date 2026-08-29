import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "wouter";
import {
  Package,
  ArrowLeftRight,
  Bell,
  Search,
  Plus,
  Sparkles,
  Clock3,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function DashboardPage() {
  const { pharmacy } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-JO" : "en-JO";
  const numberFormatter = new Intl.NumberFormat(locale);
  const [isRetrying, setIsRetrying] = useState(false);

  const {
    data: medicines,
    isPending: pendingMed,
    isError: errMed,
    refetch: refMed,
  } = useQuery({
    queryKey: ["my-medicines"],
    queryFn: api.medicines.my,
    retry: false,
  });

  const {
    data: sentRequests,
    isPending: pendingSent,
    isError: errSent,
    refetch: refSent,
  } = useQuery({
    queryKey: ["requests-sent", "dashboard"],
    queryFn: () => api.requests.sent({ page: 1, limit: 1 }),
    retry: false,
  });

  const {
    data: receivedStats,
    isPending: pendingRecv,
    isError: errRecv,
    refetch: refRecv,
  } = useQuery({
    queryKey: ["requests-received", "dashboard"],
    queryFn: () => api.requests.received({ page: 1, limit: 1 }),
    retry: false,
  });

  const {
    data: pendingList,
    isPending: pendingPanelList,
    isError: errPanelList,
    refetch: refPanelList,
  } = useQuery({
    queryKey: ["requests-received", "dashboard", "pending"],
    queryFn: () => api.requests.received({ page: 1, limit: 5, status: "pending" }),
    retry: false,
  });

  const {
    data: subStatus,
    isPending: pendingSub,
    isError: errSub,
    refetch: refSub,
  } = useQuery({
    queryKey: ["sub-status"],
    queryFn: api.subscriptions.status,
    retry: false,
  });

  const {
    data: notifData,
    isPending: pendingNotif,
    isError: errNotif,
    refetch: refNotif,
  } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.notifications.my(),
    retry: false,
  });

  const hasAnyError = errMed || errSent || errRecv || errPanelList || errSub || errNotif;

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refMed(), refSent(), refRecv(), refPanelList(), refSub(), refNotif()]);
    } finally {
      setIsRetrying(false);
    }
  };

  const pendingReceived = pendingList?.data ?? [];

  return (
    <Layout title={t.nav.dashboard}>
      <div className="space-y-6">
        {/* Welcome — not h1 (Layout already renders h2), use styled div */}
        <section aria-label={t.dashboard.welcome.replace("{name}", pharmacy?.name ?? "")}>
          <p className="text-xl font-semibold tracking-tight text-brand-navy">
            {t.dashboard.welcome.replace("{name}", pharmacy?.name ?? "")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </section>

        {/* Verification status — single compact banner, no emoji */}
        {pharmacy?.verificationStatus === "pending" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-amber-800">{t.dashboard.reviewPending}</p>
          </div>
        )}
        {pharmacy?.verificationStatus === "rejected" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-destructive">
              {t.dashboard.reviewRejected.replace("{reason}", pharmacy.rejectionReason ?? t.dashboard.reviewRejectedFallback)}
            </p>
          </div>
        )}

        {/* Subscription — compact card, not banner */}
        {subStatus && !subStatus.isSubscribed && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-brand-teal-soft/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-navy">{t.dashboard.subInactiveTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.dashboard.subInactiveDesc}</p>
            </div>
            <Link
              href="/subscriptions"
              className={cn(
                "inline-flex min-h-[36px] items-center justify-center rounded-lg bg-brand-teal-deep px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-navy",
                FOCUS_RING
              )}
            >
              {t.dashboard.subViewPlans}
            </Link>
          </div>
        )}
        {subStatus?.isSubscribed && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-navy">
                {t.dashboard.subActiveLabel
                  .replace(
                    "{plan}",
                    subStatus.plan === "monthly"
                      ? t.dashboard.plan.monthly
                      : subStatus.plan === "yearly"
                        ? t.dashboard.plan.yearly
                        : t.dashboard.plan.free
                  )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {subStatus.daysRemaining !== null
                  ? t.dashboard.subDaysLeft.replace("{count}", numberFormatter.format(subStatus.daysRemaining))
                  : ""}
              </p>
            </div>
            <span className="inline-flex min-h-[30px] items-center rounded-full bg-brand-teal-deep px-3 py-1 text-xs font-medium text-white">
              {t.dashboard.subActiveBadge}
            </span>
          </div>
        )}
        {pendingSub && !subStatus && (
          <div className="rounded-xl border border-border bg-background p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        )}

        {/* Global error — unified, shows only if any query failed, does not hide successful data */}
        {hasAnyError && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{t.dashboard.errors.load}</AlertTitle>
            <AlertDescription className="mt-1 flex flex-col gap-3">
              <span>{t.dashboard.errors.loadDesc}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAll}
                disabled={isRetrying}
                className="w-fit bg-background"
              >
                {isRetrying ? t.dashboard.errors.retrying : t.dashboard.errors.retry}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPI cards — brand/semantic only, responsive 1 / sm:2 / xl:4 */}
        <section aria-label={t.dashboard.kpiSection}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* My medicines */}
            <Link
              href="/my-medicines"
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal-deep">
                <Package className="size-5" aria-hidden="true" />
              </span>
              {pendingMed && !medicines ? (
                <>
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : errMed && !medicines ? (
                <>
                  <p className="text-2xl font-bold text-brand-navy">—</p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.myMedicines}</p>
                  <p className="text-xs text-muted-foreground">—</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight text-brand-navy">
                    {numberFormatter.format(medicines?.length ?? 0)}
                  </p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.myMedicines}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.dashboard.kpi.myMedicinesSub.replace(
                      "{count}",
                      numberFormatter.format(medicines?.filter((m) => m.isAvailable).length ?? 0)
                    )}
                  </p>
                </>
              )}
            </Link>

            {/* Incoming requests */}
            <Link
              href="/requests"
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal-deep">
                <ArrowLeftRight className="size-5" aria-hidden="true" />
              </span>
              {pendingRecv && !receivedStats ? (
                <>
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : errRecv && !receivedStats ? (
                <>
                  <p className="text-2xl font-bold text-brand-navy">—</p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.incoming}</p>
                  <p className="text-xs text-muted-foreground">—</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight text-brand-navy">
                    {numberFormatter.format(receivedStats?.pagination.total ?? 0)}
                  </p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.incoming}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.dashboard.kpi.incomingSub.replace(
                      "{count}",
                      numberFormatter.format(receivedStats?.pending ?? 0)
                    )}
                  </p>
                </>
              )}
            </Link>

            {/* Sent requests */}
            <Link
              href="/requests"
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal-deep">
                <ArrowLeftRight className="size-5 scale-x-[-1]" aria-hidden="true" />
              </span>
              {pendingSent && !sentRequests ? (
                <>
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : errSent && !sentRequests ? (
                <>
                  <p className="text-2xl font-bold text-brand-navy">—</p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.sent}</p>
                  <p className="text-xs text-muted-foreground">—</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight text-brand-navy">
                    {numberFormatter.format(sentRequests?.pagination.total ?? 0)}
                  </p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.sent}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.dashboard.kpi.sentSub.replace(
                      "{count}",
                      numberFormatter.format(sentRequests?.pending ?? 0)
                    )}
                  </p>
                </>
              )}
            </Link>

            {/* Notifications */}
            <Link
              href="/notifications"
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal-deep">
                <Bell className="size-5" aria-hidden="true" />
              </span>
              {pendingNotif && !notifData ? (
                <>
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : errNotif && !notifData ? (
                <>
                  <p className="text-2xl font-bold text-brand-navy">—</p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.notifications}</p>
                  <p className="text-xs text-muted-foreground">—</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight text-brand-navy">
                    {numberFormatter.format(notifData?.unreadCount ?? 0)}
                  </p>
                  <p className="text-sm font-medium text-brand-navy">{t.dashboard.kpi.notifications}</p>
                  <p className="text-xs text-muted-foreground">{t.dashboard.kpi.notificationsSub}</p>
                </>
              )}
            </Link>
          </div>
        </section>

        {/* Pending requests — always visible */}
        <section aria-label={t.dashboard.pendingTitle}>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-brand-navy">{t.dashboard.pendingTitle}</h3>
              <Link
                href="/requests"
                className={cn(
                  "text-xs font-medium text-brand-teal-deep underline-offset-4 hover:underline",
                  FOCUS_RING,
                  "rounded-md px-2 py-1"
                )}
              >
                {t.dashboard.pendingViewAll}
              </Link>
            </div>

            {pendingPanelList && !pendingList ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : errPanelList && !pendingList ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t.dashboard.pendingFailed}</p>
            ) : pendingReceived.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-brand-navy">{t.dashboard.pendingEmptyTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.dashboard.pendingEmptyDesc}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReceived.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-navy">{req.medicineName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.dashboard.pendingFrom
                          .replace("{name}", req.requesterName)
                          .replace("{qty}", numberFormatter.format(req.requestedQuantity))}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {t.dashboard.pendingBadge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick actions — 1 / sm:3, primary is add medicine */}
        <section aria-label={t.dashboard.actionsSection}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/my-medicines"
              className={cn(
                "flex flex-col gap-2 rounded-xl bg-brand-teal-deep p-5 text-white transition-colors hover:bg-brand-navy",
                FOCUS_RING
              )}
            >
              <Plus className="size-5" aria-hidden="true" />
              <span className="text-sm font-semibold">{t.dashboard.actions.addTitle}</span>
              <span className="text-xs text-white/80">{t.dashboard.actions.addDesc}</span>
            </Link>

            <Link
              href="/browse"
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <Search className="size-5 text-brand-teal-deep" aria-hidden="true" />
              <span className="text-sm font-semibold text-brand-navy">{t.dashboard.actions.browseTitle}</span>
              <span className="text-xs text-muted-foreground">{t.dashboard.actions.browseDesc}</span>
            </Link>

            <Link
              href="/ai"
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-teal-soft hover:bg-brand-teal-soft/20",
                FOCUS_RING
              )}
            >
              <Sparkles className="size-5 text-brand-teal-deep" aria-hidden="true" />
              <span className="text-sm font-semibold text-brand-navy">{t.dashboard.actions.aiTitle}</span>
              <span className="text-xs text-muted-foreground">{t.dashboard.actions.aiDesc}</span>
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
