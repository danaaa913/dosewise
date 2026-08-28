import { describe, it, expect } from "vitest";
import { parseRateLimit, DEFAULT_API_RATE_LIMIT, apiLimiter } from "../lib/rate-limit.js";

describe("RL-001: API_RATE_LIMIT parsing keeps the default and never produces invalid limits", () => {
  it("returns 300 when the variable is unset", () => {
    expect(DEFAULT_API_RATE_LIMIT).toBe(300);
    expect(parseRateLimit(undefined)).toBe(300);
  });

  it("accepts positive integers", () => {
    expect(parseRateLimit("1")).toBe(1);
    expect(parseRateLimit("999999")).toBe(999999);
    expect(parseRateLimit(" 300 ")).toBe(300);
    expect(parseRateLimit("00100")).toBe(100);
  });

  it("falls back to 300 on empty strings and whitespace", () => {
    expect(parseRateLimit("")).toBe(300);
    expect(parseRateLimit("   ")).toBe(300);
  });

  it("falls back to 300 on non-numeric values", () => {
    expect(parseRateLimit("abc")).toBe(300);
    expect(parseRateLimit("1e3")).toBe(300);
    expect(parseRateLimit("+5")).toBe(300);
    expect(parseRateLimit("1,000")).toBe(300);
  });

  it("falls back to 300 on zero and negative values", () => {
    expect(parseRateLimit("0")).toBe(300);
    expect(parseRateLimit("-1")).toBe(300);
  });

  it("falls back to 300 on fractional values", () => {
    expect(parseRateLimit("1.5")).toBe(300);
    expect(parseRateLimit("0.5")).toBe(300);
  });

  it("falls back to 300 on values that overflow a safe integer", () => {
    expect(parseRateLimit("99999999999999999999")).toBe(300);
  });

  it("constructs the rate limiter with a finite positive limit", () => {
    expect(typeof apiLimiter).toBe("function");
    expect(apiLimiter).toBeDefined();
  });
});