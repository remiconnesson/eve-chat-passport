import { createHash } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import {
  chatHistoryIdSchema,
  compactChatHistoryRecord,
  parseChatHistoryRecord,
} from "./serialization";
import {
  type ChatHistoryRecord,
  type ChatHistoryStore,
  type ChatHistorySummary,
  toChatHistorySummary,
} from "./store";

const CHAT_HISTORY_ROOT = "chat-history/v1";

export interface BlobDocuments {
  listPathnames(prefix: string): Promise<readonly string[]>;
  read(pathname: string): Promise<string | null>;
  remove(pathname: string): Promise<void>;
  write(pathname: string, value: string): Promise<void>;
}

const vercelBlobDocuments: BlobDocuments = {
  async listPathnames(prefix) {
    const pathnames: string[] = [];
    let cursor: string | undefined;

    do {
      const result = await list({ cursor, prefix });
      pathnames.push(...result.blobs.map((blob) => blob.pathname));
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    return pathnames;
  },
  async read(pathname) {
    const result = await get(pathname, { access: "private", useCache: false });
    if (result?.statusCode !== 200) return null;
    return new Response(result.stream).text();
  },
  async remove(pathname) {
    await del(pathname);
  },
  async write(pathname, value) {
    await put(pathname, value, {
      access: "private",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
    });
  },
};

export function createBlobChatHistoryStore({
  documents = vercelBlobDocuments,
  visitorId,
}: {
  readonly documents?: BlobDocuments;
  readonly visitorId: string;
}): ChatHistoryStore {
  const prefix = visitorPrefix(visitorId);
  const pathname = (id: string) => `${prefix}${id}.json`;

  return {
    async get(id) {
      if (!chatHistoryIdSchema.safeParse(id).success) return null;
      return readChat(documents, pathname(id));
    },
    async list() {
      const pathnames = await documents.listPathnames(prefix);
      const chats = await Promise.all(
        pathnames
          .filter((candidate) => candidate.endsWith(".json"))
          .map((candidate) => readChat(documents, candidate)),
      );

      return chats
        .filter((chat): chat is ChatHistoryRecord => chat !== null)
        .map(toChatHistorySummary)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async remove(id) {
      assertChatId(id);
      await documents.remove(pathname(id));
    },
    async upsert(chat) {
      const validated = parseChatHistoryRecord(chat);
      if (!validated) throw new TypeError("Invalid chat history record.");

      const existing = await readChat(documents, pathname(validated.id));
      const compactChat = compactChatHistoryRecord({
        ...validated,
        createdAt: existing?.createdAt ?? validated.createdAt,
      });
      await documents.write(pathname(compactChat.id), JSON.stringify(compactChat));
    },
  };
}

export function visitorPrefix(visitorId: string): string {
  const namespace = createHash("sha256").update(visitorId).digest("base64url");
  return `${CHAT_HISTORY_ROOT}/${namespace}/`;
}

async function readChat(
  documents: BlobDocuments,
  pathname: string,
): Promise<ChatHistoryRecord | null> {
  const raw = await documents.read(pathname);
  if (!raw) return null;

  try {
    return parseChatHistoryRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

function assertChatId(id: string): void {
  if (!chatHistoryIdSchema.safeParse(id).success) {
    throw new TypeError("Invalid chat history id.");
  }
}
