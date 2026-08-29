import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  HelpCircle,
  Hourglass,
  Home,
  LogOut,
  Mail,
  PauseCircle,
  RefreshCw,
  ShieldX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn, FOCUS_RING } from "@/lib/utils";

type StatusKind = "pending" | "rejected" | "inactive" | "unexpected";

const STATUS_ICON: Record<StatusKind, typeof Hourglass> = {
  pending: Hourglass,
  rejected: ShieldX,
  inactive: PauseCircle,
  unexpected: HelpCircle,
};

export default function AccountStatusPage() {
  const { pharmacy, isOperational, refresh, logout } = useAuth();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const ac = t.accountStatus;

  useEffect(() => {
    if (isOperational) {
      window.location.href = "/dashboard";
    }
  }, [isOperational]);

  let kind: StatusKind = "unexpected";
  if (pharmacy) {
    if (pharmacy.verificationStatus === "pending") kind = "pending";
    else if (pharmacy.verificationStatus === "rejected") kind = "rejected";
    else if (pharmacy.verificationStatus === "approved" && !pharmacy.isActive) kind = "inactive";
    else kind = "unexpected";
  }

  const Icon = STATUS_ICON[kind];

  const view = {
    pending: ac.pending,
    rejected: ac.rejected,
    inactive: ac.inactive,
    unexpected: ac.fallback,
  }[kind];

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refresh();
    } catch {
      setRefreshError(ac.refreshError);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background" dir={t.dir}>
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
            {pharmacy && (
              <Link
                href="/"
                aria-label={ac.backHome}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
                  FOCUS_RING
                )}
              >
                <Home className="size-4" aria-hidden="true" />
                <span className="hidden min-[420px]:inline">{ac.backHome}</span>
              </Link>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={52} />
            <h1 className="mt-4 text-xl font-bold tracking-tight text-brand-navy sm:text-2xl">
              {ac.title}
            </h1>
          </div>

          <div role="status" aria-live="polite" className="space-y-5">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-secondary/30 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-brand-teal-soft/60 text-brand-navy">
                <Icon className="size-7" aria-hidden="true" />
              </span>

              <h2 className="mt-4 text-lg font-bold text-brand-navy">{view.title}</h2>

              {kind === "pending" && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{ac.pending.desc}</p>
              )}

              {kind === "rejected" && (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{ac.rejected.desc}</p>
                  <p className="mt-1 text-sm font-medium text-destructive">
                    {ac.rejected.reasonLabel.replace(
                      "{reason}",
                      pharmacy?.rejectionReason || ac.rejected.fallback
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {ac.rejected.followup}
                  </p>
                </>
              )}

              {kind === "inactive" && (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{ac.inactive.desc}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{ac.inactive.note}</p>
                </>
              )}

              {kind === "unexpected" && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{ac.fallback.desc}</p>
              )}

              {kind !== "unexpected" && (
                <span className={cn(
                  "mt-3 inline-flex items-center rounded-full bg-brand-teal-deep px-3 py-1 text-xs font-semibold text-white"
                )}>
                  {ac.statusBadge[kind]}
                </span>
              )}

              <p className="mt-3 text-xs leading-5 text-muted-foreground">{ac.stepsHint}</p>
            </div>

            {refreshError && (
              <Alert variant="destructive">
                <AlertDescription>{refreshError}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              size="lg"
              className="min-h-[44px] w-full bg-brand-teal-deep text-white hover:bg-brand-teal-deep/90"
            >
              {refreshing ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              <span className="ms-2">{refreshing ? ac.refreshing : ac.refresh}</span>
            </Button>

            <Button asChild variant="outline" size="lg" className="min-h-[44px] w-full">
              <Link href="/contact">
                <Mail className="size-4" aria-hidden="true" />
                <span className="ms-2">{ac.contact}</span>
              </Link>
            </Button>

            {pharmacy && (
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
                className={cn(
                  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-red-600",
                  FOCUS_RING
                )}
              >
                <LogOut className="size-4" aria-hidden="true" />
                {ac.logout}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6">
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
              FOCUS_RING
            )}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {ac.backHome}
          </Link>
        </p>
      </main>
    </div>
  );
}