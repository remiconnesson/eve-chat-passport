import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSPORT_HEADER } from "@/lib/auth/passport";
import { POST } from "./route";

async function passportToken(): Promise<string> {
  return new SignJWT({ external_sub: "visitor-id" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("test-only-passport-signing-key"));
}

async function authenticatedRequest(
  body: unknown,
  origin = "https://eve.example",
) {
  return new NextRequest("https://eve.example/api/_evlog/ingest", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "eve.example",
      origin,
      [PASSPORT_HEADER]: await passportToken(),
    },
    method: "POST",
  });
}

describe("POST /api/_evlog/ingest", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts an authenticated same-origin client log", async () => {
    const request = await authenticatedRequest({
      event: "client.ready",
      level: "info",
      timestamp: "2026-06-19T12:00:00.000Z",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("accepts an allowlisted client diagnostic payload", async () => {
    const request = await authenticatedRequest({
      diagnosticCode: "EVE_R001",
      event: "agent.request_failed",
      level: "error",
      timestamp: "2026-06-19T12:00:00.000Z",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("rejects requests without Passport", async () => {
    const request = new NextRequest("https://eve.example/api/_evlog/ingest", {
      body: JSON.stringify({
        event: "client.ready",
        level: "info",
        timestamp: "2026-06-19T12:00:00.000Z",
      }),
      headers: {
        "content-type": "application/json",
        host: "eve.example",
        origin: "https://eve.example",
      },
      method: "POST",
    });

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
  });

  it("rejects requests from another origin", async () => {
    const request = await authenticatedRequest(
      { event: "test", level: "info", timestamp: "2026-06-19T12:00:00.000Z" },
      "https://attacker.example",
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("rejects requests the browser identifies as cross-site", async () => {
    const request = await authenticatedRequest({
      event: "test",
      level: "info",
      timestamp: "2026-06-19T12:00:00.000Z",
    });
    request.headers.set("sec-fetch-site", "cross-site");

    const response = await POST(request);

    expect(response.status).toBe(403);
  });
});
