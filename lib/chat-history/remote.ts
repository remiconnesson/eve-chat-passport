import { z } from "zod";
import { parseChatHistoryRecord } from "./serialization";
import type {
  ChatHistoryRecord,
  ChatHistoryStore,
  ChatHistorySummary,
} from "./store";

const summarySchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string(),
  title: z.string(),
  updatedAt: z.string().datetime(),
});

const listResponseSchema = z.object({ chats: z.array(summarySchema) });

export type ChatHistoryFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function createRemoteChatHistoryStore({
  endpoint = "/api/chat-history",
  fetcher = (input, init) => globalThis.fetch(input, init),
}: {
  readonly endpoint?: string;
  readonly fetcher?: ChatHistoryFetch;
} = {}): ChatHistoryStore {
  const chatUrl = (id: string) => `${endpoint}?id=${encodeURIComponent(id)}`;

  return {
    async get(id) {
      const response = await fetcher(chatUrl(id), { cache: "no-store" });
      if (response.status === 404) return null;
      await assertResponseOk(response);

      const payload: unknown = await response.json();
      if (!isRecord(payload) || !("chat" in payload)) {
        throw new Error("Invalid chat history response.");
      }
      const chat = parseChatHistoryRecord(payload.chat);
      if (!chat) throw new Error("Invalid chat history record.");
      return chat;
    },
    async list(): Promise<readonly ChatHistorySummary[]> {
      const response = await fetcher(endpoint, { cache: "no-store" });
      await assertResponseOk(response);

      const payload = listResponseSchema.safeParse(await response.json());
      if (!payload.success) throw new Error("Invalid chat history response.");
      return payload.data.chats;
    },
    async remove(id) {
      const response = await fetcher(chatUrl(id), { method: "DELETE" });
      await assertResponseOk(response);
    },
    async upsert(chat: ChatHistoryRecord) {
      const response = await fetcher(endpoint, {
        body: JSON.stringify(chat),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      await assertResponseOk(response);
    },
  };
}

async function assertResponseOk(response: Response): Promise<void> {
  if (response.ok) return;
  throw new Error(`Chat history request failed with status ${response.status}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
