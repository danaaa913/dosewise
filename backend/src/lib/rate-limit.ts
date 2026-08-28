import { rateLimit } from "express-rate-limit";

export const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

export function isMutationAllowed(
  method: string,
  origin: string | undefined,
  host: string | undefined,
): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return true;
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (host && originHost === host) return true;
  return allowedOrigins.includes(origin);
}

const fifteenMinutes = 15 * 60 * 1000;

export const DEFAULT_API_RATE_LIMIT = 300;

export function parseRateLimit(value: string | undefined, fallback: number = DEFAULT_API_RATE_LIMIT): number {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const apiLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: parseRateLimit(process.env.API_RATE_LIMIT),
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Try again later." },
});
