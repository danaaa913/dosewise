import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
      setError(t.adminLogin.error);
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
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 start-4 size-72 rounded-full bg-brand-teal-soft/60 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 end-4 size-80 rounded-full bg-brand-teal-soft/50 blur-3xl"
      />

      <header className="relative z-10 border-b border-border/60 bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="DoseWise"
            className={cn("flex items-center gap-2 rounded-md", FOCUS_RING)}
          >
            <Logo size={26} />
            <span className="hidden min-[380px]:inline text-sm font-bold text-brand-navy">
              DoseWise
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/login"
              aria-label={t.adminLogin.backToLogin}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
                FOCUS_RING
              )}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              <span className="hidden min-[420px]:inline">{t.adminLogin.backToLogin}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14 focus-visible:outline-none"
      >
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="relative">
              <Logo size={52} />
              <ShieldCheck
                className="absolute -end-1 -bottom-1 size-5 rounded-full bg-background p-0.5 text-brand-teal"
                aria-hidden="true"
              />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-brand-navy sm:text-2xl">
              {t.adminLogin.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.adminLogin.subtitle}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">{t.adminLogin.email}</Label>
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
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">{t.adminLogin.password}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? t.login.hidePassword : t.login.showPassword}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="min-h-[44px] w-full bg-brand-teal-deep text-white hover:bg-brand-navy"
            >
              {loading ? <Spinner className="size-4" /> : t.adminLogin.submit}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
