import { describe, expect, it, vi } from "vitest";
import { createRemoteChatHistoryStore } from "./remote";
import type { ChatHistoryRecord } from "./store";

const chat: ChatHistoryRecord = {
  createdAt: "2026-06-26T11:00:00.000Z",
  events: [{ data: {}, type: "session.started" }],
  id: "chat-1",
  session: { streamIndex: 1 },
  title: "Saved chat",
  updatedAt: "2026-06-26T12:00:00.000Z",
};

describe("remote chat history", () => {
  it("uses the authenticated same-origin endpoint for every store operation", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" || init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      if (url.includes("?id=")) return Response.json({ chat });
      return Response.json({ chats: [chat] });
    });
    const store = createRemoteChatHistoryStore({ fetcher });

    await expect(store.list()).resolves.toEqual([
      {
        createdAt: chat.createdAt,
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
      },
    ]);
    await expect(store.get(chat.id)).resolves.toEqual(chat);
    await store.upsert(chat);
    await store.remove(chat.id);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/chat-history", {
      cache: "no-store",
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/chat-history?id=chat-1",
      { cache: "no-store" },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "/api/chat-history",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "/api/chat-history?id=chat-1",
      { method: "DELETE" },
    );
  });

  it("returns null for a missing chat and surfaces service failures", async () => {
    const missing = createRemoteChatHistoryStore({
      fetcher: vi.fn(async () => new Response(null, { status: 404 })),
    });
    const unavailable = createRemoteChatHistoryStore({
      fetcher: vi.fn(async () => new Response(null, { status: 503 })),
    });

    await expect(missing.get("missing")).resolves.toBeNull();
    await expect(unavailable.list()).rejects.toThrow("status 503");
  });
});
