import type { Response } from "express";
import type { RequestStatus } from "../db/schema/requests.js";

export type { RequestStatus };

const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ["accepted", "rejected", "cancelled", "expired"],
  accepted: ["completed"],
  rejected: [],
  cancelled: [],
  completed: [],
  expired: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function fail(res: Response, status: number, code: string | undefined, message: string): void {
  res.status(status).json(code ? { error: message, code } : { error: message });
}
