import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

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
      await api.auth.login({ email: email.trim(), password });
      await refresh();
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || t.login.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Brand half (desktop) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary flex-col items-center justify-center p-12 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/30 via-primary to-primary opacity-80" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <Logo size={80} className="mb-8 drop-shadow-lg" />
          <h1 className="text-4xl font-bold mb-4 leading-tight">{t.login.brandDescription}</h1>
          <p className="text-lg text-primary-foreground/80">{t.login.footer}</p>
          <div className="mt-8 text-sm text-primary-foreground/60">{t.login.country}</div>
        </div>
      </div>

      {/* ── Form half ── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Top bar */}
        <div className="absolute top-4 end-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center text-center lg:hidden">
            <Logo size={56} className="mb-4" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{t.login.title}</h2>
            <p className="text-sm text-muted-foreground">{t.login.subtitle}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">{t.login.email}</label>
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
              <label htmlFor="login-password" className="text-sm font-medium">{t.login.password}</label>
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
                  tabIndex={-1}
                  className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <Spinner className="size-4" /> : t.login.submit}
            </Button>
          </form>

          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              {t.login.noAccount}{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {t.login.registerLink}
              </Link>
            </p>
            <p>
              <Link href="/admin" className="text-muted-foreground hover:text-foreground hover:underline">
                {t.login.adminLogin}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
