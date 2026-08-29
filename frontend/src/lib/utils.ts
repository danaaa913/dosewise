import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function isMedicineExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate + "T00:00:00Z");
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}
