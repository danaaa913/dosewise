import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { useState } from "react";

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<"overview" | "pharmacies" | "medicines">("overview");

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: api.admin.stats });
  const { data: pharmacies } = useQuery({ queryKey: ["admin-pharmacies"], queryFn: api.admin.pharmacies });
  const { data: medicines } = useQuery({ queryKey: ["admin-medicines"], queryFn: api.admin.medicines });

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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["الاسم", "المسؤول", "البريد الإلكتروني", "المدينة", "الاشتراك", "التسجيل"].map((h) => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pharmacies ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.managerName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs" dir="ltr">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600">{p.city}</td>
                  <td className="px-4 py-3">
                    {p.isSubscribed ? (
                      <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                        {p.subscriptionPlan === "monthly" ? "شهري" : p.subscriptionPlan === "yearly" ? "سنوي" : "مجاني"}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-full">غير مشترك</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("ar-JO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {(medicines ?? []).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.pharmacyName}</td>
                  <td className="px-4 py-3 text-slate-500">{m.pharmacyCity}</td>
                  <td className="px-4 py-3 text-slate-600">{m.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{m.price.toFixed(2)}</td>
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
        </div>
      )}
    </AdminLayout>
  );
}
