import { useState } from "react";
import { useLocation, Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import brandLogo from "@assets/brand-logo.jpeg";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.login(form);
      await refresh();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eaf2f3] via-[#f6fafa] to-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <img
            src={brandLogo}
            alt="DoseWise"
            className="mx-auto h-32 w-auto object-contain mb-2 select-none"
            draggable={false}
          />
          <p className="text-[#1b3a5f]/70 text-sm">منصة تبادل الأدوية للصيدليات</p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <span aria-hidden>📍</span>
            <span>الأردن (Jordan) · العملة JOD (د.أ)</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">تسجيل الدخول</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="pharmacy@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "جاري التحقق..." : "دخول"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="text-emerald-600 font-medium hover:underline">
              سجل صيدليتك
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <Link href="/admin" className="text-xs text-slate-400 hover:text-slate-600">
              دخول المشرف
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          منصة موثوقة لتبادل الأدوية بين صيدليات الأردن
        </p>
      </div>
    </div>
  );
}
