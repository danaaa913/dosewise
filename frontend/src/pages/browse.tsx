import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Package, Search, SearchX, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
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
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api, type AvailableMedicine } from "@/lib/api";
import { isMedicineExpired } from "@/lib/utils";
import { PAGE_SIZE, buildPageItems } from "@/lib/pagination";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const DEBOUNCE_MS = 350;

function buildQtySchema(t: ReturnType<typeof useLanguage>["t"], maxQty: number, numberFmt: Intl.NumberFormat) {
  return z.any().superRefine((v: unknown, ctx) => {
    if (typeof v === "string" && v.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.browse.dialog.errors.required });
      return;
    }
    if (v === undefined || v === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.browse.dialog.errors.required });
      return;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.browse.dialog.errors.invalid });
      return;
    }
    if (n < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.browse.dialog.errors.min });
      return;
    }
    if (n > maxQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t.browse.dialog.errors.max.replace("{max}", numberFmt.format(maxQty)),
      });
    }
  });
}

export default function BrowsePage() {
  const qc = useQueryClient();
  const { t, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-JO" : "en-JO";

  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const priceFmt = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale]
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale]
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AvailableMedicine | null>(null);
  const [qty, setQty] = useState("1");
  const [qtyError, setQtyError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["available-medicines", debouncedSearch, page],
    queryFn: () => api.medicines.available({ search: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const medicines = data?.data;
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeDialog = () => {
    setSelected(null);
    setQty("1");
    setQtyError("");
    setDialogError("");
    setIdemKey(null);
  };

  const openDialog = (m: AvailableMedicine) => {
    setSelected(m);
    setQty("1");
    setQtyError("");
    setDialogError("");
    setIdemKey(crypto.randomUUID());
  };

  const restoreToOpener = (event: Event) => {
    event.preventDefault();
    openerRef.current?.focus();
  };

  const qtySchema = useMemo(
    () => buildQtySchema(t, selected?.quantity ?? 0, numberFmt),
    [t, selected, numberFmt]
  );

  const sendMut = useMutation({
    mutationFn: () =>
      api.requests.send(
        { medicineId: selected!.id, requestedQuantity: Number(qty) },
        idemKey!
      ),
    onSuccess: () => {
      toast({ title: t.browse.success });
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      closeDialog();
    },
    onError: (error: unknown) => {
      const code = (error as { code?: string })?.code;
      const known: Record<string, string> = {
        PROVIDER_UNAVAILABLE: t.errorCodes.PROVIDER_UNAVAILABLE,
        DUPLICATE_PENDING_REQUEST: t.errorCodes.DUPLICATE_PENDING_REQUEST,
        IDEMPOTENCY_KEY_REUSED: t.errorCodes.IDEMPOTENCY_KEY_REUSED,
        MEDICINE_EXPIRED: t.errorCodes.MEDICINE_EXPIRED,
      };
      setDialogError(code && known[code] ? known[code] : t.requests.errors.send);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setDialogError("");
    const result = qtySchema.safeParse(qty);
    if (!result.success) {
      setQtyError(result.error.issues[0]?.message ?? t.browse.dialog.errors.invalid);
      return;
    }
    setQtyError("");
    if (submittingRef.current) return;
    submittingRef.current = true;
    sendMut.mutate(undefined, {
      onSettled: () => {
        submittingRef.current = false;
      },
    });
  };

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  const trimmed = debouncedSearch;
  const hasData = data !== undefined;
  const isInitialLoading = isPending && data === undefined;
  const isInitialError = isError && data === undefined;
  const isEmptyMarket = hasData && !isError && total === 0 && !trimmed;
  const isNoResults = hasData && !isError && total === 0 && !!trimmed;

  return (
    <Layout title={t.browse.title}>
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">{t.browse.title}</h1>
          <p className="text-sm text-muted-foreground">{t.browse.subtitle}</p>
        </div>

        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.browse.searchPlaceholder}
            aria-label={t.browse.searchPlaceholder}
            className="ps-9 pe-9"
          />
          {search.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={t.browse.clearSearchAria}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {hasData && !isInitialError && (
            <p role="status" className="text-sm text-muted-foreground">
              {t.browse.count.replace("{count}", numberFmt.format(total))}
            </p>
          )}

          {isInitialLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          )}

          {isInitialError && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-col items-start gap-2">
                <p>{t.errors.query}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t.errors.retry}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isEmptyMarket && (
            <Empty>
              <EmptyMedia variant="icon">
                <Package className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t.browse.empty.title}</EmptyTitle>
              <EmptyDescription>{t.browse.empty.desc}</EmptyDescription>
            </Empty>
          )}

          {isNoResults && (
            <Empty>
              <EmptyMedia variant="icon">
                <SearchX className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t.browse.noResults.title}</EmptyTitle>
              <EmptyDescription>{t.browse.noResults.desc}</EmptyDescription>
              <EmptyContent>
                <Button variant="outline" onClick={clearSearch}>
                  {t.browse.noResults.clear}
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {hasData && !isInitialError && (medicines?.length ?? 0) > 0 && (
            <>
              {isError && (
                <Alert variant="destructive">
                  <AlertDescription>{t.errors.query}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {medicines!.map((m) => (
                  <Card key={m.id} className="flex min-w-0 flex-col">
                    <CardHeader className="p-5 pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="min-w-0 break-words text-sm font-semibold leading-snug text-brand-navy">
                          {m.name}
                        </CardTitle>
                        <span className="shrink-0 rounded-full bg-brand-teal-soft px-2.5 py-1 text-xs font-medium text-brand-teal-deep">
                          {priceFmt.format(Number(m.price))} {t.browse.jod}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 p-5 pt-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.browse.card.provider}:</span>{" "}
                        {m.pharmacyName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.browse.card.city}:</span>{" "}
                        {m.pharmacyCity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.browse.card.quantity}:</span>{" "}
                        {numberFmt.format(m.quantity)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.browse.card.expires}:</span>{" "}
                        {dateFmt.format(new Date(m.expiryDate + "T00:00:00Z"))}
                        {isMedicineExpired(m.expiryDate) && (
                          <span className="ms-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            {t.browse.card.expired}
                          </span>
                        )}
                      </p>
                      {m.description ? (
                        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {m.description}
                        </p>
                      ) : null}
                    </CardContent>
                    <CardFooter className="p-5 pt-3">
                      <Button
                        onClick={(e) => {
                          openerRef.current = e.currentTarget;
                          openDialog(m);
                        }}
                        aria-label={t.browse.card.requestAria.replace("{name}", m.name)}
                        className="w-full bg-brand-teal-deep text-white hover:bg-brand-navy"
                      >
                        {t.browse.card.request}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              {total > PAGE_SIZE && (
                <Pagination label={t.common.pagination.paginationLabel}>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        label={t.common.pagination.previous}
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
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
                              setPage(item);
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
                          if (page < totalPages) setPage(page + 1);
                        }}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          className="max-h-[85dvh] max-w-sm overflow-y-auto bg-background sm:max-w-md"
          aria-modal="true"
          closeLabel={t.browse.dialog.close}
          onCloseAutoFocus={restoreToOpener}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            qtyInputRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.browse.dialog.title}</DialogTitle>
            <DialogDescription>
              {t.browse.dialog.description.replace("{name}", selected?.name ?? "")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {dialogError && (
              <Alert variant="destructive">
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">{t.browse.dialog.provider}</p>
                <p className="break-words text-sm font-medium text-foreground">
                  {selected?.pharmacyName} <span className="text-muted-foreground">— {selected?.pharmacyCity}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t.browse.dialog.available}</p>
                <p className="text-sm font-medium text-foreground">{numberFmt.format(selected?.quantity ?? 0)}</p>
                <p className="text-xs font-medium text-brand-teal-deep">
                  {priceFmt.format(Number(selected?.price ?? 0))} {t.browse.jod} · {t.browse.dialog.price}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-qty">{t.browse.dialog.qtyLabel}</Label>
              <Input
                id="req-qty"
                name="requestedQuantity"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                ref={qtyInputRef}
                dir="ltr"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  if (qtyError) setQtyError("");
                }}
                placeholder={t.browse.dialog.qtyPlaceholder}
                aria-invalid={!!qtyError}
                aria-describedby={qtyError ? "req-qty-error" : undefined}
              />
              {qtyError && (
                <p id="req-qty-error" className="text-xs text-destructive">
                  {qtyError}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={sendMut.isPending}>
                {t.browse.dialog.cancel}
              </Button>
              <Button
                type="submit"
                disabled={sendMut.isPending || !idemKey}
                className="bg-brand-teal-deep text-white hover:bg-brand-navy"
              >
                {sendMut.isPending ? t.browse.dialog.submitting : t.browse.dialog.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}