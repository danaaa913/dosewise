import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import { LanguageGate } from "@/components/LanguageGate";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import MyMedicinesPage from "@/pages/my-medicines";
import BrowsePage from "@/pages/browse";
import RequestsPage from "@/pages/requests";
import SubscriptionsPage from "@/pages/subscriptions";
import NotificationsPage from "@/pages/notifications";
import AnalyticsPage from "@/pages/analytics";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import { Logo } from "@/components/Logo";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000 },
  },
});

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir={t.dir}>
      <div className="text-center">
        <div className="inline-block animate-pulse mb-4">
          <Logo size={48} />
        </div>
        <p className="text-sm text-slate-500">{t.loading}</p>
      </div>
    </div>
  );
}

function PharmacyRoute({ component: Component }: { component: React.ComponentType }) {
  const { loggedIn, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!loggedIn || isAdmin) return <Redirect to="/login" />;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { loggedIn, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!loggedIn || !isAdmin) return <Redirect to="/admin" />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { loggedIn, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (loggedIn && !isAdmin) return <Redirect to="/dashboard" />;
  if (loggedIn && isAdmin) return <Redirect to="/admin/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <GuestRoute component={LoginPage} />} />
      <Route path="/login" component={() => <GuestRoute component={LoginPage} />} />
      <Route path="/register" component={() => <GuestRoute component={RegisterPage} />} />
      <Route path="/dashboard" component={() => <PharmacyRoute component={DashboardPage} />} />
      <Route path="/my-medicines" component={() => <PharmacyRoute component={MyMedicinesPage} />} />
      <Route path="/browse" component={() => <PharmacyRoute component={BrowsePage} />} />
      <Route path="/requests" component={() => <PharmacyRoute component={RequestsPage} />} />
      <Route path="/subscriptions" component={() => <PharmacyRoute component={SubscriptionsPage} />} />
      <Route path="/notifications" component={() => <PharmacyRoute component={NotificationsPage} />} />
      <Route path="/analytics" component={() => <PharmacyRoute component={AnalyticsPage} />} />
      <Route path="/ai" component={() => <Redirect to="/analytics" replace />} />
      <Route path="/about" component={() => <PharmacyRoute component={AboutPage} />} />
      <Route path="/contact" component={() => <PharmacyRoute component={ContactPage} />} />
      <Route path="/admin" component={AdminLoginPage} />
      <Route path="/admin/dashboard" component={() => <AdminRoute component={AdminDashboardPage} />} />
      <Route path="/admin/pharmacies" component={() => <AdminRoute component={AdminDashboardPage} />} />
      <Route path="/admin/medicines" component={() => <AdminRoute component={AdminDashboardPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <LanguageChooser />
          <AuthProvider>
            <WouterRouter>
              <Router />
            </WouterRouter>
          </AuthProvider>
        </LanguageProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function LanguageChooser() {
  const { hasChosen } = useLanguage();
  if (hasChosen) return null;
  return <LanguageGate />;
}

export default App;
