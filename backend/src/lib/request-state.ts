import type { RequestStatus } from "../db/schema/requests.js";

export type { RequestStatus };

const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ["accepted", "rejected", "cancelled", "expired"],
  accepted: ["completed", "cancelled"],
  rejected: [],
  cancelled: [],
  completed: [],
  expired: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
