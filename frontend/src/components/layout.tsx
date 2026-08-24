import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { useLanguage } from "@/i18n/LanguageContext";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/my-medicines", key: "myMedicines" },
  { href: "/browse", key: "browse" },
  { href: "/requests", key: "requests" },
  { href: "/subscriptions", key: "subscriptions" },
  { href: "/notifications", key: "notifications" },
  { href: "/ai", key: "ai" },
] as const;

const SECONDARY_NAV = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  const [location] = useLocation();
  const { pharmacy, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.notifications.my(),
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <div className="flex min-h-screen bg-[#f6fafa]" dir={t.dir}>
      <aside className="w-64 bg-white border-e border-slate-200 flex flex-col shadow-sm flex-shrink-0">
        <div className="px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Logo size={40} />
            <div>
              <h1 className="text-base font-bold text-[#1b3a5f] leading-tight">DoseWise</h1>
              <p className="text-[11px] text-slate-400">{t.tagline}</p>
            </div>
          </Link>
        </div>

        {pharmacy && (
          <div className="mx-3 my-3 p-3 bg-gradient-to-br from-[#1b3a5f] to-[#2a5f66] rounded-xl text-white">
            <p className="text-xs font-semibold truncate">{pharmacy.name}</p>
            <p className="text-[11px] text-white/70 truncate mt-0.5">{pharmacy.city}</p>
          </div>
        )}

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = location === item.href || location.startsWith(item.href + "/");
            const isNotif = item.href === "/notifications";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-lg text-sm transition-colors relative",
                  active
                    ? "bg-[#1b3a5f] text-white font-medium shadow-sm"
                    : "text-slate-600 hover:bg-[#eef5f5] hover:text-[#1b3a5f]"
                )}
              >
                <NavIcon name={item.href} active={active} />
                <span>{t.nav[item.key]}</span>
                {isNotif && unreadCount > 0 && (
                  <span
                    className={cn(
                      "ms-auto text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center",
                      active ? "bg-white text-[#1b3a5f]" : "bg-[#3f8b8e] text-white"
                    )}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="my-3 mx-4 border-t border-slate-100" />

          {SECONDARY_NAV.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-[#1b3a5f] text-white font-medium shadow-sm"
                    : "text-slate-600 hover:bg-[#eef5f5] hover:text-[#1b3a5f]"
                )}
              >
                <SecondaryIcon name={item.href} active={active} />
                <span>{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="w-full flex items-center justify-center gap-2 text-sm text-[#1b3a5f] border border-slate-200 rounded-lg py-2 mb-2 hover:bg-[#eef5f5] transition-colors"
          >
            🌐 {lang === "ar" ? "English" : "العربية"}
          </button>
          <button
            onClick={logout}
            className="w-full text-sm text-slate-500 hover:text-red-600 text-start py-2 px-3 rounded-lg hover:bg-red-50 transition-colors"
          >
            {t.logout}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <h2 className="text-lg font-semibold text-[#1b3a5f]">{title}</h2>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const cls = cn("w-4 h-4 flex-shrink-0", active ? "text-white" : "text-slate-400");
  const icons: Record<string, React.ReactNode> = {
    "/dashboard": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    "/my-medicines": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
      </svg>
    ),
    "/browse": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    "/requests": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    "/subscriptions": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    "/notifications": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    "/ai": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

function SecondaryIcon({ name, active }: { name: string; active: boolean }) {
  const cls = cn("w-4 h-4 flex-shrink-0", active ? "text-white" : "text-slate-400");
  const icons: Record<string, React.ReactNode> = {
    "/about": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
    ),
    "/contact": (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

export function AdminLayout({ children, title }: LayoutProps) {
  const [location] = useLocation();
  const { t } = useLanguage();

  const ADMIN_NAV = [
    { href: "/admin/dashboard", key: "dashboard" },
    { href: "/admin/pharmacies", key: "pharmacies" },
    { href: "/admin/medicines", key: "medicines" },
  ] as const;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin";
  };

  return (
    <div className="flex min-h-screen bg-[#f6fafa]" dir={t.dir}>
      <aside className="w-60 bg-gradient-to-b from-[#0e1f33] to-[#1b3a5f] flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-1">
              <Logo size={32} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">DoseWise</h1>
              <p className="text-xs text-white/60">{t.adminTagline}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {ADMIN_NAV.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-5 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-[#3f8b8e] text-white border-s-4 border-[#82bec1]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-white/60 hover:text-white text-start py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            {t.logout}
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
