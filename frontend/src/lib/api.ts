const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    register: (data: {
      name: string;
      managerName: string;
      email: string;
      phone: string;
      city: string;
      address: string;
      password: string;
    }) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    check: () => request<AuthCheckResponse>("/auth/check"),
    logout: () => request("/auth/logout", { method: "POST" }),
  },
  admin: {
    login: (data: { email: string; password: string }) =>
      request("/admin/login", { method: "POST", body: JSON.stringify(data) }),
    pharmacies: () => request<AdminPharmacy[]>("/admin/pharmacies"),
    medicines: () => request<AdminMedicine[]>("/admin/medicines"),
    stats: () => request<AdminStats>("/admin/stats"),
  },
  medicines: {
    add: (data: {
      name: string;
      quantity: number;
      price: number;
      expiryDate: string;
      description?: string;
      isAvailable?: boolean;
    }) => request("/medicines/add", { method: "POST", body: JSON.stringify(data) }),
    my: () => request<Medicine[]>("/medicines/my"),
    available: (search?: string) =>
      request<AvailableMedicine[]>(
        `/medicines/available${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
    update: (
      medicineId: number,
      data: Partial<{
        name: string;
        quantity: number;
        price: number;
        expiryDate: string;
        description: string;
        isAvailable: boolean;
      }>
    ) =>
      request(`/medicines/${medicineId}/update`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (medicineId: number) =>
      request(`/medicines/${medicineId}/delete`, { method: "DELETE" }),
  },
  requests: {
    send: (data: { medicineId: number; requestedQuantity: number }) =>
      request("/requests/send", { method: "POST", body: JSON.stringify(data) }),
    sent: () => request<ExchangeRequest[]>("/requests/sent"),
    received: () => request<ExchangeRequest[]>("/requests/received"),
    accept: (requestId: number) =>
      request(`/requests/${requestId}/accept`, { method: "POST" }),
    reject: (requestId: number) =>
      request(`/requests/${requestId}/reject`, { method: "POST" }),
  },
  subscriptions: {
    status: () => request<SubscriptionStatus>("/subscriptions/status"),
    plans: () => request<Plan[]>("/subscriptions/plans"),
    payment: (planId: string) =>
      request("/subscriptions/payment", {
        method: "POST",
        body: JSON.stringify({ planId }),
      }),
    cancel: () => request("/subscriptions/cancel", { method: "POST" }),
  },
  notifications: {
    my: (unreadOnly?: boolean) =>
      request<NotificationsResponse>(
        `/notifications/my${unreadOnly ? "?unread_only=true" : ""}`
      ),
    markRead: (notificationId: number) =>
      request(`/notifications/${notificationId}/mark-read`, { method: "POST" }),
  },
  ai: {
    medicines: () => request<{ medicines: string[] }>("/ai/medicines?scope=market"),
    recommendations: () => request<{ recommendations: AiRecommendation[] }>("/ai/recommendations"),
    medicineSuggestions: () =>
      request<{ suggestions: AiSuggestion[] }>("/ai/medicine-suggestions"),
    priceOptimization: (medicine?: string) =>
      request<{ optimizations: AiPriceOptimization[] }>(
        `/ai/price-optimization${medicine ? `?medicine=${encodeURIComponent(medicine)}` : ""}`,
      ),
    demandForecast: (medicine?: string) =>
      request<{ forecasts: AiDemandForecast[] }>(
        `/ai/demand-forecast${medicine ? `?medicine=${encodeURIComponent(medicine)}` : ""}`,
      ),
    chat: (message: string) =>
      request<{ response: string; suggestions: string[] }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  },
};

export interface Pharmacy {
  id: number;
  name: string;
  managerName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  isActive: boolean;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscriptionEndDate: string | null;
}

export interface AuthCheckResponse {
  loggedIn: boolean;
  isAdmin: boolean;
  pharmacy?: Pharmacy;
}

export interface Medicine {
  id: number;
  pharmacyId: number;
  name: string;
  quantity: number;
  price: number;
  expiryDate: string;
  description: string | null;
  isAvailable: boolean;
}

export interface AvailableMedicine extends Medicine {
  pharmacyName: string;
  pharmacyCity: string;
}

export interface ExchangeRequest {
  id: number;
  requesterPharmacyId: number;
  providerPharmacyId: number;
  medicineId: number;
  requestedQuantity: number;
  status: "pending" | "accepted" | "rejected";
  requestDate: string;
  responseDate: string | null;
  medicineName: string;
  requesterName: string;
  providerName: string;
}

export interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string | null;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  features: string[];
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface Notification {
  id: number;
  pharmacyId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminPharmacy {
  id: number;
  name: string;
  managerName: string;
  email: string;
  phone: string;
  city: string;
  isActive: boolean;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  createdAt: string;
}

export interface AdminMedicine {
  id: number;
  pharmacyId: number;
  name: string;
  quantity: number;
  price: number;
  expiryDate: string;
  description: string | null;
  isAvailable: boolean;
  pharmacyName: string;
  pharmacyCity: string;
}

export interface AdminStats {
  totalPharmacies: number;
  totalMedicines: number;
  totalRequests: number;
  activeSubscriptions: number;
  pendingRequests: number;
}

export interface AiRecommendation {
  medicine: string;
  reason: string;
  confidence: number;
}

export interface AiSuggestion {
  name: string;
  trend: string;
  estimatedDemand: number;
}

export interface AiPriceOptimization {
  medicine: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
}

export interface AiDemandForecast {
  medicine: string;
  nextMonthDemand: number;
  trend: string;
  seasonality: string;
}
