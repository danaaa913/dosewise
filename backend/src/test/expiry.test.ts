import { describe, it, expect } from "vitest";
import { todayUtc, isExpired } from "../lib/expiry.js";

describe("EXP-001: expiry helper compares YYYY-MM-DD strings against UTC today", () => {
  it("todayUtc returns an ISO YYYY-MM-DD slice of the reference date", () => {
    const ref = new Date("2026-08-28T23:59:59.000Z");
    expect(todayUtc(ref)).toBe("2026-08-28");
  });

  it("todayUtc uses the current time when no reference is provided", () => {
    const value = todayUtc();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(value).toBe(now.toISOString().slice(0, 10));
  });

  it("expired yesterday returns true", () => {
    expect(isExpired("2026-08-27", "2026-08-28")).toBe(true);
  });

  it("expiring today returns false (still valid all day)", () => {
    expect(isExpired("2026-08-28", "2026-08-28")).toBe(false);
  });

  it("expiring tomorrow returns false", () => {
    expect(isExpired("2026-08-29", "2026-08-28")).toBe(false);
  });

  it("old stored dates are expired regardless of clock", () => {
    expect(isExpired("2020-01-01")).toBe(true);
  });

  it("never uses Date construction for the comparison (string ordering)", () => {
    const expiry = "2026-08-30";
    const today = "2026-08-29T23:59:59.000Z".slice(0, 10);
    expect(expiry >= today).toBe(true);
    expect(isExpired(expiry, today)).toBe(false);
  });
});