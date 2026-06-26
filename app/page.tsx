import { AgentChat } from "@/app/_components/chat-history-shell";
import { PassportRequired } from "@/app/_components/passport-required";
import agent from "@/agent/agent";
import { currentPageVisitor } from "@/lib/auth/page";
import { visitorDisplayName } from "@/lib/auth/passport";

export default async function Page() {
  const visitor = await currentPageVisitor();
  if (!visitor) return <PassportRequired />;

  return (
    <AgentChat
      model={agent.model}
      stopButtonEnabled={process.env.EVE_ENABLE_STOP_BUTTON === "1"}
      visitorName={visitorDisplayName(visitor)}
    />
  );
}
