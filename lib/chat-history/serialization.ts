import type { HandleMessageStreamEvent } from "eve/client";
import { z } from "zod";
import type { ChatHistoryRecord } from "./store";

export const chatHistoryIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/u);

const eventTypes = [
  "action.result",
  "actions.requested",
  "authorization.completed",
  "authorization.required",
  "compaction.completed",
  "compaction.requested",
  "input.requested",
  "message.appended",
  "message.completed",
  "message.received",
  "reasoning.appended",
  "reasoning.completed",
  "result.completed",
  "session.completed",
  "session.failed",
  "session.started",
  "session.waiting",
  "step.completed",
  "step.failed",
  "step.started",
  "subagent.called",
  "subagent.event",
  "subagent.completed",
  "subagent.started",
  "turn.completed",
  "turn.failed",
  "turn.started",
] as const satisfies readonly HandleMessageStreamEvent["type"][];
type MissingEventType = Exclude<
  HandleMessageStreamEvent["type"],
  (typeof eventTypes)[number]
>;
const allEventTypesCovered: MissingEventType extends never ? true : never = true;

const sessionSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().nonnegative(),
});

const storedRecordSchema = z.object({
  createdAt: z.string().datetime(),
  events: z.array(z.unknown()),
  id: chatHistoryIdSchema,
  session: sessionSchema,
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime(),
});

export function parseChatHistoryRecord(value: unknown): ChatHistoryRecord | null {
  const parsed = storedRecordSchema.safeParse(value);
  if (!parsed.success) return null;

  const events = parseEvents(parsed.data.events);
  return events ? { ...parsed.data, events } : null;
}

export function compactChatHistoryRecord(
  chat: ChatHistoryRecord,
): ChatHistoryRecord {
  return {
    ...chat,
    events: chat.events
      .filter(
        (event) =>
          event.type !== "message.appended" &&
          event.type !== "reasoning.appended",
      )
      .map(compactEvent),
  };
}

function parseEvents(
  values: readonly unknown[],
): HandleMessageStreamEvent[] | null {
  const events: HandleMessageStreamEvent[] = [];
  for (const value of values) {
    if (!isStreamEvent(value)) return null;
    events.push(value);
  }
  return events;
}

function compactEvent(
  event: HandleMessageStreamEvent,
): HandleMessageStreamEvent {
  if (
    event.type !== "action.result" ||
    event.data.result.kind !== "tool-result"
  ) {
    return event;
  }

  const output = event.data.result.output;
  if (!isRecord(output) || typeof output.dataBase64 !== "string") {
    return event;
  }

  const { dataBase64: _dataBase64, ...compactOutput } = output;
  return {
    ...event,
    data: {
      ...event.data,
      result: {
        ...event.data.result,
        output: { ...compactOutput, dataBase64Omitted: true },
      },
    },
  };
}

function isStreamEvent(value: unknown): value is HandleMessageStreamEvent {
  if (!isRecord(value) || !isEventType(value.type)) return false;
  if (value.meta !== undefined) {
    if (!isRecord(value.meta) || typeof value.meta.at !== "string") return false;
  }
  if (value.type === "session.completed") return value.data === undefined;
  return isRecord(value.data);
}

function isEventType(
  value: unknown,
): value is HandleMessageStreamEvent["type"] {
  return (
    allEventTypesCovered &&
    typeof value === "string" &&
    eventTypes.some((eventType) => eventType === value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
