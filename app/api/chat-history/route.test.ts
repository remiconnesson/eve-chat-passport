import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSPORT_HEADER } from "@/lib/auth/passport";

const blob = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => blob);

import { DELETE, GET, PUT } from "./route";

const chat = {
  createdAt: "2026-06-26T11:00:00.000Z",
  events: [{ data: {}, type: "session.started" }],
  id: "chat-1",
  session: { streamIndex: 1 },
  title: "Saved chat",
  updatedAt: "2026-06-26T12:00:00.000Z",
};

async function passportToken(): Promise<string> {
  return new SignJWT({ external_sub: "00u14j2nwsisc9QmZ698" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("test-only-passport-signing-key"));
}

async function request(
  url = "https://eve.example/api/chat-history",
  init: {
    readonly body?: BodyInit;
    readonly headers?: HeadersInit;
    readonly method?: string;
  } = {},
) {
  return new NextRequest(url, {
    ...init,
    headers: {
      [PASSPORT_HEADER]: await passportToken(),
      ...init.headers,
    },
  });
}

describe("/api/chat-history", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
    blob.del.mockReset().mockResolvedValue(undefined);
    blob.get.mockReset().mockResolvedValue(null);
    blob.list.mockReset().mockResolvedValue({ blobs: [], hasMore: false });
    blob.put.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests that did not pass through Passport", async () => {
    const response = await GET(
      new NextRequest("https://eve.example/api/chat-history"),
    );

    expect(response.status).toBe(401);
    expect(blob.list).not.toHaveBeenCalled();
  });

  it("writes a private record below the authenticated visitor namespace", async () => {
    const response = await PUT(
      await request(undefined, {
        body: JSON.stringify(chat),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    );

    expect(response.status).toBe(204);
    expect(blob.put).toHaveBeenCalledWith(
      expect.stringMatching(/^chat-history\/v1\/[^/]+\/chat-1\.json$/u),
      JSON.stringify(chat),
      expect.objectContaining({
        access: "private",
        allowOverwrite: true,
      }),
    );
    expect(blob.put.mock.calls[0]?.[0]).not.toContain("00u14j2nwsisc9QmZ698");
  });

  it("lists only from the authenticated visitor namespace", async () => {
    const response = await GET(await request());

    expect(response.status).toBe(200);
    expect(blob.list).toHaveBeenCalledWith({
      cursor: undefined,
      prefix: expect.stringMatching(/^chat-history\/v1\/[^/]+\/$/u),
    });
    await expect(response.json()).resolves.toEqual({ chats: [] });
  });

  it("rejects path traversal before deleting a blob", async () => {
    const response = await DELETE(
      await request("https://eve.example/api/chat-history?id=..%2Fother"),
    );

    expect(response.status).toBe(400);
    expect(blob.del).not.toHaveBeenCalled();
  });
});
