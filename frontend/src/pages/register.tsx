import { useState } from "react";
import { useLocation, Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import brandLogo from "@assets/brand-logo.jpeg";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    managerName: "",
    email: "",
    phone: "",
    city: "عمان",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseFile, setLicenseFile] = useState<{ name: string; mime: string; data: string } | null>(null);

  const MAX_FILE_BYTES = 4 * 1024 * 1024;

  const handleLicenseFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("حجم ملف السجل التجاري يتجاوز 4MB");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("صيغة الملف غير مدعومة — المسموح: PDF أو صورة");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1] ?? "";
      setLicenseFile({ name: file.name, mime: file.type, data });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await api.auth.register({
        ...data,
        ...(licenseNumber.trim() ? { licenseNumber: licenseNumber.trim() } : {}),
        ...(licenseFile ? { licenseDoc: licenseFile } : {}),
      });
      await refresh();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "فشل إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        required={key !== "confirmPassword"}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        placeholder={placeholder}
        dir={["email", "password", "confirmPassword", "phone"].includes(key) ? "ltr" : "rtl"}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eaf2f3] via-[#f6fafa] to-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <img
            src={brandLogo}
            alt="DoseWise"
            className="mx-auto h-28 w-auto object-contain mb-2 select-none"
            draggable={false}
          />
          <p className="text-[#1b3a5f]/70 text-sm">تسجيل صيدلية جديدة</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">بيانات الصيدلية</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {field("name", "اسم الصيدلية", "text", "صيدلية الأمل")}
              {field("managerName", "اسم المسؤول", "text", "محمد أحمد")}
            </div>
            {field("email", "البريد الإلكتروني", "email", "pharmacy@example.com")}
            <div className="grid grid-cols-2 gap-4">
              {field("phone", "رقم الهاتف", "tel", "+962 7x xxx xxxx")}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">المدينة (الأردن)</label>
                <select
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>عمان</option>
                  <option>إربد</option>
                  <option>الزرقاء</option>
                  <option>المفرق</option>
                  <option>العقبة</option>
                  <option>السلط</option>
                  <option>الكرك</option>
                  <option>مادبا</option>
                  <option>جرش</option>
                  <option>عجلون</option>
                  <option>الطفيلة</option>
                  <option>معان</option>
                </select>
              </div>
            </div>
            {field("address", "العنوان", "text", "شارع الجامعة، بناء رقم...")}
            <div className="grid grid-cols-2 gap-4">
              {field("password", "كلمة المرور", "password", "••••••••")}
              {field("confirmPassword", "تأكيد كلمة المرور", "password", "••••••••")}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">السجل التجاري <span className="text-slate-400 font-normal text-xs">(اختياري)</span></h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">رقم السجل التجاري</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="مثال: 2025678"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">صورة/ملف السجل <span className="text-slate-400 text-xs">(PDF أو صورة، حتى 4MB)</span></label>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => handleLicenseFile(e.target.files?.[0])}
                    className="w-full text-sm text-slate-600 file:me-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#eef5f5] file:text-[#1b3a5f] file:text-sm file:font-medium file:cursor-pointer hover:file:bg-[#d6ebec]"
                  />
                  {licenseFile && (
                    <p className="text-xs text-emerald-700 mt-1.5">
                      ✓ مرفق: {licenseFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "جاري التسجيل..." : "إنشاء حساب الصيدلية"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-emerald-600 font-medium hover:underline">
              سجل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
