import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn, FOCUS_RING } from "@/lib/utils";

export default function LoginPage() {
  const { t } = useLanguage();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.auth.login({ email: email.trim(), password });
      await refresh();
      const p = data.pharmacy;
      if (p && p.verificationStatus === "approved" && p.isActive) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/account-status";
      }
    } catch (err: any) {
      setError(getErrorMessage(t, err, t.login.error));
    } finally {
      setLoading(false);
    }
  }

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
              href="/"
              aria-label={t.login.backToPlatform}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
                FOCUS_RING
              )}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              <span className="hidden min-[420px]:inline">{t.login.backToPlatform}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <Logo size={52} />
            <h1 className="mt-4 text-xl font-bold tracking-tight text-brand-navy sm:text-2xl">
              {t.login.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.login.subtitle}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">{t.login.email}</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                dir="auto"
                placeholder="name@pharmacy.jo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t.login.password}</Label>
              <div className="relative">
                <Input
                  id="login-password"
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
              className="min-h-[44px] w-full bg-brand-teal-deep text-white hover:bg-brand-teal-deep/90"
            >
              {loading ? <Spinner className="size-4" /> : t.login.submit}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.login.noAccount}{" "}
            <Link
              href="/register"
              className={cn("font-medium text-primary underline-offset-4 hover:underline", FOCUS_RING)}
            >
              {t.login.registerLink}
            </Link>
          </p>
          <p className="mt-4 border-t border-border pt-4 text-center text-sm">
            <Link
              href="/admin/login"
              className={cn("inline-flex items-center gap-1.5 font-medium text-brand-teal-deep underline-offset-4 hover:underline", FOCUS_RING)}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t.login.adminLogin}
            </Link>
          </p>
        </div>

      </main>
    </div>
  );
}
