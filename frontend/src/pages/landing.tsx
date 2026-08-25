import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowLeftRight,
  Bell,
  Check,
  ClipboardList,
  ExternalLink,
  Facebook,
  Instagram,
  Info,
  Languages,
  Linkedin,
  Mail,
  Menu,
  Package,
  Recycle,
  Search,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogoShowcase } from "@/components/landing/LogoShowcase";
import { CONTACT } from "@/config/contact";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { id: "about-section", key: "about" },
  { id: "how-it-works", key: "how" },
  { id: "features", key: "features" },
  { id: "contact-section", key: "contact" },
] as const;

type SectionId = (typeof NAV_LINKS)[number]["id"];
type SectionKey = (typeof NAV_LINKS)[number]["key"];

const AVAILABLE_SECTIONS = new Set<SectionId>([
  "about-section",
  "how-it-works",
  "features",
  "contact-section",
]);
const sectionLinks = NAV_LINKS.filter((l) => AVAILABLE_SECTIONS.has(l.id));

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function withBrand(text: string): ReactNode[] {
  return text.split("DoseWise").flatMap((part, i) =>
    i === 0 ? [part] : [<bdi key={i} dir="ltr">DoseWise</bdi>, part]
  );
}

function BrandRow() {
  return (
    <>
      <Logo size={32} />
      <span className="text-lg font-bold tracking-tight text-[#1b3a5f]">DoseWise</span>
    </>
  );
}

function NavbarCta({ full = false }: { full?: boolean }) {
  const { loggedIn, isAdmin } = useAuth();
  const { t } = useLanguage();

  const btnCls = cn("min-h-[44px]", full && "w-full");

  if (loggedIn && isAdmin) {
    return (
      <Button asChild className={btnCls}>
        <Link href="/admin/dashboard">{t.landing.cta.adminPanel}</Link>
      </Button>
    );
  }
  if (loggedIn) {
    return (
      <Button asChild className={btnCls}>
        <Link href="/dashboard">{t.landing.cta.dashboard}</Link>
      </Button>
    );
  }
  return (
    <Button variant="ghost" asChild className={btnCls}>
      <Link href="/login">{t.landing.cta.login}</Link>
    </Button>
  );
}

function HeroCta() {
  const { loggedIn } = useAuth();
  const { t } = useLanguage();

  if (loggedIn) return null;

  return (
    <Button
      asChild
      size="lg"
      className="min-h-[48px] bg-[#2a5f66] text-white hover:bg-[#24504f]"
    >
      <Link href="/register">{t.landing.cta.register}</Link>
    </Button>
  );
}

function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, lang } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden min-h-[44px] min-w-[44px]"
          aria-label={t.landing.hero.menuOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={lang === "ar" ? "right" : "left"}
        className="flex w-72 flex-col"
        aria-label={t.landing.hero.menuOpen}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-start">
            <BrandRow />
          </SheetTitle>
        </SheetHeader>

        <nav aria-label={t.landing.nav.about} className="mt-6 flex flex-col gap-1">
          {sectionLinks.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={() => onOpenChange(false)}
              className={cn(
                "rounded-md px-3 py-3 text-sm font-medium text-slate-700 hover:bg-secondary/50 hover:text-[#1b3a5f]",
                focusRing
              )}
            >
              {t.landing.nav[l.key]}
            </a>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-2">
            <NavbarCta full />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Navbar() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur transition-shadow duration-200",
        scrolled && "shadow-sm",
        menuOpen && "shadow-none"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className={cn("flex items-center gap-2 rounded-md", focusRing)} aria-label="DoseWise">
          <BrandRow />
        </Link>

        <nav aria-label="DoseWise" className="hidden items-center gap-1 md:flex">
          {sectionLinks.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-secondary/50 hover:text-[#1b3a5f]",
                focusRing
              )}
            >
              {t.landing.nav[l.key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <div className="hidden items-center gap-2 md:flex">
            <NavbarCta />
          </div>
          <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useLanguage();
  const badges = [
    t.landing.hero.badge1,
    t.landing.hero.badge2,
    t.landing.hero.badge3,
    t.landing.hero.badge4,
  ];

  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-14 lg:py-14">
        <div>
          <h1
            id="hero-title"
            className="text-3xl font-bold leading-tight tracking-tight text-[#1b3a5f] sm:text-4xl lg:text-5xl"
          >
            {t.landing.hero.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {withBrand(t.landing.hero.subtitle)}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <HeroCta />
          </div>

          <ul className="mt-6 flex flex-wrap gap-2.5">
            {badges.map((badge) => (
              <li
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-slate-700"
              >
                <Check className="size-4 shrink-0 text-[#2a5f66]" aria-hidden="true" />
                {badge}
              </li>
            ))}
          </ul>
        </div>

        <LogoShowcase alt={t.landing.hero.visualAlt} />
      </div>
    </section>
  );
}

function SocialLinks({ className }: { className?: string }) {
  const { t } = useLanguage();
  const items = [
    { href: CONTACT.instagram, icon: Instagram, aria: t.landing.contact.instagramAria },
    { href: CONTACT.facebook, icon: Facebook, aria: t.landing.contact.facebookAria },
    { href: CONTACT.linkedin, icon: Linkedin, aria: t.landing.contact.linkedinAria },
  ];

  return (
    <ul className={cn("flex items-center gap-3", className)}>
      {items.map(({ href, icon: Icon, aria }) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={aria}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full border border-border text-slate-600 transition-colors hover:border-[#2a5f66] hover:bg-secondary/50 hover:text-[#1b3a5f]",
              focusRing
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function ContactSection() {
  const { t } = useLanguage();

  return (
    <section
      id="contact-section"
      aria-labelledby="contact-heading"
      className="scroll-mt-24 border-y border-border/60 bg-secondary/30 py-14 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mt-8 max-w-xl text-center">
          <h2 id="contact-heading" className="text-2xl font-bold tracking-tight text-[#1b3a5f] sm:text-3xl">
            {t.landing.contact.title}
          </h2>
          <p className="mt-3 text-slate-600">{t.landing.contact.subtitle}</p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          <div className="grid divide-y divide-border/60 sm:grid-cols-2 lg:grid-cols-3 lg:divide-y-0 lg:divide-x">
            <a
              href={`mailto:${CONTACT.email}`}
              className={cn(
                "group flex items-center gap-3 p-6 transition-colors hover:bg-secondary/30",
                focusRing
              )}
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-[#2a5f66]">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t.landing.contact.emailLabel}
                </span>
                <span dir="ltr" className="block truncate text-sm font-semibold text-[#1b3a5f] group-hover:underline">
                  {CONTACT.email}
                </span>
              </span>
            </a>

            <a
              href={CONTACT.linktree}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.landing.contact.linktreeAria}
              className={cn(
                "group flex items-center gap-3 p-6 transition-colors hover:bg-secondary/30",
                focusRing
              )}
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-[#2a5f66]">
                <ExternalLink className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#1b3a5f] group-hover:underline">
                  Linktree
                </span>
                <span className="block text-xs leading-relaxed text-slate-500">{t.landing.contact.linktreeLabel}</span>
              </span>
            </a>

            <div className="flex items-center justify-center p-6">
              <SocialLinks />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const { t } = useLanguage();
  const points = [
    { icon: Info, text: t.landing.about.p1 },
    { icon: Check, text: t.landing.about.p2 },
  ];

  return (
    <section
      id="about-section"
      aria-labelledby="about-heading"
      className="scroll-mt-24 py-14 sm:py-16 lg:py-20"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-14">
        <div>
          <span aria-hidden="true" className="mb-4 block h-1 w-12 rounded-full bg-[#3f8b8e]" />
          <h2
            id="about-heading"
            className="text-2xl font-bold tracking-tight text-[#1b3a5f] sm:text-3xl"
          >
            {t.landing.about.title}
          </h2>
        </div>

        <ul className="space-y-4">
          {points.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-5"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-[#2a5f66]" aria-hidden="true" />
              <p className="text-base leading-relaxed text-slate-700">{withBrand(text)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const HOW_ICONS = [Package, Search, ArrowLeftRight] as const;

function HowSection() {
  const { t } = useLanguage();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-24 border-y border-border/60 bg-secondary/30 py-14 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2
          id="how-heading"
          className="text-center text-2xl font-bold tracking-tight text-[#1b3a5f] sm:text-3xl"
        >
          {withBrand(t.landing.how.title)}
        </h2>

        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {t.landing.how.steps.map((step, i) => {
            const Icon = HOW_ICONS[i];
            return (
              <li
                key={step.title}
                className="h-full rounded-xl border border-border bg-background p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-[#2a5f66]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[#2a5f66] text-sm font-bold text-white"
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#1b3a5f]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.desc}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const FEATURE_ICONS = [
  Recycle,
  Warehouse,
  ClipboardList,
  Bell,
  ShieldCheck,
  Languages,
] as const;

function FeaturesSection() {
  const { t } = useLanguage();

  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-24 py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2
          id="features-heading"
          className="text-center text-2xl font-bold tracking-tight text-[#1b3a5f] sm:text-3xl"
        >
          {withBrand(t.landing.features.title)}
        </h2>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.landing.features.items.map((item, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <li
                key={item.title}
                className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:border-[#3f8b8e]/40 hover:bg-secondary/20"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-secondary/60 text-[#2a5f66]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-[#1b3a5f]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function TrustSection() {
  const { t } = useLanguage();

  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-border/60 bg-secondary/30 py-14 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex items-center justify-center gap-3">
          <ShieldCheck className="size-7 text-[#2a5f66]" aria-hidden="true" />
          <h2
            id="trust-heading"
            className="text-2xl font-bold tracking-tight text-[#1b3a5f] sm:text-3xl"
          >
            {t.landing.trust.title}
          </h2>
        </div>

        <ul className="mt-7 grid gap-3.5 sm:grid-cols-2">
          {t.landing.trust.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-4"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-[#2a5f66]" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-slate-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  const { t } = useLanguage();
  const { loggedIn, isAdmin } = useAuth();

  return (
    <section aria-labelledby="finalcta-heading" className="bg-[#1b3a5f] py-12 sm:py-14">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2
          id="finalcta-heading"
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          {withBrand(t.landing.finalCta.title)}
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-white/75">
          {t.landing.finalCta.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {loggedIn ? (
            <Button asChild size="lg" className="min-h-[48px] bg-white text-[#1b3a5f] hover:bg-white/90">
              <Link href={isAdmin ? "/admin/dashboard" : "/dashboard"}>
                {isAdmin ? t.landing.cta.adminPanel : t.landing.cta.dashboard}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="min-h-[48px] bg-white text-[#1b3a5f] hover:bg-white/90">
                <Link href="/register">{t.landing.cta.register}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-h-[48px] border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white hover:[border-color:var(--button-outline)]"
              >
                <Link href="/login">{t.landing.cta.login}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-9 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <BrandRow />
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
            {t.landing.footer.tagline}
          </p>
        </div>

        <nav aria-label={t.landing.footer.sectionsTitle}>
          <h3 className="text-sm font-semibold text-[#1b3a5f]">{t.landing.footer.sectionsTitle}</h3>
          <ul className="mt-3 space-y-1">
            {sectionLinks.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className={cn(
                    "inline-flex min-h-[36px] items-center text-sm text-slate-600 transition-colors hover:text-[#1b3a5f] hover:underline",
                    focusRing
                  )}
                >
                  {t.landing.nav[l.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-sm font-semibold text-[#1b3a5f]">{t.landing.footer.contactTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={`mailto:${CONTACT.email}`}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-2 text-slate-600 transition-colors hover:text-[#1b3a5f] hover:underline",
                  focusRing
                )}
              >
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <span dir="ltr">{CONTACT.email}</span>
              </a>
            </li>
            <li>
              <a
                href={CONTACT.linktree}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.landing.contact.linktreeAria}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-2 text-slate-600 transition-colors hover:text-[#1b3a5f] hover:underline",
                  focusRing
                )}
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                Linktree
              </a>
            </li>
          </ul>
          <SocialLinks className="mt-3" />
        </div>
      </div>

      <div className="border-t border-border/60 py-3">
        <p className="px-4 text-center text-sm text-slate-500">
          © {year} DoseWise. {t.landing.footer.rightsNote}
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = t.landing.meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t.landing.meta.description);
  }, [t]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#1b3a5f] focus:shadow-md",
          focusRing
        )}
      >
        {t.landing.a11y.skipToContent}
      </a>

      <Navbar />
      <main id="main-content" className="flex-1">
        <Hero />
        <AboutSection />
        <HowSection />
        <FeaturesSection />
        <TrustSection />
        <ContactSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
