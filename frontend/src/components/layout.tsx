import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeftRight,
  Bell,
  CreditCard,
  Info,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Mail,
  Menu,
  Package,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/i18n/LanguageContext";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/my-medicines", key: "myMedicines" },
  { href: "/browse", key: "browse" },
  { href: "/requests", key: "requests" },
  { href: "/subscriptions", key: "subscriptions" },
  { href: "/notifications", key: "notifications" },
  { href: "/analytics", key: "analytics" },
] as const;

const SECONDARY_NAV = [
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"] | (typeof SECONDARY_NAV)[number]["key"];

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/my-medicines": Package,
  "/browse": Search,
  "/requests": ArrowLeftRight,
  "/subscriptions": CreditCard,
  "/notifications": Bell,
  "/analytics": Lightbulb,
};

const SECONDARY_ICONS: Record<string, typeof Info> = {
  "/about": Info,
  "/contact": Mail,
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

function useUnreadCount() {
  const { isOperational } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.notifications.my(),
    refetchInterval: 30000,
    enabled: isOperational,
  });
  return data?.unreadCount ?? 0;
}

function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#1b3a5f] focus:shadow-md",
        FOCUS_RING
      )}
    >
      {t.shell.skipToContent}
    </a>
  );
}

function NavContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { pharmacy, logout } = useAuth();
  const { t } = useLanguage();
  const unreadCount = useUnreadCount();

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center rounded-lg text-sm transition-colors relative",
      collapsed ? "justify-center mx-2 my-0.5 p-3 min-h-[44px] min-w-[44px]" : "gap-3 px-3 py-2.5 mx-2 my-0.5 min-h-[44px]",
      active
        ? "bg-[#1b3a5f] text-white font-medium shadow-sm"
        : "text-slate-600 hover:bg-[#eef5f5] hover:text-[#1b3a5f]"
    );

  return (
    <>
      {pharmacy && !collapsed && (
        <div className="mx-3 my-3 p-3 bg-gradient-to-br from-[#1b3a5f] to-[#2a5f66] rounded-xl text-white">
          <p className="text-xs font-semibold truncate">{pharmacy.name}</p>
          <p className="text-[11px] text-white/70 truncate mt-0.5">{pharmacy.city}</p>
        </div>
      )}

      <nav className={cn("py-2 overflow-y-auto flex-1")}>
        {NAV_ITEMS.map((item) => {
          const active = location === item.href || location.startsWith(item.href + "/");
          const isNotif = item.href === "/notifications";
          const Icon = NAV_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t.nav[item.key as NavKey] : undefined}
              className={linkCls(active)}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
              {!collapsed && <span>{t.nav[item.key]}</span>}
              {isNotif && unreadCount > 0 && (
                <span
                  className={cn(
                    "text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0",
                    collapsed ? "absolute top-1 end-1" : "ms-auto",
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
          const Icon = SECONDARY_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t.nav[item.key as NavKey] : undefined}
              className={linkCls(active)}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
              {!collapsed && <span>{t.nav[item.key]}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-slate-100", collapsed ? "p-2" : "p-3")}>
        <button
          onClick={logout}
          title={t.logout}
          className={cn(
            "text-sm text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors min-h-[44px]",
            collapsed ? "w-full flex items-center justify-center p-3" : "w-full text-start py-2 px-3",
            FOCUS_RING
          )}
        >
          <span className="inline-flex items-center gap-2">
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {!collapsed && t.logout}
          </span>
        </button>
      </div>
    </>
  );
}

export function Layout({ children, title }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t, lang } = useLanguage();

  return (
    <div className="flex min-h-screen bg-[#f6fafa]" dir={t.dir}>
      <SkipLink />

      {/* Mobile top bar */}
      <header className="fixed top-0 inset-x-0 z-30 md:hidden bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className="p-2.5 -ms-2.5 text-[#1b3a5f] min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#eef5f5]"
              aria-label={t.shell.openMenu}
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side={lang === "ar" ? "right" : "left"}
            className="w-72 p-0 flex flex-col"
            closeLabel={t.shell.closeMenu}
            aria-label={t.shell.openMenu}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>DoseWise</SheetTitle>
            </SheetHeader>
            <div className="px-5 py-4 border-b border-slate-100">
              <Link href="/dashboard" className="flex items-center gap-3">
                <Logo size={36} />
                <div>
                  <h1 className="text-base font-bold text-[#1b3a5f] leading-tight">DoseWise</h1>
                  <p className="text-[11px] text-slate-400">{t.tagline}</p>
                </div>
              </Link>
            </div>
            <NavContent onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="flex items-center gap-2" aria-label="DoseWise">
          <Logo size={30} />
          <span className="font-bold text-[#1b3a5f] text-sm">DoseWise</span>
        </Link>
        <LanguageSwitcher />
      </header>

      {/* Tablet: icon sidebar */}
      <aside className="hidden md:flex lg:hidden flex-col w-16 bg-white border-e border-slate-200 flex-shrink-0 sticky top-0 h-screen">
        <div className="py-4 flex justify-center border-b border-slate-100">
          <Link href="/dashboard" aria-label="DoseWise">
            <Logo size={32} />
          </Link>
        </div>
        <NavContent collapsed />
      </aside>

      {/* Desktop: full sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-e border-slate-200 flex-shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Logo size={40} />
            <div>
              <h1 className="text-base font-bold text-[#1b3a5f] leading-tight">DoseWise</h1>
              <p className="text-[11px] text-slate-400">{t.tagline}</p>
            </div>
          </Link>
        </div>
        <NavContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Tablet/desktop header */}
        <header className="hidden md:flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sticky top-0 z-20">
          <h2 className="text-lg font-semibold text-[#1b3a5f]">{title}</h2>
          <LanguageSwitcher />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8 overflow-x-hidden pt-[72px] md:pt-0 focus-visible:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: LayoutProps) {
  const [location] = useLocation();
  const { t, lang } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ADMIN_NAV = [
    { href: "/admin/dashboard", key: "dashboard" },
    { href: "/admin/pharmacies", key: "pharmacies" },
    { href: "/admin/medicines", key: "medicines" },
  ] as const;

  const handleLogout = async () => {
    await api.auth.logout();
    window.location.href = "/admin";
  };

  const navLinks = (collapsed = false, onNavigate?: () => void) =>
    ADMIN_NAV.map((item) => {
      const active = location === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center text-sm transition-colors min-h-[44px]",
            collapsed ? "justify-center px-3" : "px-5 py-2.5",
            active
              ? "bg-[#3f8b8e] text-white border-s-4 border-[#82bec1]"
              : "text-white/70 hover:bg-white/10 hover:text-white",
            FOCUS_RING
          )}
        >
          {t.nav[item.key]}
        </Link>
      );
    });

  const adminBrand = (
    <div className="flex items-center gap-3">
      <div className="bg-white rounded-xl p-1">
        <Logo size={28} />
      </div>
      <div>
        <h1 className="text-sm font-bold text-white leading-tight">DoseWise</h1>
        <p className="text-xs text-white/60">{t.adminTagline}</p>
      </div>
    </div>
  );

  const adminDrawerFooter = (
    <div className="p-4 border-t border-white/10">
      <button
        onClick={handleLogout}
        className={cn(
          "w-full flex items-center gap-2 text-sm text-white/60 hover:text-white text-start py-2 px-3 rounded-lg hover:bg-white/10 transition-colors min-h-[44px]"
        )}
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        {t.logout}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f6fafa]" dir={t.dir}>
      <SkipLink />

      {/* Mobile top bar */}
      <header className="fixed top-0 inset-x-0 z-30 md:hidden bg-[#0e1f33] h-14 flex items-center justify-between px-4">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className="p-2.5 -ms-2.5 text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
              aria-label={t.shell.openMenu}
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side={lang === "ar" ? "right" : "left"}
            className="w-64 p-0 flex flex-col bg-gradient-to-b from-[#0e1f33] to-[#1b3a5f] border-none text-white [&>button]:text-white/70 hover:[&>button]:text-white"
            closeLabel={t.shell.closeMenu}
            aria-label={t.shell.openMenu}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>DoseWise — {t.adminTagline}</SheetTitle>
            </SheetHeader>
            <div className="px-6 py-5 border-b border-white/10">{adminBrand}</div>
            <nav className="flex-1 py-4">{navLinks(false, () => setDrawerOpen(false))}</nav>
            {adminDrawerFooter}
          </SheetContent>
        </Sheet>

        <span className="text-white text-sm font-bold">DoseWise — {t.adminTagline}</span>
        <LanguageSwitcher light />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-gradient-to-b from-[#0e1f33] to-[#1b3a5f] flex-shrink-0 sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-white/10">{adminBrand}</div>
        <nav className="flex-1 py-4">{navLinks()}</nav>
        {adminDrawerFooter}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <LanguageSwitcher />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8 overflow-x-hidden pt-[72px] md:pt-0 focus-visible:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
