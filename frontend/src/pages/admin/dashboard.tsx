import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout";
import { api, formatPrice } from "@/lib/api";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

const VERIFICATION_BADGES: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "معتمدة", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "مرفوضة", cls: "bg-red-100 text-red-600" },
};

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<"overview" | "pharmacies" | "medicines">("overview");
  const [pharmaciesPage, setPharmaciesPage] = useState(1);
  const [medicinesPage, setMedicinesPage] = useState(1);
  const qc = useQueryClient();
  const [actionError, setActionError] = useState("");

  const decideMut = useMutation({
    mutationFn: ({ id, decision, reason }: { id: number; decision: "approve" | "reject"; reason?: string }) =>
      api.admin.decideVerification(id, decision, reason),
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["admin-pharmacies"] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const decide = (id: number, decision: "approve" | "reject") => {
    if (decision === "approve" && !confirm("اعتماد هذه الصيدلية وتمكينها من التبادل؟")) return;
    let reason: string | undefined;
    if (decision === "reject") {
      const entered = prompt("سبب الرفض (سيصل للصيدلية ويُسجل بالتدقيق):");
      if (!entered || entered.trim().length < 5) return;
      reason = entered;
    }
    decideMut.mutate({ id, decision, reason: reason ?? undefined });
  };

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
    { label: "إجمالي الصيدليات", value: stats?.totalPharmacies ?? 0, color: "emerald" },
    { label: "إجمالي الأدوية", value: stats?.totalMedicines ?? 0, color: "blue" },
    { label: "إجمالي الطلبات", value: stats?.totalRequests ?? 0, color: "violet" },
    { label: "اشتراكات نشطة", value: stats?.activeSubscriptions ?? 0, color: "amber" },
    { label: "طلبات معلقة", value: stats?.pendingRequests ?? 0, color: "red" },
  ];

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <AdminLayout title="لوحة تحكم الإدارة">
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: "overview", label: "نظرة عامة" },
          { id: "pharmacies", label: "الصيدليات" },
          { id: "medicines", label: "الأدوية" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
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
                {["الاسم", "المسؤول", "البريد الإلكتروني", "المدينة", "الاعتماد", "السجل التجاري", ""].map((h) => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pharmacies?.data ?? []).map((p) => {
                const badge = VERIFICATION_BADGES[p.verificationStatus] ?? VERIFICATION_BADGES.pending;
                return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.managerName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs" dir="ltr">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600">{p.city}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
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
                        📎 {p.licenseDocName ?? "المستند"}
                      </a>
                    ) : (
                      <span className="text-slate-400">لا يوجد ملف</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.verificationStatus !== "approved" && (
                      <button
                        onClick={() => decide(p.id, "approve")}
                        disabled={decideMut.isPending}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60 min-h-[36px]"
                      >
                        اعتماد
                      </button>
                    )}
                    {p.verificationStatus === "pending" && (
                      <button
                        onClick={() => decide(p.id, "reject")}
                        disabled={decideMut.isPending}
                        className="ms-1 border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-60 min-h-[36px]"
                      >
                        رفض
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
            <Pagination className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
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
                      <PaginationEllipsis />
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
                {["اسم الدواء", "الصيدلية", "المدينة", "الكمية", "السعر (JOD)", "الصلاحية", "الحالة"].map((h) => (
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
                      {m.isAvailable ? "متاح" : "غير متاح"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(medicines?.pagination.total ?? 0) > PAGE_SIZE && (
            <Pagination className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
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
                      <PaginationEllipsis />
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
    </AdminLayout>
  );
}
