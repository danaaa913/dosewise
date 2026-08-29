import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Inbox, Send } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, type ExchangeRequest } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Translations } from "@/i18n/translations";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const PAGE_SIZE = 20;

function range(start: number, end: number): number[] {
  const len = end - start + 1;
  return Array.from({ length: len }, (_, i) => start + i);
}

function buildPageItems(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return range(1, totalPages);
  if (current <= 4) return [...range(1, 5), "…", totalPages];
  if (current >= totalPages - 3) return [1, "…", ...range(totalPages - 4, totalPages)];
  return [1, "…", ...range(current - 1, current + 1), "…", totalPages];
}

type TabKey = "received" | "sent";

type AllowableStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed"
  | "expired";

type ConfirmAction = "accept" | "reject" | "cancel" | "complete";

function parseTabFromUrl(): TabKey {
  if (typeof window === "undefined") return "received";
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  if (tabParam === "sent") return "sent";
  return "received";
}

const STATUS_META: Record<AllowableStatus, { key: AllowableStatus; cls: string }> = {
  pending: { key: "pending", cls: "bg-amber-100 text-amber-700" },
  accepted: { key: "accepted", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { key: "rejected", cls: "bg-red-100 text-red-600" },
  cancelled: { key: "cancelled", cls: "bg-slate-200 text-slate-600" },
  completed: { key: "completed", cls: "bg-blue-100 text-blue-700" },
  expired: { key: "expired", cls: "bg-slate-200 text-slate-500" },
};

const FALLBACK_STATUS: { key: AllowableStatus; cls: string } = {
  key: "expired",
  cls: "bg-slate-200 text-slate-500",
};

function requestErrorMessage(t: Translations, error: unknown): string {
  const code = (error as { code?: string })?.code;
  const known: Record<string, string> = {
    REQUEST_NOT_FOUND: t.errorCodes.REQUEST_NOT_FOUND,
    REQUEST_FORBIDDEN: t.errorCodes.REQUEST_FORBIDDEN,
    REQUESTER_UNAVAILABLE: t.errorCodes.REQUESTER_UNAVAILABLE,
    REQUEST_INVALID_STATE: t.errorCodes.REQUEST_INVALID_STATE,
    MEDICINE_NOT_FOUND: t.errorCodes.MEDICINE_NOT_FOUND,
    MEDICINE_UNAVAILABLE: t.errorCodes.MEDICINE_UNAVAILABLE,
    MEDICINE_EXPIRED: t.errorCodes.MEDICINE_EXPIRED,
    INSUFFICIENT_STOCK: t.errorCodes.INSUFFICIENT_STOCK,
  };
  if (code && known[code]) return known[code];
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|network/i.test(message)) return t.requests.errors.network;
  return t.requests.errors.generic;
}

export default function RequestsPage() {
  const qc = useQueryClient();
  const { t, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-JO" : "en-JO";
  const numberFmt = new Intl.NumberFormat(locale);
  const priceFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  const [tab, setTab] = useState<TabKey>(parseTabFromUrl);
  const [pages, setPages] = useState<Record<TabKey, number>>({ received: 1, sent: 1 });

  useEffect(() => {
    const handlePopState = () => {
      setTab(parseTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (newTab: TabKey) => {
    if (newTab === tab) return;
    setTab(newTab);
    setPages((prev) => ({ ...prev, [newTab]: 1 }));
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.pushState({}, "", url.toString());
  };
  const [confirmTarget, setConfirmTarget] = useState<{
    action: ConfirmAction;
    request: ExchangeRequest;
  } | null>(null);

  const receivedTabRef = useRef<HTMLButtonElement | null>(null);
  const sentTabRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const actionJustSucceeded = useRef(false);

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (actionJustSucceeded.current) {
      actionJustSucceeded.current = false;
      (tab === "received" ? receivedTabRef.current : sentTabRef.current)?.focus();
    } else if (openerRef.current) {
      openerRef.current.focus();
    }
  };

  const { data: received, isLoading: loadingReceived, isError: errReceived, refetch: refetchReceived } = useQuery({
    queryKey: ["requests-received", pages.received],
    queryFn: () => api.requests.received({ page: pages.received, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const { data: sent, isLoading: loadingSent, isError: errSent, refetch: refetchSent } = useQuery({
    queryKey: ["requests-sent", pages.sent],
    queryFn: () => api.requests.sent({ page: pages.sent, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((received?.pagination.total ?? 0) / PAGE_SIZE));
    if (pages.received > totalPages) setPages((prev) => ({ ...prev, received: totalPages }));
  }, [pages.received, received]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((sent?.pagination.total ?? 0) / PAGE_SIZE));
    if (pages.sent > totalPages) setPages((prev) => ({ ...prev, sent: totalPages }));
  }, [pages.sent, sent]);

  const acceptMut = useMutation({
    mutationFn: (id: number) => api.requests.accept(id),
    onSuccess: () => {
      actionJustSucceeded.current = true;
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      setConfirmTarget(null);
      toast({ title: t.requests.success.accepted });
    },
    onError: (error: unknown) => {
      setConfirmTarget(null);
      toast({ variant: "destructive", title: requestErrorMessage(t, error) });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.requests.reject(id),
    onSuccess: () => {
      actionJustSucceeded.current = true;
      qc.invalidateQueries({ queryKey: ["requests-received"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      setConfirmTarget(null);
      toast({ title: t.requests.success.rejected });
    },
    onError: (error: unknown) => {
      setConfirmTarget(null);
      toast({ variant: "destructive", title: requestErrorMessage(t, error) });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.requests.cancel(id),
    onSuccess: () => {
      actionJustSucceeded.current = true;
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      setConfirmTarget(null);
      toast({ title: t.requests.success.cancelled });
    },
    onError: (error: unknown) => {
      setConfirmTarget(null);
      toast({ variant: "destructive", title: requestErrorMessage(t, error) });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => api.requests.complete(id),
    onSuccess: () => {
      actionJustSucceeded.current = true;
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      setConfirmTarget(null);
      toast({ title: t.requests.success.completed });
    },
    onError: (error: unknown) => {
      setConfirmTarget(null);
      toast({ variant: "destructive", title: requestErrorMessage(t, error) });
    },
  });

  const actionPending =
    acceptMut.isPending || rejectMut.isPending || cancelMut.isPending || completeMut.isPending;

  const openConfirm = (action: ConfirmAction, request: ExchangeRequest, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setConfirmTarget({ action, request });
  };

  const runAction = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!confirmTarget) return;
    const id = confirmTarget.request.id;
    switch (confirmTarget.action) {
      case "accept":
        acceptMut.mutate(id);
        break;
      case "reject":
        rejectMut.mutate(id);
        break;
      case "cancel":
        cancelMut.mutate(id);
        break;
      case "complete":
        completeMut.mutate(id);
        break;
    }
  };

  const dialogLabels = (() => {
    if (!confirmTarget) return null;
    const { action, request } = confirmTarget;
    const desc = t.requests.dialogs[`${action}Desc`]
      .replace("{medicine}", request.medicineName)
      .replace("{qty}", numberFmt.format(request.requestedQuantity));
    return {
      title: t.requests.dialogs[`${action}Title`],
      desc,
      confirm: t.requests.actions[action],
      cancelLabel: action === "cancel" ? t.requests.dialogs.back : t.requests.dialogs.cancel,
      isDestructive: action === "reject" || action === "cancel",
      isAccept: action === "accept",
    };
  })();

  const pendingCount = received?.pending ?? 0;

  const renderRequests = (panel: TabKey) => {
    const loading = panel === "received" ? loadingReceived : loadingSent;
    const error = panel === "received" ? errReceived : errSent;
    const refetch = panel === "received" ? refetchReceived : refetchSent;
    const page = panel === "received" ? pages.received : pages.sent;
    const total = panel === "received"
      ? (received?.pagination.total ?? 0)
      : (sent?.pagination.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const setPanelPage = (next: number) =>
      setPages((prev) => ({ ...prev, [panel]: next }));
    const list: ExchangeRequest[] = panel === "received" ? (received?.data ?? []) : (sent?.data ?? []);

    if (loading) {
      return (
        <div aria-hidden="true" className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive" role="alert">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className={cn("mt-2", FOCUS_RING)} onClick={() => refetch()}>
            {t.errors.retry}
          </Button>
        </Alert>
      );
    }

    if (!list.length) {
      return (
        <Empty>
          <EmptyMedia variant="icon">
            {panel === "received" ? <Inbox className="size-6" /> : <Send className="size-6" />}
          </EmptyMedia>
          <EmptyTitle>
            {panel === "received" ? t.empty.requestsReceived : t.empty.requestsSent}
          </EmptyTitle>
        </Empty>
      );
    }

    return (
      <div className="space-y-3">
        {list.map((req) => {
          const statusMeta = STATUS_META[req.status] ?? FALLBACK_STATUS;
          const total = Number(req.unitPrice) * req.requestedQuantity;
          return (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusMeta.cls}`}>
                      {t.requests.status[statusMeta.key]}
                    </span>
                    <span className="text-xs text-slate-400">
                      #{req.id} — {dateFmt.format(new Date(req.requestDate))}
                    </span>
                  </div>
                  <h4 className="mt-1 font-semibold text-slate-800 text-sm break-words">
                    {req.medicineName}
                  </h4>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-500">
                    <span className="min-w-0">
                      <span className="text-slate-600 font-medium">{t.requests.fields.requester}: </span>
                      <span className="break-words">{req.requesterName}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="text-slate-600 font-medium">{t.requests.fields.provider}: </span>
                      <span className="break-words">{req.providerName}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="text-slate-600 font-medium">{t.requests.fields.quantity}: </span>
                      {numberFmt.format(req.requestedQuantity)}
                    </span>
                    <span className="min-w-0">
                      <span className="text-slate-600 font-medium">{t.requests.fields.unitPrice}: </span>
                      {priceFmt.format(Number(req.unitPrice))} {t.browse.jod}
                    </span>
                    <span className="min-w-0">
                      <span className="text-slate-600 font-medium">{t.requests.fields.total}: </span>
                      {priceFmt.format(total)} {t.browse.jod}
                    </span>
                  </div>
                  {req.responseDate && (
                    <p className="text-xs text-slate-400 mt-1">
                      {t.requests.fields.responseDate}: {dateFmt.format(new Date(req.responseDate))}
                    </p>
                  )}
                </div>

                {panel === "received" && req.status === "pending" && (
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className={cn("min-h-11 bg-emerald-600 text-white hover:bg-emerald-700", FOCUS_RING)}
                      disabled={actionPending}
                      aria-label={t.requests.actions.acceptAria.replace("{medicine}", req.medicineName)}
                      onClick={(e) => openConfirm("accept", req, e.currentTarget)}
                    >
                      {t.requests.actions.accept}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("min-h-11 border-red-300 text-red-600 hover:bg-red-50", FOCUS_RING)}
                      disabled={actionPending}
                      aria-label={t.requests.actions.rejectAria.replace("{medicine}", req.medicineName)}
                      onClick={(e) => openConfirm("reject", req, e.currentTarget)}
                    >
                      {t.requests.actions.reject}
                    </Button>
                  </div>
                )}

                {panel === "sent" && req.status === "pending" && (
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("min-h-11 text-slate-600", FOCUS_RING)}
                      disabled={actionPending}
                      aria-label={t.requests.actions.cancelAria.replace("{medicine}", req.medicineName)}
                      onClick={(e) => openConfirm("cancel", req, e.currentTarget)}
                    >
                      {t.requests.actions.cancel}
                    </Button>
                  </div>
                )}

                {panel === "sent" && req.status === "accepted" && (
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className={cn("min-h-11 bg-blue-600 text-white hover:bg-blue-700", FOCUS_RING)}
                      disabled={actionPending}
                      aria-label={t.requests.actions.completeAria.replace("{medicine}", req.medicineName)}
                      onClick={(e) => openConfirm("complete", req, e.currentTarget)}
                    >
                      {t.requests.actions.complete}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {total > PAGE_SIZE && (
          <Pagination label={t.common.pagination.paginationLabel} className="pt-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  label={t.common.pagination.previous}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPanelPage(page - 1);
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
              {buildPageItems(page, totalPages).map((item, index) =>
                item === "…" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis label={t.common.pagination.morePages} />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      isActive={item === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPanelPage(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  label={t.common.pagination.next}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPanelPage(page + 1);
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    );
  };

  return (
    <Layout title={t.nav.requests}>
      <Tabs
        value={tab}
        onValueChange={(value) => handleTabChange(value as TabKey)}
      >
        <TabsList className="mb-6 h-auto min-h-11 gap-1 rounded-lg bg-slate-100 p-1">
          <TabsTrigger
            ref={receivedTabRef}
            value="received"
            className="min-h-11 gap-2 rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm"
          >
            {t.requests.tabs.received}
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {numberFmt.format(pendingCount)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            ref={sentTabRef}
            value="sent"
            className="min-h-11 rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm"
          >
            {t.requests.tabs.sent}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">{renderRequests("received")}</TabsContent>
        <TabsContent value="sent">{renderRequests("sent")}</TabsContent>
      </Tabs>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && !actionPending) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent aria-modal="true" onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogLabels?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogLabels?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmTarget(null)}
              disabled={actionPending}
            >
              {dialogLabels?.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={runAction}
              disabled={actionPending}
              className={cn(
                dialogLabels?.isDestructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : dialogLabels?.isAccept
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {actionPending ? t.requests.processing : dialogLabels?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
