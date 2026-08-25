import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError(t.login.error);
      return;
    }
    setLoading(true);
    try {
      await api.admin.login({ email: email.trim(), password });
      await refresh();
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || t.adminLogin.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e1f33] via-[#142d49] to-[#1b3a5f] flex items-center justify-center p-4">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher light />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3 bg-white rounded-2xl p-3 shadow-lg">
            <Logo size={56} />
          </div>
          <h1 className="text-xl font-bold text-white mt-2">{t.adminLogin.title}</h1>
          <p className="text-slate-300 text-sm mt-1">{t.adminLogin.subtitle}</p>
        </div>

        <div className="bg-[#0e1f33]/80 backdrop-blur rounded-2xl p-7 border border-white/10">
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-900/40 border-red-700 text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-300">
                {t.adminLogin.email}
              </label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                dir="ltr"
                placeholder="admin@dosewise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300">
                {t.adminLogin.password}
              </label>
              <div className="relative">
                <Input
                  id="admin-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus-visible:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                  className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" size="lg">
              {loading ? <Spinner className="size-4" /> : t.adminLogin.submit}
            </Button>
          </form>
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t.adminLogin.backToLogin}
        </Link>
      </div>
    </div>
  );
}
