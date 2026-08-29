import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isMedicineExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate + "T00:00:00Z");
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}
