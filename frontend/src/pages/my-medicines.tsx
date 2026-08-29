import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api, type Medicine } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn, isMedicineExpired, FOCUS_RING } from "@/lib/utils";
import { z } from "zod";

type FormData = {
  name: string;
  quantity: string;
  price: string;
  expiryDate: string;
  description: string;
  isAvailable: boolean;
};

const emptyForm: FormData = {
  name: "",
  quantity: "",
  price: "",
  expiryDate: "",
  description: "",
  isAvailable: true,
};

function isValidCalendarDate(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d;
}

const emptyToUndefined = (v: unknown): unknown => {
  if (v === null) return Number.NaN;
  return typeof v === "string" && v.trim() === "" ? undefined : v;
};
const emptyToNaN = (v: unknown): unknown => {
  if (v === null) return Number.NaN;
  return typeof v === "string" && v.trim() === "" ? Number.NaN : v;
};

function getAddSchema(t: any) {
  return z.object({
    name: z.string().trim().min(2, t.myMedicines.errors.nameRequired).max(100, t.myMedicines.errors.nameMax),
    quantity: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: t.myMedicines.errors.quantityNonNumeric })
        .finite()
        .int(t.myMedicines.errors.quantityInvalid)
        .min(0, t.myMedicines.errors.quantityInvalid)
        .max(2147483647, t.myMedicines.errors.quantityInvalid)
    ),
    price: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ invalid_type_error: t.myMedicines.errors.priceNonNumeric })
        .finite()
        .min(0, t.myMedicines.errors.priceInvalid)
        .max(99999999.99, t.myMedicines.errors.priceInvalid)
        .multipleOf(0.01, t.myMedicines.errors.priceInvalid)
    ),
    expiryDate: z
      .string()
      .min(1, t.myMedicines.errors.expiryRequired)
      .regex(/^\d{4}-\d{2}-\d{2}$/, t.myMedicines.errors.expiryInvalid)
      .refine(isValidCalendarDate, t.myMedicines.errors.expiryInvalid),
    description: z.string().max(500, t.myMedicines.errors.descriptionMax).optional(),
    isAvailable: z.boolean().optional(),
  });
}

function getUpdateSchema(t: any) {
  return z
    .object({
      name: z.string().trim().min(2, t.myMedicines.errors.nameRequired).max(100, t.myMedicines.errors.nameMax).optional(),
      quantity: z.preprocess(emptyToNaN, z.coerce.number({ invalid_type_error: t.myMedicines.errors.quantityNonNumeric }).finite().int(t.myMedicines.errors.quantityInvalid).min(0, t.myMedicines.errors.quantityInvalid).max(2147483647, t.myMedicines.errors.quantityInvalid)).optional(),
      price: z.preprocess(emptyToNaN, z.coerce.number({ invalid_type_error: t.myMedicines.errors.priceNonNumeric }).finite().min(0, t.myMedicines.errors.priceInvalid).max(99999999.99, t.myMedicines.errors.priceInvalid).multipleOf(0.01, t.myMedicines.errors.priceInvalid)).optional(),
      expiryDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, t.myMedicines.errors.expiryInvalid)
        .refine(isValidCalendarDate, t.myMedicines.errors.expiryInvalid)
        .optional(),
      description: z.string().max(500, t.myMedicines.errors.descriptionMax).optional(),
      isAvailable: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: t.myMedicines.errors.generic });
}

export default function MyMedicinesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
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

  const openerRef = useRef<HTMLElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const deleteJustSucceeded = useRef(false);

  const restoreToOpener = (event: Event) => {
    event.preventDefault();
    const el = openerRef.current;
    if (el && "focus" in el) el.focus();
  };

  const restoreAfterDelete = (event: Event) => {
    event.preventDefault();
    if (deleteJustSucceeded.current) {
      deleteJustSucceeded.current = false;
      addBtnRef.current?.focus();
    } else if (openerRef.current && "focus" in openerRef.current) {
      openerRef.current.focus();
    }
  };

  const { data: medicines, isPending, isError, error, refetch } = useQuery({
    queryKey: ["my-medicines"],
    queryFn: api.medicines.my,
    retry: false,
  });

  const addMut = useMutation({
    mutationFn: (data: FormData) =>
      api.medicines.add({
        name: data.name.trim(),
        quantity: Number(data.quantity),
        price: Number(data.price),
        expiryDate: data.expiryDate,
        description: data.description?.trim() || undefined,
        isAvailable: data.isAvailable,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-medicines"] });
      qc.invalidateQueries({ queryKey: ["available-medicines"] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setFieldErrors({});
      setFormError("");
    },
    onError: () => setFormError(t.myMedicines.errors.addError),
  });

  const updateMut = useMutation({
    mutationFn: (data: FormData) =>
      api.medicines.update(editing!.id, {
        name: data.name.trim(),
        quantity: Number(data.quantity),
        price: Number(data.price),
        expiryDate: data.expiryDate,
        description: data.description.trim(),
        isAvailable: data.isAvailable,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-medicines"] });
      qc.invalidateQueries({ queryKey: ["available-medicines"] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setFieldErrors({});
      setFormError("");
    },
    onError: () => setFormError(t.myMedicines.errors.updateError),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.medicines.delete(id),
    onSuccess: () => {
      deleteJustSucceeded.current = true;
      qc.invalidateQueries({ queryKey: ["my-medicines"] });
      qc.invalidateQueries({ queryKey: ["available-medicines"] });
      setDeleteTarget(null);
    },
    onError: () => setFormError(t.myMedicines.errors.deleteError),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({
      name: m.name,
      quantity: String(m.quantity),
      price: String(m.price),
      expiryDate: m.expiryDate,
      description: m.description ?? "",
      isAvailable: m.isAvailable,
    });
    setFieldErrors({});
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    const schema = editing ? getUpdateSchema(t) : getAddSchema(t);
    const parsed = schema.safeParse({
      name: form.name,
      quantity: form.quantity,
      price: form.price,
      expiryDate: form.expiryDate,
      description: form.description,
      isAvailable: form.isAvailable,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "generic");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length === 0) setFormError(t.myMedicines.errors.generic);
      return;
    }
    if (editing) updateMut.mutate(form);
    else addMut.mutate(form);
  };

  const closeForm = () => {
    if (addMut.isPending || updateMut.isPending) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError("");
  };

  const isSubmitting = addMut.isPending || updateMut.isPending;

  return (
    <Layout title={t.myMedicines.title}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t.myMedicines.count.replace("{count}", numberFmt.format(medicines?.length ?? 0))}
          </p>
          <Button
            ref={addBtnRef}
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              openAdd();
            }}
            className="bg-brand-teal-deep text-white hover:bg-brand-navy"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.myMedicines.add}
          </Button>
        </div>

        <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
          <DialogContent className="max-w-lg bg-background" aria-modal="true" onCloseAutoFocus={restoreToOpener} closeLabel={t.myMedicines.close}>
            <DialogHeader>
              <DialogTitle>{editing ? t.myMedicines.edit : t.myMedicines.add}</DialogTitle>
              <DialogDescription className="sr-only">
                {editing ? t.myMedicines.edit : t.myMedicines.add}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {formError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="med-name">{t.myMedicines.form.name}</Label>
                <Input
                  id="med-name"
                  name="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.myMedicines.form.namePlaceholder}
                  aria-describedby={fieldErrors.name ? "med-name-error" : undefined}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p id="med-name-error" className="text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="med-quantity">{t.myMedicines.form.quantity}</Label>
                  <Input
                    id="med-quantity"
                    name="quantity"
                    type="text"
                    inputMode="numeric"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    dir="ltr"
                    aria-describedby={fieldErrors.quantity ? "med-quantity-error" : undefined}
                    aria-invalid={!!fieldErrors.quantity}
                  />
                  {fieldErrors.quantity && (
                    <p id="med-quantity-error" className="text-xs text-destructive">
                      {fieldErrors.quantity}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="med-price">{t.myMedicines.form.price}</Label>
                  <Input
                    id="med-price"
                    name="price"
                    type="text"
                    inputMode="decimal"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    dir="ltr"
                    aria-describedby={fieldErrors.price ? "med-price-error" : undefined}
                    aria-invalid={!!fieldErrors.price}
                  />
                  {fieldErrors.price && (
                    <p id="med-price-error" className="text-xs text-destructive">
                      {fieldErrors.price}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med-expiry">{t.myMedicines.form.expiryDate}</Label>
                <Input
                  id="med-expiry"
                  name="expiryDate"
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  dir="ltr"
                  aria-describedby={fieldErrors.expiryDate ? "med-expiry-error" : undefined}
                  aria-invalid={!!fieldErrors.expiryDate}
                />
                {fieldErrors.expiryDate && (
                  <p id="med-expiry-error" className="text-xs text-destructive">
                    {fieldErrors.expiryDate}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="med-description">{t.myMedicines.form.description}</Label>
                <Textarea
                  id="med-description"
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder={t.myMedicines.form.descriptionPlaceholder}
                  aria-describedby={fieldErrors.description ? "med-description-error" : undefined}
                  aria-invalid={!!fieldErrors.description}
                  className="resize-none"
                />
                {fieldErrors.description && (
                  <p id="med-description-error" className="text-xs text-destructive">
                    {fieldErrors.description}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div>
                  <Label htmlFor="med-available" className="cursor-pointer">
                    {t.myMedicines.form.isAvailable}
                  </Label>
                  <p id="med-available-desc" className="text-xs text-muted-foreground">
                    {t.myMedicines.form.isAvailableDesc}
                  </p>
                </div>
                <Switch
                  id="med-available"
                  checked={form.isAvailable}
                  onCheckedChange={(v) => setForm({ ...form, isAvailable: v })}
                  aria-describedby="med-available-desc"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
                  {t.myMedicines.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-brand-teal-deep text-white hover:bg-brand-navy"
                >
                  {isSubmitting ? t.myMedicines.saving : editing ? t.myMedicines.save : t.myMedicines.addSubmit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent aria-modal="true" onCloseAutoFocus={restoreAfterDelete}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.myMedicines.deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.myMedicines.deleteDesc.replace("{name}", deleteTarget?.name ?? "")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {formError && deleteTarget && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteTarget(null);
                  setFormError("");
                }}
                disabled={deleteMut.isPending}
              >
                {t.myMedicines.deleteCancel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  if (!deleteTarget) return;
                  try {
                    await deleteMut.mutateAsync(deleteTarget.id);
                  } catch {
                    setFormError(t.myMedicines.errors.deleteError);
                  }
                }}
                disabled={deleteMut.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMut.isPending ? t.myMedicines.saving : t.myMedicines.deleteConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isPending && !medicines ? (
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {[
                      t.myMedicines.table.name,
                      t.myMedicines.table.quantity,
                      t.myMedicines.table.priceWithCurrency,
                      t.myMedicines.table.expiry,
                      t.myMedicines.table.status,
                      t.myMedicines.table.actions,
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-start text-xs font-semibold text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 sm:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : isError && !medicines ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{t.errors.query}</AlertTitle>
            <AlertDescription className="mt-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t.errors.retry}
              </Button>
            </AlertDescription>
          </Alert>
        ) : !medicines?.length ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Pill className="size-6" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t.empty.myMedicines}</EmptyTitle>
            <EmptyDescription>{t.empty.myMedicinesCta}</EmptyDescription>
            <EmptyContent>
              <Button
              onClick={(e) => {
                openerRef.current = e.currentTarget;
                setShowForm(true);
              }}
              className="bg-brand-teal-deep text-white hover:bg-brand-navy"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.empty.myMedicinesCta}
            </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {isError && medicines && (
              <Alert variant="destructive" role="alert" className="mb-4">
                <AlertDescription>{t.errors.query}</AlertDescription>
              </Alert>
            )}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      {[
                        t.myMedicines.table.name,
                        t.myMedicines.table.quantity,
                        t.myMedicines.table.priceWithCurrency,
                        t.myMedicines.table.expiry,
                        t.myMedicines.table.status,
                        t.myMedicines.table.actions,
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-start text-xs font-semibold text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {medicines.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-brand-navy">{m.name}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{numberFmt.format(m.quantity)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{priceFmt.format(Number(m.price))}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {dateFmt.format(new Date(m.expiryDate + "T00:00:00Z"))}
                          {isMedicineExpired(m.expiryDate) && (
                            <span className="ms-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              {t.myMedicines.table.expired}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              m.isAvailable
                                ? "bg-brand-teal-soft text-brand-teal-deep"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {m.isAvailable ? t.myMedicines.table.available : t.myMedicines.table.unavailable}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                openerRef.current = e.currentTarget;
                                openEdit(m);
                              }}
                              aria-label={t.myMedicines.table.editAria.replace("{name}", m.name)}
                              className={cn(FOCUS_RING)}
                            >
                              {t.myMedicines.table.edit}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                openerRef.current = e.currentTarget;
                                setFormError("");
                                setDeleteTarget(m);
                              }}
                              aria-label={t.myMedicines.table.deleteAria.replace("{name}", m.name)}
                              className={cn("text-destructive hover:text-destructive hover:bg-destructive/10", FOCUS_RING)}
                            >
                              {t.myMedicines.table.delete}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 p-4 sm:hidden">
                {medicines.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-brand-navy">{m.name}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                          m.isAvailable
                            ? "bg-brand-teal-soft text-brand-teal-deep"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {m.isAvailable ? t.myMedicines.table.available : t.myMedicines.table.unavailable}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t.myMedicines.table.quantity}</p>
                        <p className="font-medium text-brand-navy">{numberFmt.format(m.quantity)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t.myMedicines.table.price}</p>
                        <p className="font-medium text-brand-navy">{priceFmt.format(Number(m.price))}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">{t.myMedicines.table.expiry}</p>
                        <p className="font-medium text-brand-navy">
                          {dateFmt.format(new Date(m.expiryDate + "T00:00:00Z"))}
                          {isMedicineExpired(m.expiryDate) && (
                            <span className="ms-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              {t.myMedicines.table.expired}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          openerRef.current = e.currentTarget;
                          openEdit(m);
                        }}
                        aria-label={t.myMedicines.table.editAria.replace("{name}", m.name)}
                        className="flex-1"
                      >
                        {t.myMedicines.table.edit}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          openerRef.current = e.currentTarget;
                          setFormError("");
                          setDeleteTarget(m);
                        }}
                        aria-label={t.myMedicines.table.deleteAria.replace("{name}", m.name)}
                        className="flex-1 text-destructive hover:text-destructive"
                      >
                        {t.myMedicines.table.delete}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
