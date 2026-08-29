import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout";
import { api, formatPrice } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState, useEffect } from "react";

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

const VERIFICATION_BADGES: Record<string, { cls: string }> = {
  pending: { cls: "bg-amber-100 text-amber-700" },
  approved: { cls: "bg-emerald-100 text-emerald-700" },
  rejected: { cls: "bg-red-100 text-red-600" },
};

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"overview" | "pharmacies" | "medicines">("overview");
  const [pharmaciesPage, setPharmaciesPage] = useState(1);
  const [medicinesPage, setMedicinesPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const qc = useQueryClient();
  const [actionError, setActionError] = useState("");

  const decideMut = useMutation({
    mutationFn: ({ id, decision, reason }: { id: number; decision: "approve" | "reject"; reason?: string }) =>
      api.admin.decideVerification(id, decision, reason),
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["admin-pharmacies"] });
    },
    onError: (e: Error) => setActionError(getErrorMessage(t, e, t.admin.errors.action)),
  });

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: api.admin.stats });
  const { data: pharmacies } = useQuery({
    queryKey: ["admin-pharmacies", pharmaciesPage],
    queryFn: () => api.admin.pharmacies({ page: pharmaciesPage, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const { data: medicines } = useQuery({
    queryKey: ["admin-medicines", medicinesPage],
    queryFn: () => api.admin.medicines({ page: medicinesPage, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const pharmaciesTotalPages = Math.max(1, Math.ceil((pharmacies?.pagination.total ?? 0) / PAGE_SIZE));
  const medicinesTotalPages = Math.max(1, Math.ceil((medicines?.pagination.total ?? 0) / PAGE_SIZE));

  useEffect(() => {
    if (pharmaciesPage > pharmaciesTotalPages) setPharmaciesPage(pharmaciesTotalPages);
  }, [pharmaciesPage, pharmaciesTotalPages]);

  useEffect(() => {
    if (medicinesPage > medicinesTotalPages) setMedicinesPage(medicinesTotalPages);
  }, [medicinesPage, medicinesTotalPages]);

  const statCards = [
    { label: t.admin.stats.totalPharmacies, value: stats?.totalPharmacies ?? 0, color: "emerald" },
    { label: t.admin.stats.totalMedicines, value: stats?.totalMedicines ?? 0, color: "blue" },
    { label: t.admin.stats.totalRequests, value: stats?.totalRequests ?? 0, color: "violet" },
    { label: t.admin.stats.activeSubscriptions, value: stats?.activeSubscriptions ?? 0, color: "amber" },
    { label: t.admin.stats.pendingRequests, value: stats?.pendingRequests ?? 0, color: "red" },
  ];

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <AdminLayout title={t.admin.title}>
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: "overview", label: t.admin.tabs.overview },
          { id: "pharmacies", label: t.admin.tabs.pharmacies },
          { id: "medicines", label: t.admin.tabs.medicines },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === tabItem.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className={`rounded-xl border p-5 ${colorMap[s.color]}`}>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs font-medium text-slate-700 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pharmacies */}
      {tab === "pharmacies" && (
        <div className="space-y-3">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  t.admin.table.name,
                  t.admin.table.manager,
                  t.admin.table.email,
                  t.admin.table.city,
                  t.admin.table.verification,
                  t.admin.table.license,
                  t.admin.table.actions,
                ].map((h) => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pharmacies?.data ?? []).map((p) => {
                const badgeStatus = p.verificationStatus === "approved" ? "approved" : p.verificationStatus === "rejected" ? "rejected" : "pending";
                return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.managerName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs" dir="ltr">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600">{p.city}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${VERIFICATION_BADGES[badgeStatus].cls}`}>
                      {t.admin.verification[badgeStatus]}
                    </span>
                    {p.verificationStatus === "rejected" && p.rejectionReason && (
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[160px]">{p.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.licenseNumber && <p className="text-slate-600" dir="ltr">{p.licenseNumber}</p>}
                    {p.hasLicenseDoc ? (
                      <a
                        href={api.admin.licenseDocumentUrl(p.id)}
                        className="text-emerald-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        📎 {p.licenseDocName ?? t.admin.table.document}
                      </a>
                    ) : (
                      <span className="text-slate-400">{t.admin.table.noFile}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.verificationStatus !== "approved" && (
                      <button
                        onClick={() => setApproveTarget(p.id)}
                        disabled={decideMut.isPending}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60 min-h-[36px]"
                      >
                        {t.admin.actions.approve}
                      </button>
                    )}
                    {p.verificationStatus === "pending" && (
                      <button
                        onClick={() => {
                          setRejectTarget(p.id);
                          setRejectReason("");
                          setRejectOpen(true);
                        }}
                        disabled={decideMut.isPending}
                        className="ms-1 border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-60 min-h-[36px]"
                      >
                        {t.admin.actions.reject}
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {(pharmacies?.pagination.total ?? 0) > PAGE_SIZE && (
            <Pagination label={t.common.pagination.paginationLabel} className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    label={t.common.pagination.previous}
                    onClick={(e) => {
                      e.preventDefault();
                      if (pharmaciesPage > 1) setPharmaciesPage(pharmaciesPage - 1);
                    }}
                    className={pharmaciesPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {buildPageItems(pharmaciesPage, pharmaciesTotalPages).map((item, index) =>
                  item === "…" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis label={t.common.pagination.morePages} />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === pharmaciesPage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPharmaciesPage(item);
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
                      if (pharmaciesPage < pharmaciesTotalPages) setPharmaciesPage(pharmaciesPage + 1);
                    }}
                    className={pharmaciesPage >= pharmaciesTotalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Medicines */}
      {tab === "medicines" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  t.admin.table.medicineName,
                  t.admin.table.pharmacy,
                  t.admin.table.medicineCity,
                  t.admin.table.quantity,
                  t.admin.table.price,
                  t.admin.table.expiry,
                  t.admin.table.status,
                ].map((h) => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(medicines?.data ?? []).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.pharmacyName}</td>
                  <td className="px-4 py-3 text-slate-500">{m.pharmacyCity}</td>
                  <td className="px-4 py-3 text-slate-600">{m.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{formatPrice(m.price)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.expiryDate}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      m.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {m.isAvailable ? t.admin.availability.available : t.admin.availability.unavailable}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(medicines?.pagination.total ?? 0) > PAGE_SIZE && (
            <Pagination label={t.common.pagination.paginationLabel} className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    label={t.common.pagination.previous}
                    onClick={(e) => {
                      e.preventDefault();
                      if (medicinesPage > 1) setMedicinesPage(medicinesPage - 1);
                    }}
                    className={medicinesPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {buildPageItems(medicinesPage, medicinesTotalPages).map((item, index) =>
                  item === "…" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis label={t.common.pagination.morePages} />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === medicinesPage}
                        onClick={(e) => {
                          e.preventDefault();
                          setMedicinesPage(item);
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
                      if (medicinesPage < medicinesTotalPages) setMedicinesPage(medicinesPage + 1);
                    }}
                    className={medicinesPage >= medicinesTotalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Approve confirmation */}
      <AlertDialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.dialogs.approveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.dialogs.approveDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admin.dialogs.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (approveTarget !== null) decideMut.mutate({ id: approveTarget, decision: "approve" });
              }}
            >
              {t.admin.dialogs.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject with reason */}
      <AlertDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.dialogs.rejectTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.dialogs.rejectDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder={t.admin.dialogs.reasonPlaceholder}
            aria-label={t.admin.dialogs.rejectDesc}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          {rejectReason.trim().length > 0 && rejectReason.trim().length < 5 && (
            <p className="text-xs text-red-600">{t.admin.dialogs.reasonShort}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admin.dialogs.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={rejectReason.trim().length < 5}
              onClick={() => {
                if (rejectTarget !== null) {
                  decideMut.mutate({ id: rejectTarget, decision: "reject", reason: rejectReason.trim() });
                }
              }}
            >
              {t.admin.dialogs.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}