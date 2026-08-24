import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import brandLogo from "@assets/brand-logo.jpeg";

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password.trim()) {
      setError("يرجى تعبئة البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      await api.admin.login(form);
      await refresh();
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "بيانات دخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e1f33] via-[#142d49] to-[#1b3a5f] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 bg-white rounded-2xl p-3 shadow-lg">
            <img
              src={brandLogo}
              alt="DoseWise"
              className="h-20 w-auto object-contain select-none"
              draggable={false}
            />
          </div>
          <h1 className="text-xl font-bold text-white mt-2">لوحة الإدارة</h1>
          <p className="text-slate-300 text-sm mt-1">DoseWise Admin · الأردن</p>
        </div>

        <div className="bg-[#0e1f33]/80 backdrop-blur rounded-2xl p-7 border border-white/10">
          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="admin@dosewise.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "جاري التحقق..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
