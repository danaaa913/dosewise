import { rateLimit } from "express-rate-limit";

export const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

const fifteenMinutes = 15 * 60 * 1000;

export const apiLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 300,
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
