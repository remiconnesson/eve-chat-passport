import type { NextRequest } from "next/server";
import { readRequestIdentity } from "@/lib/auth/passport";
import { createBlobChatHistoryStore } from "@/lib/chat-history/blob";
import {
  chatHistoryIdSchema,
  parseChatHistoryRecord,
} from "@/lib/chat-history/serialization";
import { useLogger, withEvlog } from "@/lib/evlog";

export const dynamic = "force-dynamic";

export const GET = withEvlog(async (request: NextRequest) => {
  try {
    const store = authenticatedStore(request);
    if (!store) return unauthorized();

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return withNoStore(Response.json({ chats: await store.list() }));
    }
    if (!chatHistoryIdSchema.safeParse(id).success) return invalidId();

    const chat = await store.get(id);
    return chat
      ? withNoStore(Response.json({ chat }))
      : withNoStore(Response.json({ error: "Not found" }, { status: 404 }));
  } catch (error) {
    return storageUnavailable(error);
  }
});

export const PUT = withEvlog(async (request: NextRequest) => {
  try {
    const store = authenticatedStore(request);
    if (!store) return unauthorized();

    const chat = parseChatHistoryRecord(
      await request.json().catch(() => undefined),
    );
    if (!chat) {
      return Response.json(
        { error: "Invalid chat history record" },
        { status: 400 },
      );
    }

    await store.upsert(chat);
    return new Response(null, { status: 204 });
  } catch (error) {
    return storageUnavailable(error);
  }
});

export const DELETE = withEvlog(async (request: NextRequest) => {
  try {
    const store = authenticatedStore(request);
    if (!store) return unauthorized();

    const id = request.nextUrl.searchParams.get("id");
    if (!id || !chatHistoryIdSchema.safeParse(id).success) return invalidId();

    await store.remove(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return storageUnavailable(error);
  }
});

function authenticatedStore(request: NextRequest) {
  const identity = readRequestIdentity(request);
  if (!identity) {
    useLogger().set({ chatHistory: { outcome: "denied" } });
    return null;
  }

  useLogger().set({
    chatHistory: {
      authenticator: identity.authenticator,
      outcome: "authorized",
    },
  });
  return createBlobChatHistoryStore({ visitorId: identity.id });
}

function unauthorized(): Response {
  return withNoStore(
    Response.json({ error: "Passport authentication required" }, { status: 401 }),
  );
}

function invalidId(): Response {
  return Response.json({ error: "Invalid chat history id" }, { status: 400 });
}

function storageUnavailable(error: unknown): Response {
  useLogger().error(
    error instanceof Error ? error : new Error("Chat history storage failed"),
    { chatHistory: { outcome: "failed" } },
  );
  return withNoStore(
    Response.json({ error: "Chat history is unavailable" }, { status: 503 }),
  );
}

function withNoStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  return response;
}
