const API_BASE = "/api";

const priceFormatters = new Map<string, Intl.NumberFormat>();

function getPriceFormatter(locale: string): Intl.NumberFormat {
  let fmt = priceFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    priceFormatters.set(locale, fmt);
  }
  return fmt;
}

export function formatPrice(value: string | number, locale: string = "en-JO"): string {
  return getPriceFormatter(locale).format(Number(value));
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    const thrown = new Error(err.error || `HTTP ${res.status}`) as Error & { code?: string };
    thrown.code = err.code;
    throw thrown;
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
      licenseNumber?: string;
      licenseDoc?: { name: string; mime: string; data: string };
    }) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    check: () => request<AuthCheckResponse>("/auth/check"),
    logout: () => request("/auth/logout", { method: "POST" }),
  },
  admin: {
    login: (data: { email: string; password: string }) =>
      request("/admin/login", { method: "POST", body: JSON.stringify(data) }),
    pharmacies: (params?: PaginatedParams) => {
      const qs = buildPaginationQuery(params);
      return request<PaginatedResponse<AdminPharmacy>>(`/admin/pharmacies${qs}`);
    },
    medicines: (params?: PaginatedParams) => {
      const qs = buildPaginationQuery(params);
      return request<PaginatedResponse<AdminMedicine>>(`/admin/medicines${qs}`);
    },
    stats: () => request<AdminStats>("/admin/stats"),
    licenseDocumentUrl: (pharmacyId: number) => `/api/admin/pharmacies/${pharmacyId}/license-document`,
    decideVerification: (pharmacyId: number, decision: "approve" | "reject", reason?: string) =>
      request(`/admin/pharmacies/${pharmacyId}/verification`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      }),
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
    available: (params?: { search?: string; page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<AvailableMedicinesResponse>(
        `/medicines/available${qs ? `?${qs}` : ""}`
      );
    },
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
    send: (data: { medicineId: number; requestedQuantity: number }, idempotencyKey: string) =>
      request("/requests/send", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(data),
      }),
    sent: (params?: RequestListParams) => {
      const qs = buildRequestListQuery(params);
      return request<RequestListResponse>(`/requests/sent${qs}`);
    },
    received: (params?: RequestListParams) => {
      const qs = buildRequestListQuery(params);
      return request<RequestListResponse>(`/requests/received${qs}`);
    },
    accept: (requestId: number) =>
      request(`/requests/${requestId}/accept`, { method: "POST" }),
    reject: (requestId: number) =>
      request(`/requests/${requestId}/reject`, { method: "POST" }),
    cancel: (requestId: number) =>
      request(`/requests/${requestId}/cancel`, { method: "POST" }),
    complete: (requestId: number) =>
      request(`/requests/${requestId}/complete`, { method: "POST" }),
  },
  subscriptions: {
    status: () => request<SubscriptionStatus>("/subscriptions/status"),
    plans: () => request<{ demoMode: boolean; plans: Plan[] }>("/subscriptions/plans"),
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
    unreadCount: () =>
      request<{ unreadCount: number }>("/notifications/unread-count"),
    markRead: (notificationId: number) =>
      request(`/notifications/${notificationId}/mark-read`, { method: "POST" }),
    markAllRead: () =>
      request<{ updated: number }>("/notifications/mark-all-read", { method: "POST" }),
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
  verificationStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  subscriptionPlan: string | null;
  subscriptionEndDate: string | null;
}

export interface AuthResponse {
  message: string;
  pharmacy: Pharmacy;
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
  price: string;
  expiryDate: string;
  description: string | null;
  isAvailable: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export type PaginatedParams = { page?: number; limit?: number };

export interface AvailableMedicine extends Medicine {
  pharmacyName: string;
  pharmacyCity: string;
}

export type AvailableMedicinesResponse = PaginatedResponse<AvailableMedicine>;

export interface ExchangeRequest {
  id: number;
  requesterPharmacyId: number;
  providerPharmacyId: number;
  medicineId: number;
  requestedQuantity: number;
  unitPrice: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "expired";
  requestDate: string;
  responseDate: string | null;
  medicineName: string;
  requesterName: string;
  providerName: string;
}

export type RequestListParams = {
  page?: number;
  limit?: number;
  status?: "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "expired";
};

export interface RequestListResponse extends PaginatedResponse<ExchangeRequest> {
  pending: number;
}

function buildRequestListQuery(params?: RequestListParams): string {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

function buildPaginationQuery(params?: PaginatedParams): string {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
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

export type NotificationType =
  | "REQUEST_RECEIVED"
  | "REQUEST_ACCEPTED"
  | "REQUEST_REJECTED"
  | "REQUEST_CANCELLED"
  | "REQUEST_COMPLETED";

export interface NotificationMetadata {
  medicineName: string;
  requestedQuantity: number;
  counterpartyName: string;
}

export interface Notification {
  id: number;
  pharmacyId: number;
  type: NotificationType | null;
  requestId: number | null;
  metadata: NotificationMetadata | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  requestStatus?: "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "expired" | null;
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
  verificationStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  licenseNumber: string | null;
  hasLicenseDoc: boolean;
  licenseDocName: string | null;
  licenseDocMime: string | null;
  subscriptionPlan: string | null;
  createdAt: string;
}

export interface AdminMedicine {
  id: number;
  pharmacyId: number;
  name: string;
  quantity: number;
  price: string;
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
