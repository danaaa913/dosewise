import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

function loginAs(ip: string, email: string, password: string) {
  return request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password });
}

describe("SEC-003: CORS allowlist", () => {
  it("emits no CORS headers for disallowed origins", async () => {
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("echoes whitelisted origins", async () => {
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects mutating cross-origin requests at the door", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "victim@example.com", password: "whatever" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Cross-origin");
  });

  it("accepts mutating requests from whitelisted origins", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("X-Forwarded-For", "10.99.0.1")
      .send({ email: "nobody-csrf@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});

describe("AUTH-008: login rate limiting and lockout", () => {
  it("locks the source after five consecutive failed attempts", async () => {
    const ip = "10.77.0.1";
    const email = `ratelimit-${Date.now()}@example.com`;

    for (let i = 0; i < 5; i += 1) {
      const res = await loginAs(ip, email, `wrong-attempt-${i}`);
      expect(res.status).toBe(401);
    }

    const blocked = await loginAs(ip, email, "even-the-right-password");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toContain("Too many");
  });

  it("failed logins do not reveal whether an account exists", async () => {
    const ghost = await loginAs("10.78.0.1", "ghost-does-not-exist@example.com", "some-password");
    const real = await loginAs("10.78.0.2", "user1@test.com", "definitely-wrong-password");

    expect(ghost.status).toBe(401);
    expect(real.status).toBe(401);
    expect(ghost.body.error).toBe(real.body.error);
  });
});
