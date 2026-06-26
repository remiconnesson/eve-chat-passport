import type { HandleMessageStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";
import {
  type BlobDocuments,
  createBlobChatHistoryStore,
  visitorPrefix,
} from "./blob";
import type { ChatHistoryRecord } from "./store";

function memoryDocuments(): BlobDocuments & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    async listPathnames(prefix) {
      return [...values.keys()].filter((pathname) => pathname.startsWith(prefix));
    },
    async read(pathname) {
      return values.get(pathname) ?? null;
    },
    async remove(pathname) {
      values.delete(pathname);
    },
    values,
    async write(pathname, value) {
      values.set(pathname, value);
    },
  };
}

function chat(
  id: string,
  updatedAt = "2026-06-26T12:00:00.000Z",
): ChatHistoryRecord {
  return {
    createdAt: "2026-06-26T11:00:00.000Z",
    events: [{ data: {}, type: "session.started" }],
    id,
    session: { streamIndex: 1 },
    title: `Chat ${id}`,
    updatedAt,
  };
}

describe("Blob chat history", () => {
  it("stores, lists, reads, and removes a visitor's chats", async () => {
    const documents = memoryDocuments();
    const store = createBlobChatHistoryStore({ documents, visitorId: "visitor-a" });

    await store.upsert(chat("older", "2026-06-26T12:00:00.000Z"));
    await store.upsert(chat("newer", "2026-06-26T13:00:00.000Z"));

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ id: "newer" }),
      expect.objectContaining({ id: "older" }),
    ]);
    await expect(store.get("older")).resolves.toEqual(chat("older"));

    await store.remove("older");
    await expect(store.get("older")).resolves.toBeNull();
  });

  it("isolates records by a non-reversible visitor namespace", async () => {
    const documents = memoryDocuments();
    const visitorA = createBlobChatHistoryStore({
      documents,
      visitorId: "00u-visitor-a",
    });
    const visitorB = createBlobChatHistoryStore({
      documents,
      visitorId: "00u-visitor-b",
    });

    await visitorA.upsert(chat("shared-id"));

    await expect(visitorB.get("shared-id")).resolves.toBeNull();
    expect([...documents.values.keys()][0]).not.toContain("00u-visitor-a");
    expect(visitorPrefix("00u-visitor-a")).not.toBe(visitorPrefix("00u-visitor-b"));
  });

  it("preserves the original creation time during an overwrite", async () => {
    const documents = memoryDocuments();
    const store = createBlobChatHistoryStore({ documents, visitorId: "visitor" });
    await store.upsert(chat("chat"));

    await store.upsert({
      ...chat("chat", "2026-06-26T14:00:00.000Z"),
      createdAt: "2026-06-26T13:30:00.000Z",
      title: "Updated title",
    });

    await expect(store.get("chat")).resolves.toMatchObject({
      createdAt: "2026-06-26T11:00:00.000Z",
      title: "Updated title",
    });
  });

  it("rejects path-like chat identifiers", async () => {
    const store = createBlobChatHistoryStore({
      documents: memoryDocuments(),
      visitorId: "visitor",
    });

    await expect(store.remove("../another-user/chat")).rejects.toThrow(
      "Invalid chat history id",
    );
  });

  it("removes streaming deltas and inline file bytes before writing", async () => {
    const documents = memoryDocuments();
    const store = createBlobChatHistoryStore({ documents, visitorId: "visitor" });
    const events = [
      {
        data: {
          messageDelta: "Hello",
          messageSoFar: "Hello",
          sequence: 0,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.appended",
      },
      {
        data: {
          finishReason: "stop",
          message: "Hello",
          sequence: 0,
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "message.completed",
      },
      {
        data: {
          result: {
            callId: "call-1",
            kind: "tool-result",
            output: {
              dataBase64: "a".repeat(1_000),
              filename: "generated.png",
              path: "/workspace/generated/generated.png",
            },
            toolName: "generate_image",
          },
          sequence: 0,
          status: "completed",
          stepIndex: 0,
          turnId: "turn-1",
        },
        type: "action.result",
      },
    ] satisfies readonly HandleMessageStreamEvent[];

    await store.upsert({ ...chat("compact"), events });

    expect([...documents.values.values()][0]).not.toContain("a".repeat(100));
    await expect(store.get("compact")).resolves.toMatchObject({
      events: [
        events[1],
        {
          data: {
            result: {
              output: {
                dataBase64Omitted: true,
                filename: "generated.png",
                path: "/workspace/generated/generated.png",
              },
            },
          },
        },
      ],
    });
  });
});
